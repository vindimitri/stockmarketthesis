import { useEffect, useMemo, useRef, useState } from "react";
import type { TradeRow } from "../api";
import { DEFAULT_CONTRACT, bucketsFor, defaultBucket, type WindowFilter } from "../desk";
import { berlinChartRange, sliceTradesByBerlinHours } from "../format";
import { toLinePoints, toSessionPoints, toSessionVolumePoints, toVolumePoints } from "../linePoints";
import { contractLabel, groupContracts, summarizeTrades } from "../lib/trades";

export function useDeskView(date: string, trades: TradeRow[], taped: TradeRow[]) {
  const [bucket, setBucket] = useState(60);
  const [contract, setContract] = useState("all");
  const [windowFilter, setWindowFilterState] = useState<WindowFilter>("day");
  const defaultedForDate = useRef("");

  const contracts = useMemo(() => groupContracts(trades), [trades]);

  useEffect(() => {
    if (!date || !contracts.length) return;
    if (defaultedForDate.current === date) return;
    defaultedForDate.current = date;
    const hasDefault = contracts.some((item) => item.date === DEFAULT_CONTRACT);
    setContract(hasDefault ? DEFAULT_CONTRACT : (contracts[0]?.date ?? "all"));
  }, [date, contracts]);

  const setWindowFilter = (next: WindowFilter) => {
    setWindowFilterState(next);
    setBucket(defaultBucket(next));
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
        : sliceTradesByBerlinHours(byContract, date, 8, 22),
    [byContract, windowFilter, date],
  );

  const chartRange = useMemo(() => berlinChartRange(date, windowFilter), [date, windowFilter]);
  const points = useMemo(() => {
    if (chartRange) {
      return toSessionPoints(visible, bucket, chartRange.from, chartRange.to);
    }
    return toLinePoints(visible, bucket);
  }, [visible, bucket, chartRange]);
  const volumePoints = useMemo(() => {
    if (chartRange) {
      return toSessionVolumePoints(visible, bucket, chartRange.from, chartRange.to);
    }
    return toVolumePoints(visible, bucket);
  }, [visible, bucket, chartRange]);
  const volumeTotal = useMemo(
    () => visible.reduce((sum, trade) => sum + trade.quantity, 0),
    [visible],
  );
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
  const change = stats ? stats.close - stats.open : null;
  const changePct = stats && stats.open ? (change! / stats.open) * 100 : null;

  return {
    windowFilter,
    setWindowFilter,
    contract,
    bucket,
    setBucket,
    bucketOptions,
    points,
    volumePoints,
    volumeTotal,
    lastTick,
    last: stats?.close ?? null,
    productName: contractLabel(contract),
    change,
    changePct,
  };
}
