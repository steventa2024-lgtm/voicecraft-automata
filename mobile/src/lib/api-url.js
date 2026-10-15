function isPrivateLan(hostname) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function isAllowedCloudUrl(value, { dev = false } = {}) {
  try {
    const url = new URL(String(value || ""));
    if (url.username || url.password) return false;
    const example = url.hostname === "example.com" || url.hostname.endsWith(".example.com");
    if (url.protocol === "https:" && !example) return true;
    if (!dev || url.protocol !== "http:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || isPrivateLan(url.hostname);
  } catch {
    return false;
  }
}
