import { cookies } from "next/headers";

/**
 * Server-side JSON-RPC calls to the Blocks API.
 *
 * Two modes matter and must not be confused:
 *  - authenticated: forwards the caller's session cookie, so the backend derives
 *    ownerId from the verified session. Used for every owner-scoped read/write.
 *  - anonymous: sends no cookie. Used for public page reads, so a public page
 *    can never accidentally resolve through the viewer's own account.
 */

export class RpcError extends Error {
  readonly code: number;
  readonly rpcName?: string;

  constructor(message: string, code: number, rpcName?: string) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.rpcName = rpcName;
  }
}

function endpoint(): string {
  const configured = process.env.BLOCKS_RPC_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BLOCKS_RPC_URL must be set in production");
  }
  return "http://127.0.0.1:3000/aws-blocks/api";
}

export async function serverRpc<T>(
  method: string,
  params: unknown[] = [],
  options: { authenticated?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.authenticated) {
    const jar = await cookies();
    const all = jar.getAll();
    if (all.length === 0) throw new RpcError("Authentication required", 401);
    headers.cookie = all.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: `api.${method}`, params, id: 1 }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    result?: T;
    error?: { code?: number; message?: string; data?: { name?: string } };
  };
  if (payload.error) {
    throw new RpcError(
      payload.error.message ?? "Request failed",
      payload.error.code ?? 500,
      payload.error.data?.name,
    );
  }
  return payload.result as T;
}
