import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABC CRM",
    short_name: "ABC CRM",
    description: "CRM PWA for ABC Consulting.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9FB",
    theme_color: "#125885",
    icons: [
      {
        src: "/brand/abc-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/abc-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
