import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { subscribeAch } from "./lib/achSound";
import { DeskHeader } from "./components/DeskHeader";
import { DerivativesPanel } from "./components/DerivativesPanel";
import { QuotePanel } from "./components/QuotePanel";
import { useDeskData } from "./hooks/useDeskData";
import { useDeskView } from "./hooks/useDeskView";
import { useKnockouts } from "./hooks/useKnockouts";
import { useScrollIdleBridge } from "./hooks/useScrollIdle";
import { berlinTodayYmd } from "./lib/format";

export default function App() {
  useScrollIdleBridge(160);
  const { days, date, setDate, trades, loading, error, live, ingestActive, taped } =
    useDeskData();
  const view = useDeskView(date, trades, taped);
  const { rows: knockoutRows, historyReady: knockoutsReady } = useKnockouts(days);
  const [soundMs, setSoundMs] = useState(0);
  const tradeMarks = useMemo(() => {
    if (!knockoutsReady || view.windowFilter !== "1718") return [];
    return knockoutRows
      .filter((item) => item.date === date)
      .map((row) => ({
        buyTime: row.buyTime,
        sellTime: row.sellTime,
        changePct: row.changePct,
        title: row.title,
      }));
  }, [view.windowFilter, knockoutRows, date, knockoutsReady]);

  useEffect(() => {
    let until = 0;
    let clear = 0;
    const stop = subscribeAch(({ playing, durationMs }) => {
      window.clearTimeout(clear);
      if (playing) {
        until = Date.now() + durationMs;
        setSoundMs(durationMs);
        return;
      }
      clear = window.setTimeout(() => setSoundMs(0), Math.max(0, until - Date.now()));
    });
    return () => {
      window.clearTimeout(clear);
      stop();
    };
  }, []);

  return (
    <div
      className={`desk-shell${soundMs ? " is-sounding" : ""}`}
      style={soundMs ? ({ "--sound-ms": `${soundMs}ms` } as CSSProperties) : undefined}
    >
      <DeskHeader
        days={days}
        date={date}
        onDate={setDate}
        todayActive={date === berlinTodayYmd() && view.windowFilter === "day"}
        onToday={() => {
          view.setWindowFilter("day");
          setDate(berlinTodayYmd());
        }}
      />

      {error && (
        <div className="mx-4 mt-3 border border-desk-down-soft bg-desk-down-soft px-4 py-2 text-sm text-desk-down">
          {error}
        </div>
      )}

      <main className="desk-workbench">
        <QuotePanel
          productName={view.productName}
          last={view.last}
          change={view.change}
          changePct={view.changePct}
          bucket={view.bucket}
          onBucket={view.setBucket}
          bucketOptions={view.bucketOptions}
          loading={loading}
          hasTrades={Boolean(trades.length)}
          hasDays={Boolean(days.length)}
          points={view.points}
          volumePoints={view.volumePoints}
          volumeTotal={view.volumeTotal}
          viewKey={`${date}|${view.windowFilter}|${view.contract}|${view.bucket}`}
          lastTick={view.lastTick}
          trackLast={live && ingestActive}
          showSeconds={view.windowFilter === "1718"}
          windowFilter={view.windowFilter}
          onWindowFilter={view.setWindowFilter}
          tradeMarks={tradeMarks}
        />
        <DerivativesPanel
          rows={knockoutRows}
          bankrollReady={knockoutsReady}
          date={date}
          windowFilter={view.windowFilter}
          onOpen={(ymd) => {
            view.setWindowFilter("1718");
            setDate(ymd);
          }}
        />
      </main>
    </div>
  );
}
