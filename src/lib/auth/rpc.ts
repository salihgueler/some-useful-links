/**
 * Browser-side JSON-RPC call to the Blocks API.
 *
 * The endpoint is DISCOVERED, not hardcoded. Locally the Blocks dev server
 * serves the API at /aws-blocks/api on the same origin, but behind CloudFront
 * that path belongs to the SSR Lambda -- CloudFront routes the API elsewhere.
 * Hosting generates /.blocks-sandbox/config.json carrying the real apiUrl for
 * exactly this reason, so read it once and cache the result.
 *
 * If the config cannot be fetched we fall back to the same-origin path, which
 * is correct in local development.
 */

const FALLBACK_PATH = "/aws-blocks/api";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/**
 * The dev server reports its own hostname (usually `localhost`), which is a
 * DIFFERENT ORIGIN from `127.0.0.1` as far as the browser is concerned -- using
 * it verbatim turns a same-origin call into a blocked cross-origin one. So for
 * a loopback config, keep the path and use the origin the page is actually on.
 */
function normalise(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl, window.location.origin);
    if (parsed.origin === window.location.origin) return parsed.toString();
    if (LOOPBACK.has(parsed.hostname)) return parsed.pathname;
    return parsed.toString();
  } catch {
    return FALLBACK_PATH;
  }
}

let cachedEndpoint: Promise<string> | null = null;

function resolveEndpoint(): Promise<string> {
  cachedEndpoint ??= fetch("/.blocks-sandbox/config.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((config: { apiUrl?: unknown } | null) =>
      typeof config?.apiUrl === "string" && config.apiUrl.length > 0
        ? normalise(config.apiUrl)
        : FALLBACK_PATH,
    )
    .catch(() => FALLBACK_PATH);
  return cachedEndpoint;
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = await resolveEndpoint();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The session cookie must ride along even when the API is on another origin.
    credentials: "include",
    body: JSON.stringify({ jsonrpc: "2.0", method: `api.${method}`, params, id: 1 }),
  });
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (payload.error) throw new Error(payload.error.message ?? "Request failed");
  return payload.result as T;
}
