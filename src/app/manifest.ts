import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Мой дневник", short_name: "Дневник", description: "Задачи, планы, цели и личный дневник",
    lang: "ru", start_url: "/", scope: "/", display: "standalone",
    background_color: "#171620", theme_color: "#171620",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  };
}
