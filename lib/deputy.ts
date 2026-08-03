export const DEPUTY_OAUTH_AUTHORIZE_URL =
  "https://once.deputy.com/my/oauth/login"
export const DEPUTY_OAUTH_TOKEN_URL =
  "https://once.deputy.com/my/oauth/access_token"

export const DEPUTY_SYNC_LOOKBACK_DAYS = 1
export const DEPUTY_SYNC_LOOKAHEAD_DAYS = 31
export const DEPUTY_SYNC_MAX_ROSTERS = 500

export function normalizeDeputyEndpoint(value: string) {
  const candidate = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
  try {
    const url = new URL(`https://${candidate}`)
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.endsWith(".deputy.com") ||
      url.hostname === "deputy.com"
    ) {
      return null
    }
    return url.hostname
  } catch {
    return null
  }
}
