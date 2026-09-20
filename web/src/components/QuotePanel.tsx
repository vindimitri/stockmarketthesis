import type { LinePoint } from "../linePoints";
import type { BucketOption, WindowFilter } from "../desk";
import { formatInt, formatPct, formatPrice } from "../format";
import type { TradeStats } from "../lib/trades";
import { PriceChart } from "../PriceChart";
import { StatChip, WindowButton } from "./ui";

export function QuotePanel({
  productName,
  stats,
  change,
  changePct,
  up,
  bucket,
  onBucket,
  bucketOptions,
  loading,
  hasTrades,
  points,
  viewKey,
  lastTick,
  showSeconds,
  windowFilter,
}: {
  productName: string;
  stats: TradeStats | null;
  change: number | null;
  changePct: number | null;
  up: boolean;
  bucket: number;
  onBucket: (value: number) => void;
  bucketOptions: BucketOption[];
  loading: boolean;
  hasTrades: boolean;
  points: LinePoint[];
  viewKey: string;
  lastTick: { time: number; value: number; key: string } | null;
  showSeconds: boolean;
  windowFilter: WindowFilter;
}) {
  return (
    <section className="desk-card min-h-[34rem] flex-1 border-0 lg:min-h-[420px]">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pb-3 pt-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <div className="desk-label mb-1">Produkt</div>
              <div className="text-sm font-medium">{productName}</div>
            </div>
            <div
              className={`mono text-[2rem] font-medium leading-none tracking-tight ${
                up ? "text-desk-up" : "text-desk-down"
              }`}
            >
              {formatPrice(stats?.close)}
            </div>
            <div className={`desk-quote-chip mono ${up ? "text-desk-up" : "text-desk-down"}`}>
              {change == null
                ? "—"
                : `${change >= 0 ? "+" : ""}${formatPrice(change)} · ${formatPct(changePct)}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <StatChip label="Open" value={formatPrice(stats?.open)} />
            <StatChip label="Hoch" value={formatPrice(stats?.high)} />
            <StatChip label="Tief" value={formatPrice(stats?.low)} />
            <StatChip label="Vol" value={formatInt(stats?.volume)} />
            <StatChip label="VWAP" value={formatPrice(stats?.vwap)} />
          </div>
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
      <div className="min-h-[240px] flex-1 px-2 pb-3">
        {loading && !hasTrades ? (
          <div className="flex h-full items-center justify-center text-sm text-desk-ink-muted">
            Lade Chart…
          </div>
        ) : points.length ? (
          <PriceChart
            points={points}
            viewKey={viewKey}
            lastTick={lastTick}
            showSeconds={showSeconds}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-desk-ink-muted">
            {windowFilter === "1718"
              ? "Keine Trades zwischen 17:00 und 18:00."
              : "Keine Trades für diesen Tag."}
          </div>
        )}
      </div>
    </section>
  );
}
