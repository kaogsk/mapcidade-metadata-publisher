import { describe, it, expect } from "vitest";
import { humanNameFromTable, mapPgTypeToAppType } from "../src/services/naming.js";

describe("humanNameFromTable", () => {
  it("remove prefixos e capitaliza", () => {
    expect(humanNameFromTable("etl_area_verde")).toBe("Area Verde");
    expect(humanNameFromTable("mod_lote_urbano")).toBe("Lote Urbano");
    expect(humanNameFromTable("tbl_ubs_saude")).toBe("Ubs Saude");
  });

  it("sem prefixo conhecido mantém tudo", () => {
    expect(humanNameFromTable("vet_zzz_limite_municipal")).toBe("Vet Zzz Limite Municipal");
  });

  it("colapsa espaços e baixa o resto das letras", () => {
    expect(humanNameFromTable("AREA__DE__RISCO")).toBe("Area De Risco");
  });
});

describe("mapPgTypeToAppType", () => {
  it("mapeia tipos textuais preservando tamanho", () => {
    expect(mapPgTypeToAppType("character varying", 60)).toEqual(["varchar", 60]);
    expect(mapPgTypeToAppType("text", null)).toEqual(["varchar", null]);
  });
  it("mapeia numéricos e inteiros", () => {
    expect(mapPgTypeToAppType("integer", null)).toEqual(["integer", null]);
    expect(mapPgTypeToAppType("numeric", null)).toEqual(["numeric", null]);
    expect(mapPgTypeToAppType("double precision", null)).toEqual(["numeric", null]);
  });
  it("mapeia geometria, date e timestamp (timestamp antes de date)", () => {
    // information_schema.columns.data_type entrega "geometry"/"geography" (não "geometry(Point,...)").
    expect(mapPgTypeToAppType("geometry", null)).toEqual(["geom", null]);
    expect(mapPgTypeToAppType("geography", null)).toEqual(["geom", null]);
    expect(mapPgTypeToAppType("timestamp without time zone", null)).toEqual(["timestamp", null]);
    expect(mapPgTypeToAppType("date", null)).toEqual(["date", null]);
  });
  it("paridade 1:1 com o Python: 'int' como substring vence 'geometry(...)' (quirk compartilhado)", () => {
    // O Python v2 (map_pgtype_to_app_type) testa 'int' antes de 'geometry' e "point" contém "int",
    // então "geometry(Point,4326)" cai em "integer" nos DOIS. Fidelidade > correção nesta migração.
    expect(mapPgTypeToAppType("geometry(Point,4326)", null)).toEqual(["integer", null]);
  });
  it("fallback varchar", () => {
    expect(mapPgTypeToAppType("uuid", 10)).toEqual(["varchar", 10]);
  });
});
