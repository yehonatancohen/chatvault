import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

/**
 * Shared chats (`/s/…`) and the Drive popup (`/connect`) are private by nature. Their pages
 * already carry `noindex`; this keeps well-behaved crawlers from fetching them at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/s/", "/connect"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
