import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

/** The public pages, and only those: a shared chat never appears in a sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/support"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
