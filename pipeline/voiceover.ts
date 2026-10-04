import "./lib/env";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/corpus";

// Narrates the captioned submission videos with ElevenLabs and muxes the audio in.
// Usage: npx tsx pipeline/voiceover.ts tts   (synthesize lines, print lengths)
//        npx tsx pipeline/voiceover.ts mux   (place lines at `at`, mux into <name>-vo.mp4)
const KEY = process.env.ELEVENLABS_API_KEY;
const VIDEOS = path.join(ROOT, "assets/generated/videos");
const WORK = path.join(VIDEOS, "vo");
const MODEL = "eleven_multilingual_v2";
const VOICE = "George";
const TEMPO: Record<string, number> = { demo: 1.05, tech: 1.1 };

interface Line {
  at: number;
  text: string;
}

const SCRIPTS: Record<string, Line[]> = {
  demo: [
    { at: 0.3, text: "Your landlord says rent goes up ten percent next month. Is that legal? It depends on your state, your city, and your building." },
    { at: 8, text: "Type an address. Groundtruth resolves the legal city, not just the mailing city." },
    { at: 14.55, text: "Every rule shows its exact source text and the date it was retrieved." },
    { at: 19.2, text: "Missing facts show as unknown, with the missing fact named." },
    { at: 23.8, text: "Change the date and the answer changes: San Francisco's increase goes from one point four to one point six percent." },
    { at: 31.48, text: "In Los Angeles, ask it the way a tenant would." },
    { at: 38.65, text: "Claude is instructed to answer from the cited rules, and it cites the ones it used." },
    { at: 44, text: "Paste a new law, like this fictional Cambridge sample: forty-eight of five hundred buildings affected, each with its source." },
    { at: 51.92, text: "Groundtruth. Which housing laws apply, at any address, on any date. Not legal advice." },
  ],
  tech: [
    { at: 0.15, text: "Claude Opus 5.5 reads seventy-three law documents and extracts two hundred six candidate rules, validated with Zod." },
    { at: 8.2, text: "Every quote is checked word for word against its source. All two hundred six matched." },
    { at: 13.5, text: "That leaves fifty-nine rules, applied by a deterministic engine with no AI." },
    { at: 18.5, text: "The five change tests run on that same engine." },
    { at: 22.1, text: "Hard part: records often lack units or year built. Units come from assessor codes, or the answer is unknown." },
    { at: 29.1, text: "Rates carry verified date ranges, so answers change with the date." },
    { at: 33.45, text: "What didn't work: ecode360 refused automated access, so Hoboken and Newark rent control come from official city PDFs." },
    { at: 42.1, text: "An AI-assisted audit of twenty-seven sample addresses took precision and recall from point nine two to point nine eight. That sample guided the fixes, so it is not an official score." },
    { at: 53.1, text: "Built with Next.js, Google 3D Maps, and Claude." },
  ],
};

async function voiceId(): Promise<string> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY! } });
  if (!res.ok) throw new Error(`voices ${res.status}: ${await res.text()}`);
  const voices: { voice_id: string; name: string }[] = (await res.json()).voices;
  const v = voices.find((x) => x.name.toLowerCase().startsWith(VOICE.toLowerCase()));
  if (!v) throw new Error(`voice ${VOICE} not found`);
  return v.voice_id;
}

async function tts(id: string, text: string, file: string): Promise<void> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY!, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const probe = (file: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
const lineFile = (name: string, i: number) => path.join(WORK, `${name}-${i}.mp3`);

async function synthesize(): Promise<void> {
  const id = await voiceId();
  for (const [name, lines] of Object.entries(SCRIPTS)) {
    for (const [i, line] of lines.entries()) {
      const file = lineFile(name, i);
      const stamp = `${file}.txt`;
      if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== line.text) {
        await tts(id, line.text, file);
        fs.writeFileSync(stamp, line.text);
      }
      console.log(`${name}[${i}] ${probe(file).toFixed(2)}s  ${line.text}`);
    }
  }
}

function mux(name: string): void {
  const lines = SCRIPTS[name];
  const src = path.join(VIDEOS, `${name}.mp4`);
  const out = path.join(VIDEOS, `${name}-vo.mp4`);
  const duration = probe(src);
  for (const [i, line] of lines.entries()) {
    const end = line.at + probe(lineFile(name, i)) / TEMPO[name];
    const next = lines[i + 1]?.at ?? duration;
    if (end > next) throw new Error(`${name}[${i}] ends at ${end.toFixed(2)}s, after ${next.toFixed(2)}s`);
  }
  const inputs = lines.flatMap((_, i) => ["-i", lineFile(name, i)]);
  const chains = lines.map((l, i) => `[${i + 1}:a]atempo=${TEMPO[name]},adelay=${Math.round(l.at * 1000)}:all=1[a${i}]`);
  const mix = `${lines.map((_, i) => `[a${i}]`).join("")}amix=inputs=${lines.length}:normalize=0,apad,atrim=0:${duration},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, ...inputs, "-filter_complex", [...chains, mix].join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]);
  console.log(`${name}: ${out} (${probe(out).toFixed(2)}s)`);
}

async function main(): Promise<void> {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY missing");
  fs.mkdirSync(WORK, { recursive: true });
  const step = process.argv[2];
  if (step === "tts") return synthesize();
  if (step === "mux") return (process.argv[3] ? [process.argv[3]] : Object.keys(SCRIPTS)).forEach(mux);
  throw new Error("usage: voiceover.ts tts|mux");
}

await main();
