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

function Cell(props: { cell: CardCell }) {
  const { cell } = props;
  const style: CSSProperties | undefined = undefined;
  const attrs: Record<string, unknown> = {};
  const dataId = cell.attrs?.["data-id"] || "";
  const plain = (cell.html || "").replace(/<[^>]+>/g, "").trim();
  // Only hide values that could be a stale draw date / number; keep other
  // built-in text (like "----" or jackpot amounts) as it is.
  const legacyNumber = /lottery-prize-number|lottery-number/.test(cell.cls || "") && /^\d{3,6}$/.test(plain);
  const maskable = dataId === "date" || dataId === "draw_no" || /^\d{3,6}$/.test(plain) || legacyNumber;
  const cls = [cell.cls, maskable ? "live-pending" : ""].filter(Boolean).join(" ");
  if (cls) attrs.className = cls;
  if (cell.attrs?.width) attrs.width = cell.attrs.width;
  if (cell.attrs?.colspan) attrs.colSpan = Number(cell.attrs.colspan);
  if (cell.attrs?.rowspan) attrs.rowSpan = Number(cell.attrs.rowspan);
  if (cell.attrs?.["data-id"]) attrs["data-id"] = cell.attrs["data-id"];
  const html = rewriteHtml(cell.html || "");
  const Tag = cell.tag === "th" ? "th" : "td";
  return <Tag {...attrs} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function LotteryCard({ card }: { card: LotteryCardData }) {
  const h = card.header;
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
            Date: <span className="live-pending" data-id="date">{h.date}</span>
          </div>
          {h.drawNo ? (
            <div className="date">
              Draw No: <span className="live-pending" data-id="draw_no">{h.drawNo}</span>
            </div>
          ) : null}
        </div>
        {card.tables.map((t, ti) => (
          <table key={ti} className={t.cls} width={t.widthAttr || undefined}>
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri} className={r.cls || undefined}>
                  {r.cells.map((c, ci) => (
                    <Cell key={ci} cell={c} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}




