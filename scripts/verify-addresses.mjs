// Headless check that every sample address renders a sane answer panel.
// Usage: node --import tsx scripts/verify-addresses.mjs [--base URL] [--ids A0001,A0002] [--limit N] [--camera 20] [--concurrency 4]
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { ADDRESSES, evaluate } from "../src/lib/data.ts";

const AS_OF = "2026-10-01";
const GPU_ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const VIEWPORT = { width: 1440, height: 900 };
const PANEL_WAIT_MS = 60_000;
const CAMERA_SETTLE_MS = 3000;
const RING_RGB = [200, 69, 44];
const RING_TOLERANCE = 45;
const RING_MIN_PIXELS = 40;
const CAMERA_MAX_OFFSET_DEG = 0.01;
const CAMERA_MAX_RANGE_M = 3000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const BASE = arg("base", "https://groundtruth-rho.vercel.app").replace(/\/$/, "");
const CONCURRENCY = Math.min(4, Number(arg("concurrency", "4")));
const CAMERA_COUNT = Number(arg("camera", "20"));
const LIMIT = Number(arg("limit", "0"));
const IDS = arg("ids", "");
const OUT = arg("out", "data/address-verification.json");
const SHOTS = arg("shots", "assets/generated/verification");

const RAW_USE = /asr_landuse|county use code|^[A-Z0-9\s\-/.,+&()>]+$/;

function displayProblems(a, ui) {
  const problems = [];
  if (!/\b\d{5}\b/.test(ui.cityLine ?? "")) problems.push(`no ZIP in "${ui.cityLine}"`);
  if (/\b0\d+(st|nd|rd|th)\b/i.test(ui.h2 ?? "")) problems.push(`zero-padded ordinal "${ui.h2}"`);
  if (/\b[A-Z]{3,}\b/.test(ui.h2 ?? "")) problems.push(`all-caps word "${ui.h2}"`);
  if (/\.\s*$/.test(ui.h2 ?? "")) problems.push(`trailing period "${ui.h2}"`);
  if (!/^\d/.test(ui.h2 ?? "")) problems.push(`no house number "${ui.h2}"`);
  if (ui.use && RAW_USE.test(ui.use)) problems.push(`raw use text "${ui.use}"`);
  if (!ui.use) problems.push("no use chip");
  return problems;
}

async function readPanel(page) {
  return page.evaluate(() => {
    const aside = document.querySelector("aside[aria-label^='Housing laws at']");
    const h2 = aside?.querySelector("h2");
    const facts = [...(aside?.querySelectorAll("ul[aria-label^='Building facts'] li") ?? [])].map((li) => ({
      label: li.querySelector(".eyebrow")?.textContent?.trim() ?? "",
      value: li.dataset.value ?? li.textContent?.replace(li.querySelector(".eyebrow")?.textContent ?? "", "").trim() ?? "",
    }));
    const marker = document.querySelector("gmp-marker-3d");
    const map = document.querySelector("gmp-map-3d");
    const center = map?.center ? { lat: map.center.lat, lng: map.center.lng, range: map.range } : null;
    const text = document.body.innerText;
    return {
      h2: h2?.textContent?.trim() ?? null,
      cityLine: h2?.nextElementSibling?.textContent?.trim() ?? null,
      nav: aside?.querySelector("nav[aria-label='Jurisdiction']")?.textContent?.trim() ?? null,
      unconfirmed: text.includes("Legal city not confirmed"),
      rules: aside?.querySelectorAll("li > button[aria-controls]").length ?? 0,
      use: facts.find((f) => f.label.toLowerCase() === "use")?.value ?? null,
      facts,
      hasMap: !!document.querySelector("gmp-map-3d"),
      plate: text.includes("3D imagery unavailable"),
      camera: center,
      marker: marker?.position ? { lat: marker.position.lat, lng: marker.position.lng } : null,
      alert: document.querySelector("[role='alert']")?.textContent?.trim() ?? null,
      errorText: /something went wrong|couldn.t place this address/i.test(text),
    };
  });
}

async function ringStats(decoder, png, mapWidth) {
  return decoder.evaluate(
    async ({ b64, mapWidth, rgb, tol }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, mapWidth, img.height);
      let n = 0, sx = 0, sy = 0;
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < mapWidth; x++) {
          const i = (y * mapWidth + x) * 4;
          if (Math.abs(data[i] - rgb[0]) < tol && Math.abs(data[i + 1] - rgb[1]) < tol && Math.abs(data[i + 2] - rgb[2]) < tol) {
            n++; sx += x; sy += y;
          }
        }
      return { pixels: n, cx: n ? sx / n / mapWidth : null, cy: n ? sy / n / img.height : null };
    },
    { b64: png.toString("base64"), mapWidth, rgb: RING_RGB, tol: RING_TOLERANCE },
  );
}

async function checkOne(context, a, { camera, decoder }) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  const started = Date.now();
  const issues = [];
  let ui = null;
  let ring = null;
  try {
    await page.goto(`${BASE}/?a=${a.address_id}&asOf=${AS_OF}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=/\\d+ enacted ·/", { timeout: PANEL_WAIT_MS });
    await page.waitForTimeout(camera ? CAMERA_SETTLE_MS : 600);
    ui = await readPanel(page);
    const expected = evaluate(a, AS_OF).length;
    if (ui.h2 !== a.street_address) issues.push(`headline "${ui.h2}" != "${a.street_address}"`);
    if (a.legal_city) {
      if (!ui.nav?.includes(a.legal_city)) issues.push(`jurisdiction "${ui.nav}" lacks ${a.legal_city}`);
    } else if (!ui.unconfirmed) issues.push("missing 'Legal city not confirmed' state");
    if (ui.rules < 1) issues.push("no rules rendered");
    if (ui.rules !== expected) issues.push(`rendered ${ui.rules} rules, engine says ${expected}`);
    if (ui.alert || ui.errorText) issues.push(`error text: ${ui.alert ?? "inline"}`);
    if (!ui.hasMap) issues.push("no 3D map element");
    if (ui.plate) issues.push("fallback survey plate shown");
    if (!ui.marker) issues.push("no map marker");
    else if (a.lat != null && (Math.abs(ui.marker.lat - a.lat) > 1e-4 || Math.abs(ui.marker.lng - a.lng) > 1e-4)) issues.push("marker not at address lat/lng");
    if (ui.marker && ui.camera) {
      const off = Math.hypot(ui.camera.lat - ui.marker.lat, ui.camera.lng - ui.marker.lng);
      if (off > CAMERA_MAX_OFFSET_DEG || ui.camera.range > CAMERA_MAX_RANGE_M) issues.push(`camera not at building (${off.toFixed(4)}° away, range ${Math.round(ui.camera.range)} m)`);
    }
    if (camera) {
      const png = await page.screenshot();
      const panelWidth = await page.evaluate(() => document.querySelector("aside")?.getBoundingClientRect().width ?? 0);
      ring = await ringStats(decoder, png, Math.round(VIEWPORT.width - panelWidth));
      mkdirSync(SHOTS, { recursive: true });
      writeFileSync(`${SHOTS}/${a.address_id}.png`, png);
      const inFrame = ring.pixels >= RING_MIN_PIXELS && ring.cx > 0.2 && ring.cx < 0.8 && ring.cy > 0.2 && ring.cy < 0.8;
      if (!inFrame) issues.push(`ring not in frame (${ring.pixels}px at ${ring.cx?.toFixed(2)},${ring.cy?.toFixed(2)})`);
    }
  } catch (e) {
    issues.push(`failed: ${e.message.split("\n")[0]}`);
  }
  if (consoleErrors.length) issues.push(`${consoleErrors.length} console error(s)`);
  await page.close();
  const display = ui ? displayProblems(a, ui) : [];
  return {
    id: a.address_id,
    city: a.legal_city ?? `${a.postal_city} (unconfirmed)`,
    ok: issues.length === 0,
    issues,
    display,
    ms: Date.now() - started,
    ui: ui && { camera: ui.camera, h2: ui.h2, cityLine: ui.cityLine, nav: ui.nav, rules: ui.rules, use: ui.use, facts: ui.facts.map((f) => `${f.label}: ${f.value}`) },
    ring,
    consoleErrors,
  };
}

async function runPool(items, fn) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
        done++;
        if (done % 25 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
  return results;
}

function seededSample(list, n) {
  let s = 20261001;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  return [...list].sort(() => rand() - 0.5).slice(0, n);
}

function summarize(results) {
  const issueCounts = {};
  for (const r of results) for (const i of [...r.issues, ...r.display]) {
    const key = i.replace(/".*?"/g, '"…"').replace(/\d+/g, "N");
    issueCounts[key] = (issueCounts[key] ?? 0) + 1;
  }
  return { total: results.length, passed: results.filter((r) => r.ok).length, displayClean: results.filter((r) => !r.display.length).length, issueCounts };
}

const ids = IDS ? new Set(IDS.split(",")) : null;
let targets = ids ? ADDRESSES.filter((a) => ids.has(a.address_id)) : ADDRESSES;
if (LIMIT) targets = targets.slice(0, LIMIT);

const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: VIEWPORT });
const motion = await browser.newContext({ reducedMotion: "no-preference", viewport: VIEWPORT });
const decoder = await motion.newPage();

console.log(`Checking ${targets.length} addresses at ${BASE} (reduced motion, ${CONCURRENCY} at a time)`);
const results = await runPool(targets, (a) => checkOne(reduced, a, { camera: false }));

const cameraTargets = seededSample(targets.filter((a) => a.lat != null), CAMERA_COUNT);
console.log(`Camera check on ${cameraTargets.length} addresses at full motion`);
const cameraResults = await runPool(cameraTargets, (a) => checkOne(motion, a, { camera: true, decoder }));
await browser.close();

const report = {
  base: BASE,
  asOf: AS_OF,
  ranAt: new Date().toISOString(),
  summary: summarize(results),
  camera: { ...summarize(cameraResults), screenshots: SHOTS },
  failures: results.filter((r) => !r.ok || r.display.length),
  cameraFailures: cameraResults.filter((r) => !r.ok),
  results,
  cameraResults,
};
mkdirSync(OUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ summary: report.summary, camera: report.camera }, null, 2));
