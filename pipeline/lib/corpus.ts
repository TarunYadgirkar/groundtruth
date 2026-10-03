import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const STARTER = path.join(ROOT, "starter");
export const DATA = path.join(ROOT, "data");

export interface CorpusDoc {
  docId: string;
  jurisdictions: string;
  url: string;
  sourceType: string;
  retrievedAt: string;
  text: string;
}

export function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quoted) {
      if (ch === '"' && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

export function loadCorpus(): CorpusDoc[] {
  const manifest = parseCsv(fs.readFileSync(path.join(STARTER, "corpus/corpus_manifest.csv"), "utf8"));
  return manifest
    .filter((r) => r.text_file)
    .map((r) => ({
      docId: r.doc_id,
      jurisdictions: r.jurisdictions,
      url: r.url,
      sourceType: r.source_type,
      retrievedAt: r.retrieved_at,
      text: fs.readFileSync(path.join(STARTER, "corpus", r.text_file), "utf8"),
    }));
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
