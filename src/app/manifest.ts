import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QueueLess",
    short_name: "QueueLess",
    description: "Pre-order canteen food, pick a pickup slot and collect with a token.",
    start_url: "/menu",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#e8a317",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
