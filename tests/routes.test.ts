import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app.js";
import { CONFIRM_PHRASE } from "../src/schemas.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp({ lastConnectionFile: "./.test-last-connection.json" });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function post(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe("health", () => {
  it("GET /api/health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});

describe("validação de payload (zod)", () => {
  it("create-themes sem banco → 400", async () => {
    const { status, json } = await post("/api/create-themes", {
      connection: { host: "x" }, // falta database
      tablesRaw: "t",
      prfId: 1,
    });
    expect(status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("create-themes sem tabela → 400", async () => {
    const { status } = await post("/api/create-themes", {
      connection: { database: "d" },
      tablesRaw: "",
      prfId: 1,
    });
    expect(status).toBe(400);
  });
});

describe("guard de execução (dry-run é o default)", () => {
  it("execute:true sem confirm → 409 (não conecta ao banco)", async () => {
    const { status, json } = await post("/api/create-themes", {
      connection: { database: "d" },
      tablesRaw: "t",
      prfId: 1,
      execute: true,
    });
    expect(status).toBe(409);
    expect(String(json.error)).toContain(CONFIRM_PHRASE);
  });

  it("execute:true com confirm errado → 409", async () => {
    const { status } = await post("/api/copy-themes", {
      connection: { database: "d" },
      sourcePrfId: 1,
      destPrfId: 2,
      themes: ["A"],
      execute: true,
      confirm: "sim",
    });
    expect(status).toBe(409);
  });

  it("transfer execute:true sem confirm → 409", async () => {
    const { status } = await post("/api/transfer", {
      source: { database: "s" },
      target: { database: "t" },
      tableName: "x",
      sourcePrfId: 1,
      destPrfId: 1,
      execute: true,
    });
    expect(status).toBe(409);
  });
});
