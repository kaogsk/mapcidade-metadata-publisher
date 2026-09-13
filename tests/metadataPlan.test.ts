import { describe, it, expect } from "vitest";
import { buildCreateThemesPlan } from "../src/services/metadata.js";
import { renderPreview } from "../src/sqlPlan.js";
import { FakeDb, result } from "./fakeDb.js";

function baseDb(dictCols: string[], tableExists = false) {
  const db = new FakeDb();
  // detecção da FK do dicionário
  db.on("select column_name from information_schema.columns where table_name = $1", (p) => {
    if (p[0] === "data_dictionary") {
      return result(dictCols.map((c) => ({ column_name: c })));
    }
    return result([]);
  });
  // tabela/view existe?
  db.on("from information_schema.tables where table_name = $1", () =>
    result([{ "?column?": 1 }]),
  );
  // data_table lookup
  db.on("select table_id from data_table where name = $1", () =>
    tableExists ? result([{ table_id: 99 }]) : result([]),
  );
  // colunas da tabela real
  db.on(
    "select column_name, data_type, character_maximum_length",
    () =>
      result([
        { column_name: "gid", data_type: "integer", character_maximum_length: null },
        { column_name: "nome", data_type: "character varying", character_maximum_length: 60 },
        { column_name: "geom", data_type: "geometry", character_maximum_length: null },
      ]),
  );
  return db;
}

const input = {
  tablesRaw: "etl_area_verde",
  prfId: 7,
  mapParentName: "Camadas Disponíveis",
  workspace: "rivermeadow_gis",
  geoserverBase: "/geoserver/rivermeadow_gis/wms",
  urlBanco: "enc://x",
};

describe("buildCreateThemesPlan", () => {
  it("planner é read-only: só executa SELECT durante o planejamento", async () => {
    const db = baseDb(["theme_id", "attribute_name", "label", "data_type", "table_name"]);
    await buildCreateThemesPlan(db, input);
    expect(db.writeStatements()).toEqual([]);
  });

  it("gera data_table + theme + dicionário + mapa + params + ordenação", async () => {
    const db = baseDb(["theme_id", "attribute_name", "label", "data_type", "char_length", "table_name"]);
    const plan = await buildCreateThemesPlan(db, input);
    const purposes = plan.statements.map((s) => s.purpose);

    expect(purposes).toContain("Criar data_table para 'etl_area_verde'");
    expect(purposes.some((p) => p.startsWith("Criar theme 'Area Verde'"))).toBe(true);
    // uma linha de dicionário por coluna (3 colunas)
    expect(purposes.filter((p) => p.startsWith("Dicionário:"))).toHaveLength(3);
    expect(purposes.some((p) => p.startsWith("Criar map_node"))).toBe(true);
    expect(purposes.some((p) => p.startsWith("Parâmetros WMS"))).toBe(true);
    expect(purposes.some((p) => p.startsWith("Reordenar mapas"))).toBe(true);
  });

  it("usa theme_id como FK do dicionário quando existe (via ref)", async () => {
    const db = baseDb(["theme_id", "attribute_name", "data_type"]);
    const plan = await buildCreateThemesPlan(db, input);
    const dic = plan.statements.find((s) => s.purpose.startsWith("Dicionário:"));
    const preview = renderPreview({ statements: [dic!], logs: [] })[0];
    // primeira coluna do dicionário é theme_id, valor é a ref do tema
    expect(preview?.sql).toContain('"theme_id"');
    expect(preview?.params[0]).toBe(":theme_id__etl_area_verde");
  });

  it("tema tabular (mapParentName vazio) não gera map_node nem map_param", async () => {
    const db = baseDb(["table_id", "attribute_name", "data_type"]);
    const plan = await buildCreateThemesPlan(db, { ...input, mapParentName: "" });
    const purposes = plan.statements.map((s) => s.purpose);
    expect(purposes.some((p) => p.startsWith("Criar map_node"))).toBe(false);
    expect(purposes.some((p) => p.startsWith("Parâmetros WMS"))).toBe(false);
  });

  it("dicionário com FK table_id usa o table_id existente (sem criar data_table)", async () => {
    const db = baseDb(["table_id", "attribute_name", "data_type"], true);
    const plan = await buildCreateThemesPlan(db, input);
    const purposes = plan.statements.map((s) => s.purpose);
    expect(purposes).not.toContain("Criar data_table para 'etl_area_verde'");
    const dic = plan.statements.find((s) => s.purpose.startsWith("Dicionário:"))!;
    // FK table_id = 99 (valor real existente, não ref)
    expect(dic.params[0]).toBe(99);
  });

  it("erro se tabela não existe", async () => {
    const db = new FakeDb()
      .on("select column_name from information_schema.columns where table_name = $1", () =>
        result([{ column_name: "theme_id" }]),
      )
      .on("from information_schema.tables where table_name = $1", () => result([]));
    await expect(buildCreateThemesPlan(db, input)).rejects.toThrow(/não encontrada/);
  });
});
