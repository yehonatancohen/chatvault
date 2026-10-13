import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "בוידעם",
    short_name: "בוידעם",
    description: "הצ׳אטים של וואטסאפ, שמורים אצלכם.",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#2436c9",
    icons: [{ src: "/icon-boydem.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
