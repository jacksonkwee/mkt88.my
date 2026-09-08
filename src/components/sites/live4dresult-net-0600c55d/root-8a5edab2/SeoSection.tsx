import { parseInlineStyle, rewriteHtml } from "./site-paths";
import raw from "./sections-data.json";

interface SeoBlock {
  tag: "h2" | "h3" | "p";
  style: string;
  dataStart?: string;
  dataEnd?: string;
  html: string;
  text: string;
}

const { seo } = raw as unknown as { seo: SeoBlock[] };

export default function SeoSection() {
  return (
    <div className="description text-center">
      {seo.map((b, i) => {
        const Tag = b.tag;
        const extra =
          b.dataStart !== undefined
            ? { "data-start": b.dataStart, "data-end": b.dataEnd }
            : {};
        return (
          <Tag
            key={i}
            style={parseInlineStyle(b.style)}
            {...extra}
            dangerouslySetInnerHTML={{ __html: rewriteHtml(b.html) }}
          />
        );
      })}
    </div>
  );
}
