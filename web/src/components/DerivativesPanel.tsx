import type { WindowFilter } from "../desk";
import { berlinTimeLabel, formatDayShort, formatEuro, formatPct } from "../format";
import type { NumberedKnockout } from "../hooks/useKnockouts";

function tickClass(pnl: number | null): string {
  if (pnl == null || pnl === 0) return "is-flat";
  return pnl > 0 ? "is-up" : "is-down";
}

function clock(unixSec: number | null): string {
  return unixSec == null ? "—" : berlinTimeLabel(unixSec, true);
}

function pctMark(pct: number | null): string {
  if (pct == null) return "—";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "·";
  return `${arrow} ${formatPct(pct)}`;
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
  return (
    <aside className="desk-card desk-deriv-card">
      <div className="desk-pane-head desk-deriv-head">
        <div>
          <h2 className="desk-deriv-title">Knock-Out Zertifikate</h2>
          <p className="desk-deriv-kicker">Simuliert · Hebel 100</p>
        </div>
      </div>
      <div className="desk-deriv-body">
        {rows.length ? (
          <ul className="desk-deriv-list">
            {rows.map((row) => (
              <li key={`${row.date}|${row.buyTime}|${row.side}`}>
                <button
                  type="button"
                  className={`desk-deriv-row ${tickClass(row.changeEur)}${row.open ? " is-live" : ""}${
                    date === row.date && windowFilter === "1718" ? " is-on" : ""
                  }`}
                  onClick={() => onOpen(row.date)}
                >
                  <div className="desk-deriv-top">
                    <div className="desk-deriv-name">
                      {row.title} ({clock(row.buyTime)} – {clock(row.sellTime)})
                    </div>
                    <div className="desk-deriv-date">{formatDayShort(row.date)}</div>
                  </div>
                  <div className="desk-deriv-vals">
                    <div className="desk-deriv-px">
                      {formatEuro(row.capitalAfter)}{" "}
                      <span className="desk-deriv-chg">({pctMark(row.changePct)})</span>
                    </div>
                    <div className="desk-deriv-start">Start {formatEuro(row.stake)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
