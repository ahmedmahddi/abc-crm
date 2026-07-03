import path from "node:path";
import withSerwistInit from "@serwist/next";

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

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
  async redirects() {
    const stalePath = "/" + ["session", "expired"].join("-");
    return [
      {
        source: stalePath,
        destination: "/login?reason=timeout",
        permanent: false,
      },
    ];
  },
  async headers() {
    const stalePath = "/" + ["session", "expired"].join("-");
    return ["/login", "/forgot-password", "/reset-password", stalePath, "/logged-out"].map((source) => ({
      source,
      headers: noStoreHeaders,
    }));
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
