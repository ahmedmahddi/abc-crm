import path from "node:path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  cacheOnNavigation: false,
  disable: true,
  globPublicPatterns: [],
  register: false,
  reloadOnOnline: false,
  swDest: "public/sw.js",
  swSrc: "src/app/sw.ts",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  async rewrites() {
    const apiUrl = (
      process.env.API_PROXY_URL ??
      process.env.API_URL ??
      (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "")
    ).replace(/\/+$/, "");
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
