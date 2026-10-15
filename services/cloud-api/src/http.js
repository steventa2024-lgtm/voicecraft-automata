import { HttpError } from "./errors.js";

const JSON_LIMIT = 32_000;
const AUDIO_LIMIT = 2_000_000;
const REQUEST_MS = 20_000;

function limitFor(incoming) {
  const type = String(incoming.headers["content-type"] || "");
  if (String(incoming.url || "").startsWith("/api/mobile/transcribe") || type.includes("multipart/form-data")) {
    return AUDIO_LIMIT;
  }
  return JSON_LIMIT;
}

export function readIncoming(incoming) {
  const limit = limitFor(incoming);
  const declared = Number(incoming.headers["content-length"] || 0);
  if (Number.isFinite(declared) && declared > limit) {
    return Promise.reject(new HttpError(413, "The request is too large."));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => {
      incoming.destroy();
      reject(new HttpError(408, "The request timed out."));
    }, REQUEST_MS);
    incoming.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        clearTimeout(timer);
        incoming.destroy();
        reject(new HttpError(413, "The request is too large."));
        return;
      }
      chunks.push(chunk);
    });
    incoming.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    incoming.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
  });
}

export { JSON_LIMIT, AUDIO_LIMIT };
