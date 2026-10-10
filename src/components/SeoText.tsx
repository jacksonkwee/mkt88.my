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
    <section style={{ maxWidth: 900, margin: "18px auto 30px", padding: "0 14px", color: "#333", lineHeight: 1.65 }}>
      <h2 style={{ fontSize: 20, margin: "10px 0 8px" }}>{heading}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize: 14, margin: "6px 0" }}>{p}</p>
      ))}
      {links && links.length ? (
        <p style={{ fontSize: 14, marginTop: 10 }}>
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
