import { useEffect, useState, type CSSProperties } from "react";
import { subscribeAch } from "./achSound";
import { DeskHeader } from "./components/DeskHeader";
import { NewsPanel } from "./components/NewsPanel";
import { QuotePanel } from "./components/QuotePanel";
import { useDeskData } from "./hooks/useDeskData";
import { useDeskView } from "./hooks/useDeskView";

export default function App() {
  const { days, date, setDate, trades, loading, error, live, ingestActive, taped } =
    useDeskData();
  const view = useDeskView(date, trades, taped);
  const [soundMs, setSoundMs] = useState(0);

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
      <DeskHeader days={days} date={date} onDate={setDate} />

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
        />
        <NewsPanel />
      </main>
    </div>
  );
}
