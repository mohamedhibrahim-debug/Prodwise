import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  async redirects() {
    return [
      { source: "/initiatives/:slug/memory", destination: "/initiatives/:slug/knowledge", permanent: true },
      { source: "/initiatives/:slug/memory/new", destination: "/initiatives/:slug/knowledge/new", permanent: true },
      { source: "/initiatives/:slug/memory/:claimId/edit", destination: "/initiatives/:slug/knowledge/:claimId/edit", permanent: true },
      { source: "/initiatives/:slug/memory/:claimId/verify", destination: "/initiatives/:slug/knowledge/:claimId/confirm", permanent: true },
      { source: "/initiatives/:slug/sources", destination: "/initiatives/:slug/knowledge/sources", permanent: true },
      { source: "/initiatives/:slug/sources/new", destination: "/initiatives/:slug/knowledge/sources/new", permanent: true },
      { source: "/initiatives/:slug/sources/:evidenceId/edit", destination: "/initiatives/:slug/knowledge/sources/:evidenceId/edit", permanent: true },
      { source: "/initiatives/:slug/readiness", destination: "/initiatives/:slug", permanent: true },
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
