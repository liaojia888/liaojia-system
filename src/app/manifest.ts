import type { MetadataRoute } from "next";
import {
  PWA_APP_NAME,
  PWA_APP_SHORT_NAME,
  PWA_BACKGROUND_COLOR,
  PWA_DESCRIPTION,
  PWA_THEME_COLOR,
} from "@/lib/pwa-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PWA_APP_NAME,
    short_name: PWA_APP_SHORT_NAME,
    description: PWA_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "zh-Hant",
    dir: "ltr",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
