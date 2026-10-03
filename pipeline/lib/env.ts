import path from "node:path";
import { config } from "dotenv";
import { ROOT } from "./corpus";

config({ path: path.join(ROOT, ".env.local"), quiet: true });

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY missing from realpage/.env.local");
}
