import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const credentials = atob(authorization.slice(6));
    const separator = credentials.indexOf(":");
    const suppliedPassword = credentials.slice(separator + 1);
    if (suppliedPassword === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Some Useful Links Admin"' },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/analytics/:path*",
    "/api/pages/:path*",
  ],
};
