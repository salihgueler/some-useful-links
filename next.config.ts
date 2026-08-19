import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 *
 * `script-src` still needs 'unsafe-inline' because Next.js injects inline
 * bootstrap scripts and this app does not yet issue a per-request nonce. The
 * nonce belongs in the proxy, which is being rewritten for authentication in
 * the next phase -- doing it here first would be thrown away. Everything else
 * is locked down, so this is a real reduction in blast radius rather than a
 * placebo: no framing, no plugins, no form posts off-origin, no base-tag
 * hijack.
 *
 * Notes on the allowances that are not obvious:
 * - img-src data:  the share card is drawn on a canvas and the QR code is
 *   generated as a data: URL by the qrcode package.
 * - style-src 'unsafe-inline'  React and recharts set inline styles.
 * - font-src 'self'  next/font self-hosts Manrope at build time, so no
 *   external font origin is required.
 * - dev only: webpack HMR needs 'unsafe-eval' and a websocket connection.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws:" : ""}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Only meaningful over HTTPS; omitted in development to avoid pinning
  // localhost to https in the browser's HSTS store.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  devIndicators: false,
  // Do not advertise the framework and version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
