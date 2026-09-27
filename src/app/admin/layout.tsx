import type { Metadata } from "next";

/**
 * The admin area must never be indexed. A robots.txt block alone does not do
 * that - Google can still index a blocked URL without reading it - so these
 * pages ask for noindex and robots.txt lets the crawler in to see it.
 */
export const metadata: Metadata = {
  title: "Admin - mkt88 4D",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}