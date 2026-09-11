import type { CSSProperties } from "react";
import { rewriteHtml, toLocal } from "./site-paths";

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

function Cell(props: { cell: CardCell; override?: string; frozen?: boolean }) {
  const { cell, override, frozen } = props;
  const style: CSSProperties | undefined = undefined;
  const attrs: Record<string, unknown> = {};
  const dataId = cell.attrs?.["data-id"] || "";
  // Any override (including the official "----" placeholder) replaces the built-in value.
  const fresh = override !== undefined && override !== "";
  const plain = (cell.html || "").replace(/<[^>]+>/g, "").trim();
  // Only hide values that could be a stale draw date / number; keep other
  // built-in text (like "----" or jackpot amounts) as it is.
  const legacyNumber = /lottery-prize-number|lottery-number/.test(cell.cls || "") && /^\d{3,6}$/.test(plain);
  // A past-result card (mkt-past) shows printed history - never mask it.
  const maskable = !frozen && !fresh && (dataId === "date" || dataId === "draw_no" || /^\d{3,6}$/.test(plain) || legacyNumber);
  const cls = [cell.cls, maskable ? "live-pending" : ""].filter(Boolean).join(" ");
  if (cls) attrs.className = cls;
  if (cell.attrs?.width) attrs.width = cell.attrs.width;
  if (cell.attrs?.colspan) attrs.colSpan = Number(cell.attrs.colspan);
  if (cell.attrs?.rowspan) attrs.rowSpan = Number(cell.attrs.rowspan);
  if (cell.attrs?.["data-id"]) attrs["data-id"] = cell.attrs["data-id"];
  const html = fresh ? override! : rewriteHtml(cell.html || "");
  const Tag = cell.tag === "th" ? "th" : "td";


  // The live boot script writes these cells before React hydrates; tell React
  // not to warn about (or undo) the difference.
  const liveCell = Boolean(dataId) || /lottery-prize-number|lottery-number/.test(cell.cls || "");
  return <Tag {...attrs} style={style} suppressHydrationWarning={liveCell} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LotteryCard({ card, values, prizeSet }: { card: LotteryCardData } & CardOverride) {
  const h = card.header;
  // Past-result cards carry already-final numbers and must never be masked.
  const frozen = /(^|\s)mkt-past(\s|$)/.test(card.cardCls || "");
  const hasDate = Boolean(values?.date || prizeSet?.date);
  const hasDraw = Boolean(values?.draw_no || prizeSet?.drawNo);
  const freshDate = hasDate;
  const freshDraw = hasDraw;
  const dateText = values?.date || prizeSet?.date || h.date;
  const drawText = values?.draw_no || prizeSet?.drawNo || h.drawNo;
  const headerClass = ["row", "mx-0", "align-items-center", "justify-content-center", h.bgCls, "position-relative"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={card.cardCls} id={card.id}>
      <div className="card-body p-2">
        <div className={headerClass}>
          <div className="lottery-logo">
            <img src={toLocal(h.logo.src)} alt={h.logo.alt} />
          </div>
          <div className="lottery-name">{h.name}</div>
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
                      const isNum = /lottery-prize-number|lottery-number/.test(c.cls || "");
                      if (isNum) {
                        const n = nth++;
                        if (override === undefined && prizeSet) {
                          if (ti === 0) override = prizeSet.prize?.[n];
                          else if (ti === 1) override = prizeSet.special?.[n];
                          else if (ti === 2) override = prizeSet.cons?.[n];
                        }
                      }
                      return <Cell key={ci} cell={c} override={override} frozen={frozen} />;
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
















