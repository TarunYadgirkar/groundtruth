import { chromium } from "playwright";

const [base, address, shot] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text().slice(0, 200)));
await page.goto(base, { waitUntil: "networkidle" });
const input = page.getByPlaceholder("Enter an apartment address");
await input.fill(address);
await input.press("Enter");
const button = page.getByRole("button", { name: /law live \(beta\)/ });
const deadline = Date.now() + 60_000;
while (Date.now() < deadline && !(await button.isVisible().catch(() => false))) {
  const skip = page.getByRole("button", { name: /^Skip/ });
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
  await page.waitForTimeout(500);
}
if (!(await button.isVisible())) {
  console.log("no research button; page text:", (await page.locator("body").innerText()).slice(0, 600));
  await page.screenshot({ path: shot });
  await browser.close();
  process.exit(1);
}
console.log("button:", await button.innerText());
const t0 = Date.now();
await button.click();
const section = page.locator("section[aria-labelledby=live-research-title]");
const stages = new Set();
for (;;) {
  const text = await section.innerText().catch(() => "");
  const stage = text.match(/(Searching official sources|Reading \d+ pages?|Verifying quotes|Applying to this building)/g);
  if (stage) stages.add(stage.join(" | "));
  if (/verified against|Couldn.t verify/.test(text) || Date.now() - t0 > 240_000) break;
  await page.waitForTimeout(1000);
}
console.log("seconds:", ((Date.now() - t0) / 1000).toFixed(1));
console.log("summary:", (await section.innerText()).split("\n").slice(0, 3).join(" / "));
const cards = section.locator("li");
const n = await cards.count();
for (let i = 0; i < n; i++) {
  const t = (await cards.nth(i).innerText()).split("\n").filter(Boolean);
  console.log(`- ${t.slice(0, 4).join(" | ").slice(0, 220)}`);
}
console.log("badges:", await section.getByText("Live research · unverified by counsel").count(), "verified marks:", await section.getByText("Quote found on fetched page").count());
await section.screenshot({ path: shot }).catch(() => page.screenshot({ path: shot }));
await browser.close();
