export function localAccountsAllowed(env = process.env) {
  if (env.CLOUD_LOCAL_ACCOUNTS !== "1") return false;
  if (env.NODE_ENV === "production" || env.CLOUD_ENV === "production") {
    throw new Error("CLOUD_LOCAL_ACCOUNTS cannot be enabled when NODE_ENV or CLOUD_ENV is production.");
  }
  return true;
}
