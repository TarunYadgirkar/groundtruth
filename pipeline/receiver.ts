import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { DATA } from "./lib/corpus";

// Local sink for pages read in the browser (sites that block scripts). Saves text under data/captured/.
const OUT = path.join(DATA, "captured");
fs.mkdirSync(OUT, { recursive: true });

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-allow-private-network": "true",
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    const url = new URL(req.url ?? "/", "http://localhost");
    const doc = url.searchParams.get("doc") ?? "";
    const source = url.searchParams.get("source") ?? "";
    if (req.method !== "POST" || !/^D\d{3}$/.test(doc)) return res.writeHead(400, cors).end("bad request");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      fs.writeFileSync(path.join(OUT, `${doc}.txt`), `SOURCE: ${source}\nRETRIEVED: ${stamp} UTC (read in browser by Groundtruth; link-only in starter pack)\n\n${body}\n`);
      console.log(`${doc} saved ${body.length}b`);
      res.writeHead(200, cors).end("ok");
    });
  })
  .listen(4180, "127.0.0.1", () => console.log("receiver on 4180"));
