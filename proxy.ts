import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Next 16 middleware (formerly middleware.ts). Gates the app plane; marketing
// stays public. Hostname routing (app.domain.com → app, domain.com → marketing)
// is added at deploy time — inert on single-host localhost.

const isProtected = createRouteMatcher(["/dashboard(.*)", "/platform(.*)"]);
const isSignIn = createRouteMatcher(["/signin(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();

  if (isProtected(request) && !authed) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
  if (isSignIn(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  // Guardrail #4: never run on static assets — keeps the marketing CDN path clean.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|woff2?|txt|xml)$).*)",
  ],
};
