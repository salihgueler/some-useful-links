import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Static security headers.
 *
 * The Content-Security-Policy is NOT here: it needs a per-request nonce, so it
 * is issued by src/proxy.ts. Setting it in both places would send two CSP
 * headers, and browsers enforce every one they receive -- the intersection would
 * break the app.
 */
const securityHeaders = [
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
  // Development only: the Blocks dev server fronts the app on :3000 and proxies
  // to Next on :3100. Next 16 rejects cross-origin dev asset requests with 403,
  // which breaks hydration behind that proxy. Has no effect on a production
  // build, where CloudFront serves one origin.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
