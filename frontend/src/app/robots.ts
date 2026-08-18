import type { MetadataRoute } from "next";

/**
 * The app is behind auth anyway, but `/delt/` is the one path a crawler could
 * actually reach. A share link's secrecy rests on it not being indexed, so it is
 * excluded explicitly as well as via the page's `noindex, nofollow` metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    // "/" already covers every path, share pages included — the app is behind
    // auth and nothing here is meant to be indexed.
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
