export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login
     * - /api/auth (next-auth internals)
     * - /_next (static assets)
     * - /favicon.ico
     */
    "/((?!login|api/auth|_next|favicon.ico).*)",
  ],
};
