import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "./auth.server";

export type DownloadKind = "java" | "bedrock";

const DOWNLOADS: Record<DownloadKind, { envKey: string; filename: string }> = {
  java: { envKey: "R2_JAVA_OBJECT_KEY", filename: "ZeroPulseCompanion-win32-x64.zip" },
  bedrock: { envKey: "R2_BEDROCK_OBJECT_KEY", filename: "ZeroPulseBedrockGateway.zip" },
};

function configuredObjectKey(kind: DownloadKind): string {
  return process.env[DOWNLOADS[kind].envKey] || `releases/${DOWNLOADS[kind].filename}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function signingKey() {
  const secret =
    process.env["DOWNLOAD_SIGNING_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!secret) throw new ApiError(503, "download_unconfigured", "Secure downloads are not configured.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function localSignature(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createProtectedDownloadUrl(
  kind: DownloadKind,
  userId: string,
  request: Request,
): Promise<string> {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET"];
  const objectKey = configuredObjectKey(kind);

  if (accountId && accessKeyId && secretAccessKey && bucket) {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${DOWNLOADS[kind].filename}"`,
      }),
      { expiresIn: 120 },
    );
  }

  if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storageBucket = process.env["SUPABASE_DOWNLOAD_BUCKET"] || "zeropulse-releases";
    const { data, error } = await supabaseAdmin.storage
      .from(storageBucket)
      .createSignedUrl(objectKey, 120, { download: DOWNLOADS[kind].filename });
    if (error || !data?.signedUrl) {
      console.error(`[Downloads] Protected ${kind} object unavailable`, error?.message || "missing signed URL");
      throw new ApiError(503, "download_missing", "This protected download is not available yet.");
    }
    return data.signedUrl;
  }

  const expires = Math.floor(Date.now() / 1000) + 120;
  const payload = `${kind}.${userId}.${expires}`;
  const signature = await localSignature(payload);
  const url = new URL(`/api/download-files/${kind}`, request.url);
  url.searchParams.set("user", userId);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature);
  return url.toString();
}

export async function serveLocalDownload(kind: DownloadKind, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user") || "";
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  if (!userId || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    throw new ApiError(403, "download_link_expired", "This download link expired. Request a new one.");
  }
  const payload = `${kind}.${userId}.${expires}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    base64UrlToBytes(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) throw new ApiError(403, "invalid_download_link", "This download link is invalid.");

  const [{ createReadStream }, { stat }, { Readable }, path] = await Promise.all([
    import("node:fs"),
    import("node:fs/promises"),
    import("node:stream"),
    import("node:path"),
  ]);
  const downloadsRoot = path.resolve(process.cwd(), "private", "downloads");
  const filePath = path.resolve(downloadsRoot, DOWNLOADS[kind].filename);
  if (path.dirname(filePath) !== downloadsRoot) {
    throw new ApiError(500, "invalid_download_path", "The protected download path is invalid.");
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new ApiError(503, "download_missing", "This download is not available on the local server.");
  }
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-length": String(fileStat.size),
      "content-disposition": `attachment; filename="${DOWNLOADS[kind].filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
