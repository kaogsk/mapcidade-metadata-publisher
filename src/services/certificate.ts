/**
 * Gerar JSON de certidão a partir dos atributos de um tema. Read-only (só SELECT).
 */
import type { Queryable } from "../db/types.js";
import { toStr } from "../util/str.js";

export async function generateCertificateJson(q: Queryable, tblId: number): Promise<string> {
  const themeResult = await q.query("SELECT theme_name FROM theme WHERE table_id = $1", [tblId]);
  const themeRow = themeResult.rows[0];
  if (!themeRow) {
    throw new Error(`Tema com table_id ${String(tblId)} não encontrado`);
  }
  const themeName = String(themeRow.theme_name);

  const attrsResult = await q.query(
    "SELECT attribute_name, label, data_type FROM data_dictionary WHERE table_id = $1",
    [tblId],
  );

  const out: string[] = [];
  out.push("{");
  out.push("--Info");
  out.push('    "Profile":"Administrador"');
  out.push(`    "Comment":"${themeName}"`);
  out.push('    "KeyName":"gid"');
  out.push("");
  out.push("--Fontes");
  out.push("");
  out.push('    "MainFont":"Calibri#plain#black#15"');
  out.push('     "Font":"plain5#Calibri#plain#black#5"');
  out.push('     "Font":"plain8#Calibri#plain#black#8"');
  out.push('     "Font":"plain9#Calibri#plain#black#12"');
  out.push('     "Font":"plain10#Calibri#plain#black#10"');
  out.push('     "Font":"plain11#Calibri#plain#black#11"');
  out.push('     "Font":"plain12#Calibri#plain#black#12"');
  out.push('     "Font":"plain14#Calibri#plain#black#14"');
  out.push('     "Font":"plain16#Calibri#plain#black#16"');
  out.push('     "Font":"bold7#Calibri#bold#black#7"');
  out.push('     "Font":"bold8#Calibri#bold#black#8"');
  out.push('     "Font":"bold9#Calibri#bold#black#13"');
  out.push('     "Font":"bold10#Calibri#bold#black#10"');
  out.push('     "Font":"bold14#Calibri#bold#black#14"');
  out.push('     "Font":"bold11#Calibri#bold#black#11"');
  out.push('     "Font":"bold16#Calibri#bold#black#16"');
  out.push('     "Font":"bold20#Calibri#bold#black#20"');
  out.push("");
  out.push("--Variable");

  for (const row of attrsResult.rows) {
    const attr = String(row.attribute_name);
    const dataType = toStr(row.data_type);
    out.push(`    "Variable":"${attr}#fetch(${themeName},${attr})"`);
    if (["bool", "boolean"].includes(dataType.toLowerCase())) {
      out.push(
        `    "Variable":"${attr}_case_false_true#replace(${attr}, 'false', '')"`,
      );
      out.push(
        `    "Variable":"${attr}_case#replace(${attr}_case_false_true, 'true', 'X')"`,
      );
    }
  }

  out.push("}");
  return out.join("\n");
}
