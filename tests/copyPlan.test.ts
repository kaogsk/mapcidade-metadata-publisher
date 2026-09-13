import { describe, it, expect } from "vitest";
import { buildCopyThemePlan, buildCopyThemesPlans } from "../src/services/copy.js";
import { FakeDb, result, columnsResult } from "./fakeDb.js";

function copyDb(opts: { existsInDest?: boolean; tabular?: boolean } = {}) {
  const db = new FakeDb();
  // existe no destino?
  db.onMatch(
    (sql) => /select 1 from "theme"/i.test(sql),
    () => (opts.existsInDest ? result([{ "?column?": 1 }]) : result([])),
  );
  // tema de origem por theme_name
  db.on("select * from theme where profile_id = $1 and theme_name = $2", () =>
    result([{ theme_id: 10, theme_name: "Area Verde", table_id: 5, profile_id: 1, layer_id: null }]),
  );
  // colunas de theme
  db.on('select * from "theme" limit 0', () =>
    columnsResult(["theme_id", "theme_name", "table_id", "profile_id", "layer_id"]),
  );
  // permissões
  db.on("select * from permission where theme_id = $1", () =>
    result([{ perm_id: 1, theme_id: 10, editable: true, dict_id: 3 }]),
  );
  db.on('select * from "permission" limit 0', () =>
    columnsResult(["perm_id", "theme_id", "editable", "dict_id"]),
  );
  // mapa
  db.on("select * from map_node where theme_id = $1", () =>
    opts.tabular
      ? result([])
      : result([{ map_id: 20, name: "Area Verde", profile_id: 1, theme_id: 10, parent_map_id: null }]),
  );
  db.on('select * from "map_node" limit 0', () =>
    columnsResult(["map_id", "name", "profile_id", "theme_id", "parent_map_id"]),
  );
  // params
  db.on("select * from map_param where map_id = $1", () =>
    result([{ param_id: 1, map_id: 20, param: "layers", value: "ws:etl_area_verde", profile_id: 1 }]),
  );
  db.on('select * from "map_param" limit 0', () =>
    columnsResult(["param_id", "map_id", "param", "value", "profile_id"]),
  );
  return db;
}

describe("buildCopyThemePlan", () => {
  it("planner read-only (nenhuma escrita durante planejamento)", async () => {
    const db = copyDb();
    await buildCopyThemePlan(db, 1, "Area Verde", 2, 99);
    expect(db.writeStatements()).toEqual([]);
  });

  it("pula tema já existente no destino", async () => {
    const db = copyDb({ existsInDest: true });
    const res = await buildCopyThemePlan(db, 1, "Area Verde", 2, 99);
    expect(res.skipped).toMatch(/já existe/);
    expect(res.plan.statements).toHaveLength(0);
  });

  it("gera tema + permissão + mapa + param com profile_id/parent_map_id de destino", async () => {
    const db = copyDb();
    const res = await buildCopyThemePlan(db, 1, "Area Verde", 2, 99);
    const purposes = res.plan.statements.map((s) => s.purpose);
    expect(purposes.some((p) => p.startsWith("Copiar theme"))).toBe(true);
    expect(purposes.some((p) => p.startsWith("Copiar permission"))).toBe(true);
    expect(purposes.some((p) => p.startsWith("Copiar map_node"))).toBe(true);
    expect(purposes.some((p) => p.startsWith("Copiar map_param"))).toBe(true);

    // o INSERT de theme não inclui a coluna theme_id (PK gerada)
    const themeStmt = res.plan.statements.find((s) => s.purpose.startsWith("Copiar theme"))!;
    expect(themeStmt.sql).not.toContain('"theme_id"');
    expect(themeStmt.returning?.column).toBe("theme_id");
  });

  it("tema tabular: só tema + permissão, sem mapa/param", async () => {
    const db = copyDb({ tabular: true });
    const res = await buildCopyThemePlan(db, 1, "Area Verde", 2, null);
    const purposes = res.plan.statements.map((s) => s.purpose);
    expect(purposes.some((p) => p.startsWith("Copiar map_node"))).toBe(false);
  });
});

describe("buildCopyThemesPlans", () => {
  it("adiciona plano de reordenação no destino", async () => {
    const db = copyDb();
    const plans = await buildCopyThemesPlans(db, 1, 2, ["Area Verde"], 99);
    expect(plans.themes).toHaveLength(1);
    expect(plans.reorder.statements.some((s) => s.purpose.startsWith("Reordenar mapas"))).toBe(true);
  });

  it("captura erro por tema sem abortar os demais", async () => {
    const db = new FakeDb()
      .onMatch(
        (sql) => /select 1 from "theme"/i.test(sql),
        () => result([]),
      )
      .on("select * from theme where profile_id = $1 and theme_name = $2", () => result([]))
      .on("select t.* from theme t", () => result([]))
      .on("select * from theme where profile_id = $1 and table_name = $2", () => result([]));
    const plans = await buildCopyThemesPlans(db, 1, 2, ["Inexistente"], null);
    expect(plans.themes[0]?.skipped).toMatch(/ERRO/);
  });
});
