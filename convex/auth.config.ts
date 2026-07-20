// Convex Auth issuer config. CONVEX_SITE_URL is set automatically on the
// deployment; the JWT signing keys are provisioned by `npx @convex-dev/auth`.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
