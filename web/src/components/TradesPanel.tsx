import type { TradeRow } from "../api";
import type { WindowFilter } from "../desk";
import { formatClock, formatDateShort, formatInt, formatPrice } from "../format";

export function TradesPanel({
  count,
  windowFilter,
  rows,
  page,
  pages,
  onPage,
}: {
  count: number;
  windowFilter: WindowFilter;
  rows: TradeRow[];
  page: number;
  pages: number;
  onPage: (updater: (current: number) => number) => void;
}) {
  return (
    <section className="desk-card min-h-[280px] border-0 lg:min-h-0">
      <div className="flex items-end justify-between px-4 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-medium">Trades</h2>
          <p className="mt-0.5 text-xs text-desk-ink-muted">
            {formatInt(count)} Prints
            {windowFilter === "1718" ? " · 17–18 Uhr" : ""}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[360px] text-left text-xs">
          <thead className="desk-table-head">
            <tr>
              <th className="px-4 py-2 font-medium">Zeit</th>
              <th className="px-3 py-2 font-medium">Preis</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Kontrakt</th>
            </tr>
          </thead>
          <tbody className="mono">
            {rows.map((t) => (
              <tr key={t.external_id} className="desk-table-row">
                <td className="whitespace-nowrap px-4 py-2 text-desk-ink">
                  {formatClock(t.event_time)}
                </td>
                <td className="px-3 py-2 text-desk-ink">{formatPrice(t.price)}</td>
                <td className="px-3 py-2 text-desk-ink-muted">{formatInt(t.quantity)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-desk-ink-faint">
                  {formatDateShort(t.contract_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-desk-border-soft px-4 py-2.5 text-xs text-desk-ink-muted">
        <span>
          {page + 1} / {pages}
        </span>
        <div className="flex gap-4">
          <button
            type="button"
            className="desk-btn"
            disabled={page === 0}
            onClick={() => onPage((p) => Math.max(0, p - 1))}
          >
            Zurück
          </button>
          <button
            type="button"
            className="desk-btn"
            disabled={page >= pages - 1}
            onClick={() => onPage((p) => Math.min(pages - 1, p + 1))}
          >
            Weiter
          </button>
        </div>
      </div>
    </section>
  );
}
