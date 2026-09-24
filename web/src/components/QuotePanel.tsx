import type { LinePoint } from "../linePoints";
import type { BucketOption, ChartMode, WindowFilter } from "../desk";
import { formatPct, formatPrice } from "../format";
import { PriceChart } from "../PriceChart";
import { WindowButton } from "./ui";

export function QuotePanel({
  productName,
  last,
  change,
  changePct,
  up,
  bucket,
  onBucket,
  bucketOptions,
  loading,
  hasTrades,
  hasDays,
  points,
  viewKey,
  lastTick,
  trackLast,
  showSeconds,
  windowFilter,
  chartMode,
  onChartMode,
}: {
  productName: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  up: boolean;
  bucket: number;
  onBucket: (value: number) => void;
  bucketOptions: BucketOption[];
  loading: boolean;
  hasTrades: boolean;
  hasDays: boolean;
  points: LinePoint[];
  viewKey: string;
  lastTick: { time: number; value: number; key: string } | null;
  trackLast: boolean;
  showSeconds: boolean;
  windowFilter: WindowFilter;
  chartMode: ChartMode;
  onChartMode: (mode: ChartMode) => void;
}) {
  return (
    <section className="desk-card min-h-[20rem] flex-1 lg:min-h-0">
      <div className="desk-pane-head desk-quote-strip">
        <div className="desk-quote-last">
          <div className="desk-quote-name">{productName}</div>
          <div className="desk-quote-price">{formatPrice(last)}</div>
          <div className={`desk-quote-chip ${up ? "is-up" : "is-down"}`}>
            {change == null
              ? "—"
              : `${change >= 0 ? "+" : ""}${formatPrice(change)} · ${formatPct(changePct)}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="desk-segment" role="group" aria-label="Chart-Modus">
            <WindowButton
              active={chartMode === "overview"}
              onClick={() => onChartMode("overview")}
            >
              Übersicht
            </WindowButton>
            <WindowButton
              active={chartMode === "analyse"}
              onClick={() => onChartMode("analyse")}
            >
              Analyse
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
      <div className="desk-chart-slot flex-1 bg-white px-1 pb-2 pt-1">
        {loading && !hasTrades ? (
          <div className="flex h-full items-center justify-center text-sm text-desk-ink-muted">
            Lade Chart…
          </div>
        ) : points.length ? (
          <PriceChart
            points={points}
            viewKey={viewKey}
            lastTick={lastTick}
            trackLast={trackLast}
            showSeconds={showSeconds}
            locked={chartMode === "overview"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-desk-ink-muted">
            {!hasDays
              ? "Noch keine gespeicherten Tage. Ingest muss erst Daten holen."
              : windowFilter === "1718"
                ? "Keine Trades zwischen 17:00 und 18:00."
                : "Keine Trades für diesen Tag."}
          </div>
        )}
      </div>
    </section>
  );
}
