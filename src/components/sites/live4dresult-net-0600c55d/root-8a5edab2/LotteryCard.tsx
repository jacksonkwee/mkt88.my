import type { CSSProperties } from "react";
import { rewriteHtml, toLocal } from "./site-paths";
import { toSimplified } from "../../../../lib/zh-simplified";
import { liveCellFor } from "./snapshot-values";

export interface CardCellAttrs {
  width?: string;
  colspan?: string;
  rowspan?: string;
  "data-id"?: string;
}

export interface CardCell {
  tag: "td" | "th";
  cls: string;
  attrs: CardCellAttrs;
  html: string;
}

export interface CardRow {
  cls: string;
  cells: CardCell[];
}

export interface CardTable {
  cls: string;
  widthAttr?: string | null;
  rows: CardRow[];
}

export interface LotteryCardData {
  id: string;
  cardCls: string;
  header: {
    bgCls: string;
    logo: { src: string; alt: string };
    name: string;
    date: string;
    drawNo: string | null;
  };
  tables: CardTable[];
}

export interface CardOverride {
  values?: Record<string, string>;
  prizeSet?: { prize: string[]; special: string[]; cons: string[]; date?: string; drawNo?: string } | null;
}

function Cell(props: { cell: CardCell; override?: string; frozen?: boolean; drawMoved?: boolean }) {
  const { cell, override, frozen, drawMoved } = props;
  const style: CSSProperties | undefined = undefined;
  const attrs: Record<string, unknown> = {};
  const dataId = cell.attrs?.["data-id"] || "";
  // Any override (including the official "----" placeholder) replaces the built-in value.
  const fresh = override !== undefined && override !== "";
  const plain = (cell.html || "").replace(/<[^>]+>/g, "").trim();
  /*
   * A cell that holds a drawn number.
   *
   * "jackpot_number" is in this list because the games whose numbers are two
   * digits or a single digit - Magnum Life's winning numbers, the Toto 5D/6D
   * rows, Magnum Jackpot Gold's digits - are all printed in those cells. They
   * were not counted as numbers before, so a new draw's date arrived with the
   * previous draw's numbers still sitting underneath it (reported 11 Oct 2026).
   */
  const isNumber = /lottery-prize-number|lottery-number|jackpot_number/.test(cell.cls || "");
  /**
   * The live date has moved past the draw this card was built with, so every
   * number still baked into it belongs to the PREVIOUS draw. Printing those
   * under the new date is what showed 16-09 numbers on a 19-09 card, so show
   * "----" for anything the snapshot has not published yet.
   */
  // A cell that only holds a separator ("+") is not a number, so a moved draw
  // must not blank it.
  const bakedNumber = /^\d{1,6}$/.test(plain);
  const staleDraw = !frozen && !fresh && Boolean(drawMoved) && isNumber && bakedNumber;
  // Only hide values that could be a stale draw date / number; keep other
  // built-in text (like "----" or jackpot amounts) as it is.
  const legacyNumber = isNumber && /^\d{3,6}$/.test(plain);
  // A past-result card (mkt-past) shows printed history - never mask it.
  // Only hide values that could be a stale draw date / number; a "+" separator
  // or a jackpot amount stays as it is.
  const knownNumber = isNumber && bakedNumber;
  const maskable = !frozen && !fresh && !staleDraw && (dataId === "date" || dataId === "draw_no" || knownNumber || /^\d{3,6}$/.test(plain) || legacyNumber);
  const cls = [cell.cls, maskable ? "live-pending" : ""].filter(Boolean).join(" ");
  if (cls) attrs.className = cls;
  if (cell.attrs?.width) attrs.width = cell.attrs.width;
  if (cell.attrs?.colspan) attrs.colSpan = Number(cell.attrs.colspan);
  if (cell.attrs?.rowspan) attrs.rowSpan = Number(cell.attrs.rowspan);
  if (cell.attrs?.["data-id"]) attrs["data-id"] = cell.attrs["data-id"];
  const html = fresh ? override! : staleDraw ? "----" : rewriteHtml(cell.html || "");
  const Tag = cell.tag === "th" ? "th" : "td";


  // The live boot script writes these cells before React hydrates; tell React
  // not to warn about (or undo) the difference.
  const liveCell = Boolean(dataId) || /lottery-prize-number|lottery-number/.test(cell.cls || "");
  return <Tag {...attrs} style={style} suppressHydrationWarning={liveCell} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LotteryCard({ card, values, prizeSet }: { card: LotteryCardData } & CardOverride) {
  const h = card.header;
  /*
   * Cards the operator only ever printed carry already-final numbers and must
   * never be masked while a live draw is being waited for: the archived past
   * results, and Singapore's Toto card, which has no feed this app can poll.
   */
  const frozen = /(^|\s)(mkt-past|mkt-static)(\s|$)/.test(card.cardCls || "");
  const hasDate = Boolean(values?.date || prizeSet?.date);
  const hasDraw = Boolean(values?.draw_no || prizeSet?.drawNo);
  const freshDate = hasDate;
  const freshDraw = hasDraw;
  /*
   * The draw this render is showing, and the card class - used to look up what a
   * phone-side source has already read from the operator. Those values are put
   * back below, so a re-render cannot show the older copy over them.
   */
  const liveCls = /(?:^|\s)(table-\d+)(?:\s|$)/.exec(card.cardCls || "")?.[1] || "";
  const snapDate = values?.date || prizeSet?.date;
  const dateText = values?.date || prizeSet?.date || h.date;
  const drawText = values?.draw_no || prizeSet?.drawNo || h.drawNo;
  // A live date that differs from the one this card was built with means the
  // draw has moved on, and the numbers still baked into the card are last
  // draw's.
  const drawMoved = Boolean(dateText) && Boolean(h.date) && dateText !== h.date;
  const headerClass = ["row", "mx-0", "align-items-center", "justify-content-center", h.bgCls, "position-relative"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={card.cardCls} id={card.id}>
      <div className="card-body p-2">
        <div className={headerClass}>
          {h.logo.src ? (
            <div className="lottery-logo">
              <img src={toLocal(h.logo.src)} alt={h.logo.alt} />
            </div>
          ) : null}
          {/*
            The card header keeps the game's name on ONE line. At the site's
            18px a long name - "Special CashSweep 砂拉越大万" is the longest -
            wrapped and pushed "砂拉越大万" onto a second line, which reads as a
            broken heading (reported 11 Oct 2026 for the east games). The long
            ones are set a step smaller so the whole name still fits.
          */}
          <div className="lottery-name" style={(toSimplified(h.name) || "").length > 15 ? { fontSize: 15 } : undefined}>{toSimplified(h.name)}</div>
        </div>
        <div className="row mx-0 justify-content-between">
          <div className="date">
            Date: <span suppressHydrationWarning className={frozen || freshDate ? "" : "live-pending"} data-id="date">{dateText}</span>
          </div>
          {drawText ? (
            <div className="date">
              Draw No: <span suppressHydrationWarning className={frozen || freshDraw ? "" : "live-pending"} data-id="draw_no">{drawText}</span>
            </div>
          ) : null}
        </div>
        {card.tables.map((t, ti) => {
          // Running index of number cells in this table so special / consolation
          // values stay aligned across their rows.
          let nth = 0;
          return (
            <table key={ti} className={t.cls} width={t.widthAttr || undefined}>
              <tbody>
                {t.rows.map((r, ri) => (
                  <tr key={ri} className={r.cls || undefined}>
                    {r.cells.map((c, ci) => {
                      const id = c.attrs?.["data-id"] || "";
                      let override = id ? values?.[id] : undefined;
                      // The live data lists this cell but has no value for it yet.
                      // On a card whose date has moved, a number still baked in
                      // belongs to the previous draw, so show "----". Only cells
                      // that actually hold a number are touched, so labels and
                      // zodiac names keep their built-in text.
                      if (override === "" && drawMoved && id !== "date" && id !== "draw_no") {
                        const builtIn = (c.html || "").replace(/<[^>]+>/g, "").trim();
                        if (/^\d+$/.test(builtIn) || /lottery-prize-number|lottery-number/.test(c.cls || "")) override = "----";
                      }
                      const isNum = /lottery-prize-number|lottery-number/.test(c.cls || "");
                      if (isNum) {
                        const n = nth++;
                        const live = liveCellFor(liveCls, ti, n, snapDate);
                        if (live !== undefined) override = live;
                        else if (override === undefined && prizeSet) {
                          if (ti === 0) override = prizeSet.prize?.[n];
                          else if (ti === 1) override = prizeSet.special?.[n];
                          else if (ti === 2) override = prizeSet.cons?.[n];
                        }
                      }
                      return <Cell key={ci} cell={c} override={override} frozen={frozen} drawMoved={drawMoved} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
    </div>
  );
}
















