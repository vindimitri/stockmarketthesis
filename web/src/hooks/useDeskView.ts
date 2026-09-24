import { useEffect, useMemo, useRef, useState } from "react";
import type { TradeRow } from "../api";
import {
  DEFAULT_CONTRACT,
  PAGE_SIZE,
  bucketsFor,
  defaultBucket,
  type ChartMode,
  type WindowFilter,
} from "../desk";
import { berlinChartRange, sliceTradesByBerlinHours } from "../format";
import { toLinePoints, toSessionPoints } from "../linePoints";
import { contractLabel, groupContracts, pageSlice, summarizeTrades } from "../lib/trades";

export function useDeskView(date: string, trades: TradeRow[], taped: TradeRow[], live: boolean) {
  const [page, setPage] = useState(0);
  const [bucket, setBucket] = useState(60);
  const [contract, setContract] = useState("all");
  const [windowFilter, setWindowFilterState] = useState<WindowFilter>("day");
  const [chartMode, setChartMode] = useState<ChartMode>("overview");
  const defaultedForDate = useRef("");

  const contracts = useMemo(() => groupContracts(trades), [trades]);

  useEffect(() => {
    if (!date || !contracts.length) return;
    if (defaultedForDate.current === date) return;
    defaultedForDate.current = date;
    const hasDefault = contracts.some((item) => item.date === DEFAULT_CONTRACT);
    setContract(hasDefault ? DEFAULT_CONTRACT : (contracts[0]?.date ?? "all"));
  }, [date, contracts]);

  useEffect(() => {
    setPage(0);
  }, [contract, date]);

  useEffect(() => {
    setChartMode("overview");
  }, [date]);

  const setWindowFilter = (next: WindowFilter) => {
    setWindowFilterState(next);
    setBucket(defaultBucket(next));
    setChartMode("overview");
    setPage(0);
  };

  const bucketOptions = bucketsFor(windowFilter);

  const byContract = useMemo(
    () => (contract === "all" ? taped : taped.filter((t) => t.contract_date === contract)),
    [taped, contract],
  );

  const visible = useMemo(
    () =>
      windowFilter === "1718"
        ? sliceTradesByBerlinHours(byContract, date, 17, 18)
        : byContract,
    [byContract, windowFilter, date],
  );

  const chartRange = useMemo(() => berlinChartRange(date, windowFilter), [date, windowFilter]);
  const points = useMemo(() => {
    if (chartMode === "overview" && chartRange) {
      return toSessionPoints(visible, bucket, chartRange.from, chartRange.to);
    }
    return toLinePoints(visible, bucket);
  }, [visible, bucket, chartMode, chartRange]);
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
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const slice = pageSlice(visible, Math.min(page, pages - 1), PAGE_SIZE, live);

  useEffect(() => {
    setPage((current) => Math.min(current, pages - 1));
  }, [pages]);

  const change = stats ? stats.close - stats.open : null;
  const changePct = stats && stats.open ? (change! / stats.open) * 100 : null;

  return {
    windowFilter,
    setWindowFilter,
    chartMode,
    setChartMode,
    contract,
    bucket,
    setBucket,
    bucketOptions,
    page,
    setPage,
    pages,
    slice,
    tradeCount: visible.length,
    points,
    lastTick,
    last: stats?.close ?? null,
    productName: contractLabel(contract),
    change,
    changePct,
    up: (change ?? 0) >= 0,
  };
}
