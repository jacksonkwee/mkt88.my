import type { LotteryCardData } from "./LotteryCard";
import { attr, plain, segmentOf, tablesOf } from "./card-parse";
import raw from "./snapshots/singapore-4d-results.content.json";

/**
 * Singapore Toto.
 *
 * The Singapore capture carries two cards - the 4D draw and, beside it, Toto.
 * The website prints the capture as it stands so both are on screen; the app
 * builds its slides from the card model instead, and that model only held the
 * 4D card - so the app showed Singapore 4D with no Toto at all (reported
 * 11 Oct 2026). Toto is read into the same model here.
 *
 * Singapore Pools publishes no live feed this app can poll for Toto, so the
 * values are the operator's printed ones and never change. The card therefore
 * carries the "mkt-static" marker, which stops the live-pending mask from
 * blanking numbers that nothing will ever fill in.
 */
const html = (raw as { colHtml?: string }).colHtml || "";

function cardFor(cls: string): LotteryCardData | null {
  const seg = segmentOf(html, cls);
  if (!seg) return null;
  const openTag = seg.slice(0, seg.indexOf(">") + 1);
  const bg = /class="row mx-0 align-items-center justify-content-center ([^"]*)"/.exec(seg)?.[1] || "";
  return {
    id: attr(openTag, "id") || cls,
    cardCls: "card outer-box mkt-static " + cls,
    header: {
      bgCls: bg.split(/\s+/).find((c) => /-bg$/.test(c)) || "",
      // The operator's Toto card is headed by its name alone.
      logo: { src: "", alt: "" },
      name: plain(/class="lottery-name"[^>]*>([\s\S]*?)<\/div>/i.exec(seg)?.[1] || ""),
      date: plain(/data-id="date"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1] || ""),
      drawNo: plain(/data-id="draw_no"[^>]*>([\s\S]*?)<\/span>/i.exec(seg)?.[1] || "") || null,
    },
    tables: tablesOf(seg),
  };
}

export const SG_CARDS: LotteryCardData[] = ["table-12"]
  .map(cardFor)
  .filter((c): c is LotteryCardData => Boolean(c));
