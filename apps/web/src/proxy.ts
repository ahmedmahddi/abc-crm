import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const publicAuthPaths = new Set(["/forgot-password", "/logged-out", "/login", "/reset-password", "/session-expired"]);
  const isPublicAuthPage = publicAuthPaths.has(request.nextUrl.pathname);
  const hasAccessToken = request.cookies.has("access_token");
  const hasRefreshToken = request.cookies.has("refresh_token");
  const hasSessionCookie = hasAccessToken || hasRefreshToken;

  if (!hasSessionCookie && !isPublicAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|manifest.webmanifest|favicon.ico).*)"],
};
