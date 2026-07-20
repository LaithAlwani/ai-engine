import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

// Convex Auth's HTTP routes + the Google OAuth callback. (Twilio webhook routes
// get added here in the SMS slice.)
const http = httpRouter();
auth.addHttpRoutes(http);

// Google redirects here after consent. The signed `state` proves which
// business + staff to connect; we exchange the code and bounce back to the app.
http.route({
  path: "/google/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");
    const appUrl = process.env.SITE_URL ?? "http://localhost:3000";

    if (err || !code || !state) {
      return Response.redirect(`${appUrl}/dashboard?google=error`, 302);
    }
    try {
      const { slug } = await ctx.runAction(internal.google.completeConnect, {
        code,
        state,
      });
      return Response.redirect(
        `${appUrl}/dashboard/${slug}/schedule?google=connected`,
        302,
      );
    } catch {
      return Response.redirect(`${appUrl}/dashboard?google=error`, 302);
    }
  }),
});

export default http;
