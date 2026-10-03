import fs from "node:fs";
import path from "node:path";
import { DATA, STARTER, parseCsv } from "./lib/corpus";

// Organizer (RealPage, Discord 2026-10-03): teams may capture link-only pages individually.
// One request at a time with a delay; no crawling beyond the listed URLs.
const OUT = path.join(DATA, "captured");
const DELAY_MS = 2500;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 GroundtruthHackathon/1.0";

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&sect;/g, "§")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = parseCsv(fs.readFileSync(path.join(STARTER, "corpus/links_only.csv"), "utf8"));
  const only = process.argv.slice(2);
  for (const r of rows.filter((x) => only.length === 0 || only.includes(x.doc_id))) {
    const file = path.join(OUT, `${r.doc_id}.txt`);
    if (fs.existsSync(file)) continue;
    try {
      const res = await fetch(r.url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
      const type = res.headers.get("content-type") ?? "";
      const text = type.includes("html") ? htmlToText(await res.text()) : "";
      if (!res.ok || text.length < 800) {
        console.log(`${r.doc_id} SKIP ${res.status} ${type.split(";")[0]} ${text.length}b ${r.url}`);
      } else {
        const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
        fs.writeFileSync(file, `SOURCE: ${r.url}\nRETRIEVED: ${stamp} UTC (captured by Groundtruth; link-only in starter pack)\n\n${text}\n`);
        console.log(`${r.doc_id} OK ${text.length}b ${r.jurisdictions}`);
      }
    } catch (error) {
      console.log(`${r.doc_id} ERROR ${error instanceof Error ? error.message : error}`);
    }
    await new Promise((res) => setTimeout(res, DELAY_MS));
  }
}

await main();
