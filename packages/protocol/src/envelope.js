import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";
import { PROTOCOL_VERSION } from "./limits.js";
import { canonicalJson } from "./security.js";
import { sanitizeInstruction } from "./schema.js";

const envelopeSchema = z
  .object({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string().uuid(),
    jobId: z.string().uuid(),
    deviceId: z.string().min(8).max(120),
    action: z.enum(["command", "approve", "pair"]),
    instruction: z.unknown().optional(),
    iat: z.number().int(),
    exp: z.number().int(),
    nonce: z.string().min(16).max(128),
    signature: z.string().min(20).max(200).optional(),
  })
  .strict();

export function envelopeSigningBytes(envelope) {
  const { signature: _signature, ...rest } = envelope;
  return Buffer.from(canonicalJson(rest));
}

export function verifyCommandEnvelope(input, options) {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "malformed_envelope", message: "Command envelope is malformed." };
  }
  const envelope = parsed.data;
  const now = options.now ?? Date.now();
  if (envelope.exp <= now || envelope.iat > now + 30_000) {
    return { ok: false, code: "expired_envelope", message: "Command envelope has expired." };
  }
  if (envelope.exp - envelope.iat > 120_000) {
    return { ok: false, code: "expired_envelope", message: "Command envelope lifetime is too long." };
  }
  if (options.seenNonces?.has(envelope.nonce)) {
    return { ok: false, code: "replayed_command", message: "Command was already processed." };
  }
  if (options.expectedDeviceId && envelope.deviceId !== options.expectedDeviceId) {
    return { ok: false, code: "device_mismatch", message: "Command is not bound to the approved device." };
  }
  if (options.publicKeyPem) {
    const signature = String(input.signature || "");
    if (!signature) return { ok: false, code: "missing_signature", message: "Command signature is missing." };
    const key = createPublicKey(options.publicKeyPem);
    const valid = verifySignature(null, envelopeSigningBytes(input), key, Buffer.from(signature, "base64url"));
    if (!valid) return { ok: false, code: "bad_signature", message: "Command signature is invalid." };
  }
  let instruction = null;
  if (envelope.action !== "pair") {
    const sanitized = sanitizeInstruction(envelope.instruction, {
      allowApproved: envelope.action === "approve",
    });
    if (!sanitized.ok) {
      return { ok: false, code: "invalid_instruction", message: sanitized.errors.join(" ") };
    }
    instruction = sanitized.instruction;
    if (envelope.action === "approve") instruction = { ...instruction, approved: true };
  }
  options.seenNonces?.add(envelope.nonce);
  return { ok: true, envelope, instruction };
}

export function fingerprintPublicKey(pem) {
  return createHash("sha256").update(String(pem)).digest("hex").slice(0, 16);
}
