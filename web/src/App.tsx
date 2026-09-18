import { useEffect, useMemo, useRef, useState } from "react";
import { api, type DayRow, type HealthResponse, type TradeRow } from "./api";
import { toLinePoints } from "./candles";
import {
  berlinTodayYmd,
  formatClock,
  formatDateShort,
  formatDay,
  formatInt,
  formatMonthTitle,
  formatPct,
  formatPrice,
  inBerlinHourRange,
} from "./format";
import { PriceChart } from "./PriceChart";
import { DEFAULT_TAPE_DELAY_MS, mergeTrades } from "./tape";
import { useTape } from "./useTape";

const PAGE = 80;
const DEFAULT_CONTRACT = "2026-12-18";

type WindowFilter = "day" | "1718";

export default function App() {
  const [days, setDays] = useState<DayRow[]>([]);
  const [date, setDate] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [bucket, setBucket] = useState(60);
  const [contract, setContract] = useState("all");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("day");
  const [tradesOpen, setTradesOpen] = useState(true);
  const tradesRef = useRef<TradeRow[]>([]);
  const defaultedForDate = useRef("");
  tradesRef.current = trades;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [healthRes, dayRows] = await Promise.all([api.health(), api.days()]);
        if (cancelled) return;
        setHealth(healthRes);
        setDays(dayRows);
        setDate((prev) => prev || dayRows[0]?.berlin_date || "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const tradeRes = await api.trades(date, "00:00", "24:00");
        if (cancelled) return;
        setTrades(tradeRes.trades);
        setPage(0);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const live = Boolean(date) && date === berlinTodayYmd();
  const delayMs = (health?.tape_delay_seconds ?? DEFAULT_TAPE_DELAY_MS / 1000) * 1000;
  const { revealed: taped, tapeMs, waitingForIngest } = useTape(trades, live, date, delayMs);

  useEffect(() => {
    if (!live || !date) return;
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      const last = tradesRef.current.at(-1);
      try {
        const [delta, healthRes, dayRows] = await Promise.all([
          api.trades(date, "00:00", "24:00", last?.event_time, last?.id ?? 0),
          api.health(),
          api.days(),
        ]);
        if (cancelled) return;
        if (delta.trades.length) {
          setTrades((prev) => mergeTrades(prev, delta.trades));
        }
        setHealth(healthRes);
        setDays(dayRows);
      } catch {
        /* keep the last good tape */
      }
    };
    const timer = window.setInterval(poll, 20_000);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, date]);

  const contracts = useMemo(() => {
    const map = new Map<string, { date: string; n: number; volume: number }>();
    for (const trade of trades) {
      const cur = map.get(trade.contract_date) ?? {
        date: trade.contract_date,
        n: 0,
        volume: 0,
      };
      cur.n += 1;
      cur.volume += trade.quantity;
      map.set(trade.contract_date, cur);
    }
    return [...map.values()].sort((a, b) => b.volume - a.volume);
  }, [trades]);

  useEffect(() => {
    if (!date || !contracts.length) return;
    if (defaultedForDate.current === date) return;
    defaultedForDate.current = date;
    const hasDefault = contracts.some((item) => item.date === DEFAULT_CONTRACT);
    setContract(hasDefault ? DEFAULT_CONTRACT : (contracts[0]?.date ?? "all"));
  }, [date, contracts]);

  useEffect(() => {
    setPage(0);
  }, [windowFilter, contract]);

  const byContract = useMemo(
    () => (contract === "all" ? taped : taped.filter((t) => t.contract_date === contract)),
    [taped, contract],
  );

  const visible = useMemo(
    () =>
      windowFilter === "1718"
        ? byContract.filter((t) => inBerlinHourRange(t.event_time, 17, 18))
        : byContract,
    [byContract, windowFilter],
  );

  const points = useMemo(() => toLinePoints(visible, bucket), [visible, bucket]);
  const lastTick = useMemo(() => {
    const trade = visible.at(-1);
    if (!trade) return null;
    return {
      time: Math.floor(Date.parse(trade.event_time) / 1000),
      value: trade.price,
      key: `${trade.id ?? ""}|${trade.event_time}|${trade.external_id}`,
    };
  }, [visible]);
  const stats = useMemo(() => summarizeTrades(visible), [visible]);
  const tableRows = live ? [...visible].reverse() : visible;
  const pages = Math.max(1, Math.ceil(tableRows.length / PAGE));
  const slice = tableRows.slice(page * PAGE, page * PAGE + PAGE);
  const change = stats ? stats.close - stats.open : null;
  const changePct = stats && stats.open ? (change! / stats.open) * 100 : null;
  const up = (change ?? 0) >= 0;
  const productName = contractLabel(contract);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f4f4f4] text-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Private Desk
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              FDAX Delayed
            </h1>
          </div>
          <div className="hidden h-8 w-px bg-zinc-200 sm:block" />
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            Fenster
            <div className="flex rounded-md border border-zinc-300 bg-zinc-100 p-0.5">
              <WindowButton
                active={windowFilter === "day"}
                onClick={() => setWindowFilter("day")}
              >
                Ganzer Tag
              </WindowButton>
              <WindowButton
                active={windowFilter === "1718"}
                onClick={() => setWindowFilter("1718")}
              >
                17–18 Uhr
              </WindowButton>
            </div>
          </div>
          <div className="hidden text-xs text-zinc-500 lg:block">
            <div className="mono text-zinc-800">DE0009652388</div>
            <div>Eurex Post-Trade · 15 min delay</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DayPicker days={days} date={date} onChange={setDate} />
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            Kontrakt
            <select
              className="mono rounded-md border border-zinc-300 bg-[#f4f4f4] px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-emerald-600"
              value={contract}
              onChange={(e) => {
                setContract(e.target.value);
                setPage(0);
              }}
              disabled={!contracts.length}
            >
              <option value="all">Alle · {formatInt(trades.length)}</option>
              {contracts.map((c) => (
                <option key={c.date} value={c.date}>
                  {formatDateShort(c.date)} · {formatInt(c.n)}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] ${
              health?.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {health?.ok ? "API verbunden" : "API offline"}
          </span>
          {live && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900">
              {waitingForIngest ? "Band wartet auf Ingest" : "Delayed-Tape"}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <main
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          tradesOpen
            ? "lg:grid-cols-[minmax(0,1.55fr)_minmax(400px,0.95fr)]"
            : "lg:grid-cols-[minmax(0,1fr)_2.75rem]"
        }`}
      >
        <section className="flex min-h-[420px] flex-col border-b border-zinc-200 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-sm text-zinc-800">{productName}</span>
              <span className={`mono text-xl font-bold leading-none ${up ? "text-emerald-700" : "text-rose-700"}`}>
                {formatPrice(stats?.close)}
              </span>
              <span className={`mono text-sm font-bold ${up ? "text-emerald-700" : "text-rose-700"}`}>
                {change == null
                  ? "—"
                  : `${change >= 0 ? "+" : ""}${formatPrice(change)} ${formatPct(changePct)}`}
              </span>
              <span className="text-xs text-zinc-500">
                Open <span className="mono text-zinc-800">{formatPrice(stats?.open)}</span>
              </span>
              <span className="text-xs text-zinc-500">
                Hoch <span className="mono text-zinc-800">{formatPrice(stats?.high)}</span>
              </span>
              <span className="text-xs text-zinc-500">
                Tief <span className="mono text-zinc-800">{formatPrice(stats?.low)}</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              <div className="flex gap-1">
                {[
                  { label: "15s", value: 15 },
                  { label: "1m", value: 60 },
                  { label: "5m", value: 300 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      bucket === opt.value
                        ? "bg-zinc-900 text-white"
                        : "border border-zinc-300 text-zinc-600"
                    }`}
                    onClick={() => setBucket(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 lg:hidden"
                onClick={() => setTradesOpen((open) => !open)}
              >
                {tradesOpen ? "Trades aus" : "Trades"}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3 pt-1">
            {loading && !trades.length ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Lade Chart…
              </div>
            ) : points.length ? (
              <PriceChart
                points={points}
                viewKey={`${date}|${windowFilter}|${contract}|${bucket}`}
                lastTick={lastTick}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                {windowFilter === "1718"
                  ? "Keine Trades zwischen 17:00 und 18:00."
                  : "Keine Trades für diesen Tag."}
              </div>
            )}
          </div>
        </section>

        {tradesOpen ? (
          <section className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-900">Trades</h2>
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-500">
                  {formatInt(visible.length)} Prints
                  {contract !== "all" ? " · ein Monat" : ""}
                  {windowFilter === "1718" ? " · 17–18" : ""}
                </div>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:text-zinc-900"
                  onClick={() => setTradesOpen(false)}
                >
                  Einklappen
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="sticky top-0 bg-[#f4f4f4] text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Zeit</th>
                    <th className="px-3 py-2 font-medium">Preis</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Kontrakt</th>
                  </tr>
                </thead>
                <tbody className="mono">
                  {slice.map((t) => (
                    <tr
                      key={t.external_id}
                      className="border-t border-zinc-200 hover:bg-zinc-100"
                    >
                      <td className="whitespace-nowrap px-4 py-1.5 text-zinc-800">
                        {formatClock(t.event_time, true)}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-900">{formatPrice(t.price)}</td>
                      <td className="px-3 py-1.5 text-zinc-600">{formatInt(t.quantity)}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
                        {formatDateShort(t.contract_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500">
              <span>
                Seite {page + 1} / {pages}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Zurück
                </button>
                <button
                  className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                >
                  Weiter
                </button>
              </div>
            </div>
          </section>
        ) : (
          <button
            type="button"
            className="hidden w-11 shrink-0 items-center justify-center self-stretch border-l border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:flex"
            onClick={() => setTradesOpen(true)}
            title="Trades einblenden"
          >
            <span className="flex rotate-180 flex-col items-center gap-2 [writing-mode:vertical-rl]">
              <span className="text-[11px] uppercase tracking-[0.18em]">Trades</span>
              <span className="mono text-[11px] text-zinc-400">{formatInt(visible.length)}</span>
            </span>
          </button>
        )}
      </main>

      <footer className="border-t border-zinc-200 px-5 py-2 text-[11px] text-zinc-500">
        Kein offizieller DAX. Delayed Eurex-Post-Trade, privat, ohne Weitergabe.
        {live
          ? ` Band ${new Date(tapeMs).toLocaleTimeString("de-DE", {
              timeZone: "Europe/Berlin",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })} · +15 min.`
          : ""}
        {health?.last_ingest?.finished_at
          ? ` Letzter Ingest: ${formatClock(health.last_ingest.finished_at)}.`
          : ""}
      </footer>
    </div>
  );
}

function DayPicker({
  days,
  date,
  onChange,
}: {
  days: DayRow[];
  date: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    parseYmd(date) ?? parseYmd(days[0]?.berlin_date ?? "") ?? parseYmd(berlinTodayYmd())!;
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const index = days.findIndex((d) => d.berlin_date === date);
  const older = index >= 0 && index < days.length - 1 ? days[index + 1] : null;
  const newer = index > 0 ? days[index - 1] : null;
  const stored = useMemo(() => new Map(days.map((d) => [d.berlin_date, d])), [days]);
  const cells = monthCells(view.year, view.month);

  useEffect(() => {
    if (!open) return;
    const parsed = parseYmd(date);
    if (parsed) setView({ year: parsed.year, month: parsed.month });
  }, [open, date]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      Tag
      <button
        type="button"
        className="rounded border border-zinc-300 px-2 py-1.5 text-zinc-800 disabled:opacity-30"
        disabled={!older}
        onClick={() => older && onChange(older.berlin_date)}
        title={older ? formatDay(older.berlin_date) : "Kein älterer Tag"}
      >
        ←
      </button>
      <button
        type="button"
        className="mono rounded-md border border-zinc-300 bg-[#f4f4f4] px-3 py-1.5 text-sm text-zinc-900 outline-none hover:border-emerald-600"
        onClick={() => setOpen(true)}
        disabled={!days.length}
      >
        {date ? formatDay(date) : "Datum wählen"}
      </button>
      <button
        type="button"
        className="rounded border border-zinc-300 px-2 py-1.5 text-zinc-800 disabled:opacity-30"
        disabled={!newer}
        onClick={() => newer && onChange(newer.berlin_date)}
        title={newer ? formatDay(newer.berlin_date) : "Kein neuerer Tag"}
      >
        →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-[#f4f4f4] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tag wählen"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-900">Tag wählen</h2>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:text-zinc-900"
                onClick={() => setOpen(false)}
              >
                Schließen
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between text-zinc-800">
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1"
                onClick={() => setView(shiftMonth(view, -1))}
              >
                ←
              </button>
              <div className="text-sm capitalize">{formatMonthTitle(view.year, view.month)}</div>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1"
                onClick={() => setView(shiftMonth(view, 1))}
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
              {cells.map((cell, cellIndex) => {
                if (!cell) {
                  return <div key={`pad-${cellIndex}`} />;
                }
                const row = stored.get(cell);
                const isSelected = cell === date;
                return (
                  <button
                    key={cell}
                    type="button"
                    disabled={!row}
                    onClick={() => row && pick(cell)}
                    className={`rounded py-2 text-sm ${
                      isSelected
                        ? "bg-zinc-900 text-white"
                        : row
                          ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                          : "text-zinc-300"
                    }`}
                  >
                    {Number(cell.slice(8))}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 border-t border-zinc-200 pt-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
                Gespeicherte Tage
              </div>
              {days.length ? (
                <div className="max-h-40 space-y-1 overflow-auto">
                  {days.map((d) => (
                    <button
                      key={d.berlin_date}
                      type="button"
                      onClick={() => pick(d.berlin_date)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                        d.berlin_date === date
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      <span>{formatDay(d.berlin_date)}</span>
                      <span className="mono text-xs text-zinc-500">
                        {formatInt(d.n_trades)} Trades
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Noch keine Tage gespeichert.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseYmd(value: string | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function shiftMonth(view: { year: number; month: number }, delta: number) {
  const date = new Date(view.year, view.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }
  return cells;
}

function WindowButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`rounded px-2.5 py-1 text-[11px] ${
        active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function summarizeTrades(rows: TradeRow[]) {
  if (!rows.length) return null;
  let low = rows[0].price;
  let high = rows[0].price;
  let volume = 0;
  for (const row of rows) {
    low = Math.min(low, row.price);
    high = Math.max(high, row.price);
    volume += row.quantity;
  }
  return {
    open: rows[0].price,
    close: rows[rows.length - 1].price,
    low,
    high,
    range: high - low,
    n: rows.length,
    volume,
  };
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

function contractLabel(contractDate: string): string {
  if (contractDate === "all") return "FDAX";
  const parsed = parseYmd(contractDate);
  if (!parsed) return "FDAX";
  return `FDAX ${MONTH_SHORT[parsed.month]} ${String(parsed.year).slice(2)}`;
}
