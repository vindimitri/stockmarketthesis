import { useRef } from "react";
import type { WindowFilter } from "../desk";
import { berlinTimeLabel, formatDayShort, formatEuro, formatPct, formatPrice } from "../format";
import type { NumberedKnockout } from "../hooks/useKnockouts";
import { useVirtualWindow } from "../hooks/useVirtualWindow";
import { isMobileUi } from "../media";

function tickClass(pct: number | null): string {
  // Match displayed 2-decimal %: ±0,00 % → flat/black
  if (pct == null || Math.abs(pct) < 0.005) return "is-flat";
  return pct > 0 ? "is-up" : "is-down";
}

function clock(unixSec: number | null): string {
  return unixSec == null ? "" : berlinTimeLabel(unixSec, true);
}

function pctMark(pct: number | null): string {
  if (pct == null) return "—";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "·";
  return `${arrow} ${formatPct(pct)}`;
}

const ROW_H_DESK = 100;
const ROW_H_MOBILE = 116;
const VIRTUAL_MIN = 24;

function KnockoutRowButton({
  row,
  date,
  windowFilter,
  onOpen,
}: {
  row: NumberedKnockout;
  date: string;
  windowFilter: WindowFilter;
  onOpen: (ymd: string) => void;
}) {
  const tBuy = clock(row.buyTime);
  const tSell = row.open ? "" : clock(row.sellTime);
  const pBuy = formatPrice(row.entry);
  const pSell = row.open || row.exitSpot == null ? "" : formatPrice(row.exitSpot);
  return (
    <button
      type="button"
      className={`desk-deriv-row ${tickClass(row.changePct)}${row.open ? " is-live" : ""}${
        date === row.date && windowFilter === "1718" ? " is-on" : ""
      }`}
      onClick={() => onOpen(row.date)}
    >
      <div className="desk-deriv-top">
        <div className="desk-deriv-stack">
          <div className="desk-deriv-meta">
            <div className="desk-deriv-name">{row.title}</div>
            <div className="desk-deriv-split" aria-hidden="true" />
            <div className="desk-deriv-range">
              <span className="desk-deriv-range-paren" aria-hidden="true">
                (
              </span>
              <div className="desk-deriv-range-grid">
                <span className="desk-deriv-leg-time">{tBuy}</span>
                <span className="desk-deriv-leg-sep">—</span>
                <span className="desk-deriv-leg-time">{tSell || "\u00a0"}</span>
                <span className="desk-deriv-leg-spot">{pBuy}</span>
                <span className="desk-deriv-leg-sep is-spot">—</span>
                <span className="desk-deriv-leg-spot">{pSell || "\u00a0"}</span>
              </div>
              <span className="desk-deriv-range-paren" aria-hidden="true">
                )
              </span>
            </div>
          </div>
          <div className="desk-deriv-indent">
            <div className="desk-deriv-name is-ghost" aria-hidden="true">
              {row.title}
            </div>
            <div className="desk-deriv-split is-ghost" aria-hidden="true" />
            <div className="desk-deriv-vals">
              <div className="desk-deriv-px">
                {formatEuro(row.capitalAfter)}{" "}
                <span className="desk-deriv-chg">({pctMark(row.changePct)})</span>
              </div>
              <div className="desk-deriv-start">Start {formatEuro(row.stake)}</div>
            </div>
          </div>
        </div>
        <div className="desk-deriv-date">{formatDayShort(row.date)}</div>
      </div>
    </button>
  );
}

export function DerivativesPanel({
  rows,
  date,
  windowFilter,
  onOpen,
}: {
  rows: NumberedKnockout[];
  date: string;
  windowFilter: WindowFilter;
  onOpen: (ymd: string) => void;
}) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const rowH = isMobileUi() ? ROW_H_MOBILE : ROW_H_DESK;
  const virtualize = rows.length >= VIRTUAL_MIN;
  const { start, end, offsetTop, totalHeight } = useVirtualWindow(
    virtualize ? rows.length : 0,
    rowH,
    listRef,
  );
  const slice = virtualize ? rows.slice(start, end) : rows;

  return (
    <aside className="desk-card desk-deriv-card">
      <div className="desk-pane-head desk-deriv-head">
        <div>
          <h2 className="desk-deriv-title">Knock-Out Zertifikate</h2>
          <p className="desk-deriv-kicker">KO · Hebel 100 · Barriere</p>
        </div>
      </div>
      <div className="desk-deriv-body">
        {rows.length ? (
          <ul
            ref={listRef}
            className={`desk-deriv-list${virtualize ? " is-virtual" : ""}`}
            style={virtualize ? { height: totalHeight } : undefined}
          >
            {virtualize ? (
              <li className="desk-deriv-spacer" style={{ height: offsetTop }} aria-hidden="true" />
            ) : null}
            {slice.map((row) => (
              <li
                key={`${row.date}|${row.buyTime}|${row.side}`}
                style={virtualize ? { height: rowH } : undefined}
              >
                <KnockoutRowButton
                  row={row}
                  date={date}
                  windowFilter={windowFilter}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
