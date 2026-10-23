import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request CSP nonce.
 *
 * This file exists ONLY to issue a nonce and set the Content-Security-Policy.
 * It deliberately enforces no authorization: that lives in server components and
 * route handlers (requireOwnerPage / requireOwnerApi), because middleware can
 * only inspect a cookie cheaply and cannot tell a valid session from a forged
 * one without calling the backend.
 *
 * Why a nonce at all: `script-src 'unsafe-inline'` accepts any injected script
 * tag, which is the one directive that would otherwise stop an XSS payload from
 * executing. Next.js emits inline bootstrap scripts, so the only way to drop
 * 'unsafe-inline' is to nonce them -- Next attaches the nonce to its own script
 * tags automatically when it sees one in the request's CSP header.
 *
 * 'strict-dynamic' lets those nonced scripts load Next's chunk files without
 * listing every URL. CSP2 browsers ignore it and fall back to 'self' + nonce.
 *
 * The CSP lives here rather than in next.config.ts because a nonce has to be
 * generated per request. next.config.ts still owns the static headers; two CSP
 * headers would both be enforced and break the app.
 */

const isDev = process.env.NODE_ENV !== "production";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // The share card is drawn on a canvas and its QR code is a data: URL.
    "img-src 'self' data:",
    // next/font self-hosts Manrope at build time.
    "font-src 'self'",
    // React and recharts set inline styles; there is no nonce path for those.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self'${isDev ? " ws:" : ""}`,
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Next reads the nonce from the CSP header on the REQUEST and applies it to
  // the scripts it renders, so it has to be set on both request and response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Static assets carry no inline scripts and are cached, so a per-request
  // nonce on them would only defeat caching.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
