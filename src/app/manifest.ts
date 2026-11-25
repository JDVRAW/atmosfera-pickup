import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atmosfera Cafe",
    short_name: "Atmosfera",
    description: "Order ahead for pickup at Atmosfera Cafe.",
    start_url: "/",
    display: "standalone",
    background_color: "#2A1B3D",
    theme_color: "#2A1B3D",
    icons: [
      { src: "/brand/atmosfera-app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/atmosfera-app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
