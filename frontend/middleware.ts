import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/test", "/result", "/admin", "/dashboard"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;

  // Root path: send to sign-in always (sign-in page handles redirect if already authenticated)
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Protected routes: require a token cookie, else redirect to sign-in
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !accessToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/test/:path*", "/result/:path*", "/admin/:path*", "/dashboard/:path*", "/dashboard"],
};
