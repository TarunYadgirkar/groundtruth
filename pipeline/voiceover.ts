import "./lib/env";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/corpus";

// Narrates the captioned submission videos with ElevenLabs and muxes the audio in.
// Usage: npx tsx pipeline/voiceover.ts [voice name]
const KEY = process.env.ELEVENLABS_API_KEY;
const VIDEOS = path.join(ROOT, "assets/generated/videos");
const WORK = path.join(VIDEOS, "vo");
const MODEL = "eleven_multilingual_v2";
const MAX_TEMPO = 1.2;

interface Line {
  at: number;
  until: number;
  text: string;
}

const SCRIPTS: Record<string, { duration: number; lines: Line[] }> = {
  demo: {
    duration: 56.4,
    lines: [
      { at: 0.3, until: 5.1, text: "Which rental housing laws apply at this address, on any date? This is Groundtruth." },
      { at: 5.4, until: 18.0, text: "Type an address and we fly in from orbit. Groundtruth resolves the legal jurisdiction from Census boundaries, not just the mailing city, and tests every rule against this building's facts." },
      { at: 18.4, until: 24.3, text: "Every rule cites its exact source text. Missing facts mean unknown, never a guess." },
      { at: 24.6, until: 30.6, text: "Jump to July 2027: New Jersey's FAIR Act kicks in, flagged against Hoboken's own ban." },
      { at: 30.9, until: 37.2, text: "Next, a building in Boston that's mailed as Dorchester." },
      { at: 37.5, until: 42.2, text: "Legally Boston, and no rent cap: Massachusetts struck its ballot question." },
      { at: 42.5, until: 49.1, text: "Paste a new ordinance. Claude extracts it, verifies the quote, and applies it to five hundred buildings." },
      { at: 49.5, until: 56.2, text: "Forty-eight buildings affected, each with its source. Groundtruth. Not legal advice." },
    ],
  },
  tech: {
    duration: 55.53,
    lines: [
      { at: 0.3, until: 7.9, text: "Claude Opus 5.5 reads seventy law documents and returns two hundred candidate rules as structured outputs, validated with Zod." },
      { at: 8.2, until: 13.3, text: "Every quote is checked word for word against its source. All two hundred matched." },
      { at: 13.6, until: 19.3, text: "Duplicates merge into fifty-five rules. Then a deterministic engine, with no AI, applies coverage, dates and precedence." },
      { at: 19.5, until: 26.5, text: "The five change tests run on that same engine, down to zero hits for Massachusetts' struck ballot question." },
      { at: 26.8, until: 34.3, text: "The hard part: public records often lack units, year built or owner type. We infer units from assessor codes, otherwise we say unknown." },
      { at: 34.6, until: 38.0, text: "That logic lives right here in the engine." },
      { at: 38.2, until: 43.9, text: "What didn't work: a code publisher blocked capture, so Hoboken and Newark rent control is a known gap." },
      { at: 44.2, until: 55.3, text: "An independent audit of twenty-seven addresses took precision and recall from point nine two to point nine eight. Built with Next.js, Google 3D Maps, and Claude." },
    ],
  },
};

const PREFERRED_VOICES = ["George", "Brian", "Daniel", "Adam", "Rachel"];

async function pickVoice(wanted?: string): Promise<{ id: string; name: string }> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY! } });
  if (!res.ok) throw new Error(`voices ${res.status}: ${await res.text()}`);
  const voices: { voice_id: string; name: string }[] = (await res.json()).voices;
  const order = wanted ? [wanted, ...PREFERRED_VOICES] : PREFERRED_VOICES;
  for (const name of order) {
    const v = voices.find((x) => x.name.toLowerCase().startsWith(name.toLowerCase()));
    if (v) return { id: v.voice_id, name: v.name };
  }
  return { id: voices[0].voice_id, name: voices[0].name };
}

async function tts(voiceId: string, text: string, file: string): Promise<void> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY!, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const probe = (file: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

async function narrate(name: string, voiceId: string): Promise<void> {
  const { lines, duration } = SCRIPTS[name];
  const parts: { file: string; at: number; tempo: number }[] = [];
  for (const [i, line] of lines.entries()) {
    const file = path.join(WORK, `${name}-${i}.mp3`);
    await tts(voiceId, line.text, file);
    const len = probe(file);
    const slot = line.until - line.at;
    const tempo = len > slot ? Math.min(MAX_TEMPO, len / slot) : 1;
    if (len / tempo > slot + 0.4) console.warn(`${name} line ${i} runs long: ${len.toFixed(2)}s for a ${slot.toFixed(2)}s slot`);
    parts.push({ file, at: line.at, tempo });
  }

  const inputs = parts.flatMap((p) => ["-i", p.file]);
  const chains = parts.map((p, i) => `[${i + 1}:a]atempo=${p.tempo.toFixed(3)},adelay=${Math.round(p.at * 1000)}:all=1[a${i}]`);
  const mix = `${parts.map((_, i) => `[a${i}]`).join("")}amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${duration},loudnorm=I=-16:TP=-1.5[aout]`;
  const src = path.join(VIDEOS, `${name}.mp4`);
  const out = path.join(VIDEOS, `${name}-vo.mp4`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, ...inputs, "-filter_complex", [...chains, mix].join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out]);
  console.log(`${name}: ${out} (${probe(out).toFixed(2)}s)`);
}

async function main(): Promise<void> {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY missing from realpage/.env.local");
  fs.mkdirSync(WORK, { recursive: true });
  const voice = await pickVoice(process.argv[2]);
  console.log(`voice: ${voice.name}`);
  for (const name of Object.keys(SCRIPTS)) await narrate(name, voice.id);
}

await main();
