import type { TradeRow } from "../api";
import type { WindowFilter } from "../desk";
import { formatClock, formatDateShort, formatInt, formatPrice } from "../format";

function priceTickClass(price: number, older: TradeRow | undefined): string {
  if (!older) return "";
  if (price > older.price) return "is-up";
  if (price < older.price) return "is-down";
  return "";
}

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
    <section className="desk-card min-h-[280px] lg:min-h-0">
      <div className="desk-tape-chrome">
        <div className="desk-tape-head">
          <div>
            <h2>Tape</h2>
            <p className="mt-0.5 text-[11px] text-white/75">
              {formatInt(count)} Prints
              {windowFilter === "1718" ? " · 17–18 Uhr" : ""}
            </p>
          </div>
          <div className="text-[11px] text-white/75">
            {page + 1} / {pages}
          </div>
        </div>
        <div className="desk-tape-cols" aria-hidden="true">
          <span>Zeit</span>
          <span>Preis</span>
          <span>Qty</span>
          <span>Kontrakt</span>
        </div>
      </div>
      <div className="desk-tape-body">
        <div className="desk-tape-scroll">
          <table className="desk-tape-table">
            <thead className="sr-only">
              <tr>
                <th>Zeit</th>
                <th>Preis</th>
                <th>Qty</th>
                <th>Kontrakt</th>
              </tr>
            </thead>
            <tbody className="mono">
              {rows.length ? (
                rows.map((t, index) => (
                  <tr key={t.external_id} className="desk-table-row">
                    <td className="desk-tape-time">{formatClock(t.event_time)}</td>
                    <td className={`desk-tape-price ${priceTickClass(t.price, rows[index + 1])}`}>
                      {formatPrice(t.price)}
                    </td>
                    <td className="desk-tape-qty">{formatInt(t.quantity)}</td>
                    <td className="desk-tape-contract">{formatDateShort(t.contract_date)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-desk-ink-muted">
                    Keine Prints in dieser Ansicht.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="desk-tape-pager">
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
