import path from "node:path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV !== "production",
  globPublicPatterns: ["brand/abc-logo.webp"],
  register: true,
  reloadOnOnline: true,
  swDest: "public/sw.js",
  swSrc: "src/app/sw.ts",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  async rewrites() {
    const apiUrl = process.env.API_PROXY_URL?.replace(/\/+$/, "");
    return apiUrl
      ? [
          {
            source: "/api/v1/:path*",
            destination: `${apiUrl}/api/v1/:path*`,
          },
        ]
      : [];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default withSerwist(nextConfig);
