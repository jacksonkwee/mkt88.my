import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Server-rendered information block. Google needs real text on the page, so
 * every result / tool page carries a short explanation + internal links.
 *
 * The copy may be plain text or, for pages that carry all three languages in
 * the markup, the hidden-by-CSS spans that pick one.
 */
export default function SeoText({
  heading,
  paragraphs,
  links,
}: {
  heading: ReactNode;
  paragraphs: ReactNode[];
  links?: { href: string; label: ReactNode }[];
}) {
  return (
    <section style={{ maxWidth: 900, margin: "18px auto 30px", padding: "0 14px", color: "var(--j-ink)", lineHeight: 1.65 }}>
      {/* The page's main heading. It is an h1 rather than an h2 because on every
          page that uses this block it IS the page's title - and a page with no
          h1 gives Google nothing to hang the page on (measured 14 Oct 2026). */}
      {/*
        The page heading is the one display size on a page - bigger than body
        text, which is what makes it a heading. It takes the title weight (700)
        rather than the 500 it carried on its own; 500 appeared nowhere else in
        the product (design review, 16 Oct 2026).
      */}
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "10px 0 8px" }}>{heading}</h1>
      {/* Measured 16 Oct 2026: this copy ran ~122 characters per line at the
          900px container width, about 1.5x the length an eye can track back
          from. 72ch is the readable band and still fills a desktop column. */}
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize: 15, margin: "6px 0", maxWidth: "72ch" }}>{p}</p>
      ))}
      {links && links.length ? (
        <p style={{ fontSize: 15, marginTop: 10 }}>
          {links.map((l, i) => (
            <span key={l.href}>
              {i > 0 ? " · " : ""}
              <Link href={l.href} style={{ color: "#cc0000", textDecoration: "none", fontWeight: 600 }}>{l.label}</Link>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
