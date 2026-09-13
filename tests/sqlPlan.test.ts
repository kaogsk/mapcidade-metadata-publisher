import { describe, it, expect } from "vitest";
import {
  emptyPlan,
  executePlan,
  isRef,
  placeholders,
  ident,
  ref,
  renderPreview,
} from "../src/sqlPlan.js";
import { FakeDb, result } from "./fakeDb.js";

describe("helpers", () => {
  it("placeholders", () => {
    expect(placeholders(3)).toBe("$1, $2, $3");
    expect(placeholders(2, 2)).toBe("$3, $4");
  });
  it("ident escapa aspas", () => {
    expect(ident('col"x')).toBe('"col""x"');
  });
  it("isRef", () => {
    expect(isRef(ref("a"))).toBe(true);
    expect(isRef(5)).toBe(false);
  });
});

describe("renderPreview", () => {
  it("serializa refs como :nome", () => {
    const plan = emptyPlan();
    plan.statements.push({
      purpose: "x",
      sql: "INSERT INTO t (a) VALUES ($1)",
      params: [ref("foo")],
    });
    expect(renderPreview(plan)[0]?.params).toEqual([":foo"]);
  });
});

describe("executePlan", () => {
  it("resolve refs a partir de RETURNING anteriores", async () => {
    const db = new FakeDb()
      .on("insert into a", () => result([{ id: 42 }]))
      .on("insert into b", () => result([]));

    const plan = emptyPlan();
    plan.statements.push({
      purpose: "cria A",
      sql: "INSERT INTO a DEFAULT VALUES RETURNING id",
      params: [],
      returning: { column: "id", ref: "a_id" },
    });
    plan.statements.push({
      purpose: "usa A em B",
      sql: "INSERT INTO b (a_id) VALUES ($1)",
      params: [ref("a_id")],
    });

    const executed = await executePlan(db, plan);
    expect(executed).toHaveLength(2);
    // O segundo statement recebeu 42 (valor real), não a Ref.
    expect(db.executed[1]?.params).toEqual([42]);
  });

  it("falha se a ref não foi produzida", async () => {
    const db = new FakeDb();
    const plan = emptyPlan();
    plan.statements.push({
      purpose: "usa ref inexistente",
      sql: "INSERT INTO b (x) VALUES ($1)",
      params: [ref("missing")],
    });
    await expect(executePlan(db, plan)).rejects.toThrow(/não resolvida/);
  });
});
