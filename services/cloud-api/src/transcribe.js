import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { HttpError } from "./errors.js";

const MAX_AUDIO = 2_000_000;

export function readAudioUpload(bytes, contentType) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_AUDIO) {
    throw new HttpError(413, "The recording is empty or larger than 2 MB.");
  }
  const type = String(contentType || "");
  if (!type.includes("multipart/form-data")) {
    throw new HttpError(400, "Send the recording as multipart form data.");
  }
  const match = type.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (!match) throw new HttpError(400, "The upload is missing a multipart boundary.");
  const boundary = `--${match[1] || match[2]}`;
  const raw = bytes.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);
  const part = parts.find((item) => /name="audio"/i.test(item));
  if (!part) throw new HttpError(400, "The upload is missing the audio field.");
  const splitAt = part.indexOf("\r\n\r\n");
  if (splitAt < 0) throw new HttpError(400, "The audio upload is malformed.");
  const header = part.slice(0, splitAt);
  if (!/audio\/(mp4|m4a|wav|mpeg|webm|x-m4a)/i.test(header)) {
    throw new HttpError(400, "Use an m4a, wav, or webm recording.");
  }
  let body = part.slice(splitAt + 4);
  if (body.endsWith("\r\n")) body = body.slice(0, -2);
  const audio = Buffer.from(body, "latin1");
  if (audio.length < 64) throw new HttpError(400, "The recording is too short to transcribe.");
  return audio;
}

export async function transcribeWithWhisper(audio) {
  const bin = process.env.WHISPER_CPP || "";
  const model = process.env.WHISPER_MODEL || "";
  if (!bin || !model) {
    throw new HttpError(503, "Speech transcription is not installed on this server. Type the build request instead.");
  }
  const directory = mkdtempSync(path.join(tmpdir(), "zp-audio-"));
  const file = path.join(directory, `${randomUUID()}.wav`);
  try {
    writeFileSync(file, audio);
    const text = await new Promise((resolve, reject) => {
      const child = spawn(bin, ["-m", model, "-f", file, "-otxt", "-of", file, "-nt"], { timeout: 20_000 });
      let error = "";
      child.stderr.on("data", (chunk) => {
        error += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) reject(new HttpError(502, "Transcription failed. Type the build request instead."));
        else resolve(error);
      });
    });
    const { readFileSync } = await import("node:fs");
    const transcript = readFileSync(`${file}.txt`, "utf8").trim();
    if (!transcript) throw new HttpError(422, "No speech was detected. Try again or type the request.");
    return transcript.slice(0, 500);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Speech transcription is not available. Type the build request instead.");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void transcribeWithWhisper;
