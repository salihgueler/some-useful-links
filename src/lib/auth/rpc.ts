/**
 * Browser-side JSON-RPC call to the Blocks API.
 *
 * The URL is relative on purpose: the Blocks dev server fronts Next locally and
 * CloudFront routes the path in production, so the session cookie stays
 * first-party in both.
 */
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch("/aws-blocks/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: `api.${method}`, params, id: 1 }),
  });
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (payload.error) throw new Error(payload.error.message ?? "Request failed");
  return payload.result as T;
}
