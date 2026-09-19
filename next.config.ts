import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  /* Legacy workspace routes from before the IA reset (Review → Decisions,
     Evidence → Sources). Deliberately TEMPORARY (307): the IA is still
     evolving, and a permanent redirect is cached by browsers and crawlers
     long after it stops being true. Promote to permanent only once the new
     IA has proven stable in production. Query strings are carried through. */
  async redirects() {
    return [
      {
        source: "/initiatives/:slug/review",
        destination: "/initiatives/:slug/decisions",
        permanent: false,
      },
      {
        source: "/initiatives/:slug/evidence/:path*",
        destination: "/initiatives/:slug/sources/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
