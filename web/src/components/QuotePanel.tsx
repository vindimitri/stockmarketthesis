import type { LinePoint } from "../linePoints";
import type { BucketOption, WindowFilter } from "../desk";
import { formatInt, formatPct, formatPrice } from "../format";
import { PriceChart, type TradeMark } from "../PriceChart";
import { QuantityChart } from "../QuantityChart";
import { WindowButton } from "./ui";

function EmptyNote({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-desk-ink-muted">
      {children}
    </div>
  );
}

export function QuotePanel({
  productName,
  last,
  change,
  changePct,
  bucket,
  onBucket,
  bucketOptions,
  loading,
  hasTrades,
  hasDays,
  points,
  volumePoints,
  volumeTotal,
  viewKey,
  lastTick,
  trackLast,
  showSeconds,
  windowFilter,
  onWindowFilter,
  tradeMarks,
}: {
  productName: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  bucket: number;
  onBucket: (value: number) => void;
  bucketOptions: BucketOption[];
  loading: boolean;
  hasTrades: boolean;
  hasDays: boolean;
  points: LinePoint[];
  volumePoints: LinePoint[];
  volumeTotal: number;
  viewKey: string;
  lastTick: { time: number; value: number; key: string } | null;
  trackLast: boolean;
  showSeconds: boolean;
  windowFilter: WindowFilter;
  onWindowFilter: (value: WindowFilter) => void;
  tradeMarks: TradeMark | null;
}) {
  const empty = !hasDays
    ? "Noch keine gespeicherten Tage. Ingest muss erst Daten holen."
    : windowFilter === "1718"
      ? "Keine Trades zwischen 17:00 und 18:00."
      : "Keine Trades für diesen Tag.";
  const tick =
    change == null || change === 0 ? "is-flat" : change > 0 ? "is-up" : "is-down";

  return (
    <div className="desk-chart-stack">
      <section className="desk-card desk-price-card">
        <div className="desk-pane-head desk-quote-strip">
          <div className="desk-quote-last">
            <div className="desk-quote-name">{productName}</div>
            <div className={`desk-quote-price ${tick}`}>{formatPrice(last)}</div>
            <div className={`desk-quote-delta ${tick}`}>
              <span>
                {change == null
                  ? "—"
                  : `${change >= 0 ? "+" : ""}${formatPrice(change)}`}
              </span>
              <span>{formatPct(changePct)}</span>
            </div>
          </div>
          <div className="desk-quote-controls">
            <div className="desk-segment" role="group" aria-label="Zeitfenster">
              <WindowButton
                active={windowFilter === "day"}
                onClick={() => onWindowFilter("day")}
              >
                Ganzer Tag
              </WindowButton>
              <WindowButton
                active={windowFilter === "1718"}
                onClick={() => onWindowFilter("1718")}
              >
                17–18 Uhr
              </WindowButton>
            </div>
            <div className="desk-segment" role="group" aria-label="Chart-Auflösung">
              {bucketOptions.map((opt) => (
                <WindowButton
                  key={opt.value}
                  active={bucket === opt.value}
                  onClick={() => onBucket(opt.value)}
                >
                  {opt.label}
                </WindowButton>
              ))}
            </div>
          </div>
        </div>
        <div className="desk-chart-slot flex-1 px-1 pb-1 pt-1">
          {loading && !hasTrades ? (
            <EmptyNote>Lade Chart…</EmptyNote>
          ) : points.length ? (
            <PriceChart
              points={points}
              viewKey={viewKey}
              lastTick={lastTick}
              trackLast={trackLast}
              showSeconds={showSeconds}
              locked
              tradeMarks={tradeMarks}
            />
          ) : (
            <EmptyNote>{empty}</EmptyNote>
          )}
        </div>
      </section>
      <section className="desk-card desk-qty-card is-ready">
        <div className="desk-pane-head desk-qty-strip">
          <div className="desk-quote-name">Quantity</div>
          <div className="desk-qty-total">{formatInt(volumeTotal)}</div>
          <div className="desk-quote-chip">Qty</div>
        </div>
        <div className="desk-qty-slot">
          {loading && !hasTrades ? (
            <EmptyNote>Lade Quantity…</EmptyNote>
          ) : volumePoints.length ? (
            <QuantityChart
              points={volumePoints}
              viewKey={viewKey}
              showSeconds={showSeconds}
              locked
            />
          ) : (
            <EmptyNote>{empty}</EmptyNote>
          )}
        </div>
      </section>
    </div>
  );
}
