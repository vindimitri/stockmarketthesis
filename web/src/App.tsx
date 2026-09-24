import { DeskHeader } from "./components/DeskHeader";
import { QuotePanel } from "./components/QuotePanel";
import { TradesPanel } from "./components/TradesPanel";
import { useDeskData } from "./hooks/useDeskData";
import { useDeskView } from "./hooks/useDeskView";

export default function App() {
  const { days, date, setDate, trades, loading, error, live, ingestActive, taped } =
    useDeskData();
  const view = useDeskView(date, trades, taped, live);

  return (
    <div className="desk-shell">
      <DeskHeader
        windowFilter={view.windowFilter}
        onWindowFilter={view.setWindowFilter}
        days={days}
        date={date}
        onDate={setDate}
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
          up={view.up}
          bucket={view.bucket}
          onBucket={view.setBucket}
          bucketOptions={view.bucketOptions}
          loading={loading}
          hasTrades={Boolean(trades.length)}
          hasDays={Boolean(days.length)}
          points={view.points}
          viewKey={`${date}|${view.windowFilter}|${view.contract}|${view.bucket}|${view.chartMode}`}
          lastTick={view.lastTick}
          trackLast={live && ingestActive}
          showSeconds={view.windowFilter === "1718"}
          windowFilter={view.windowFilter}
          chartMode={view.chartMode}
          onChartMode={view.setChartMode}
        />
        <TradesPanel
          count={view.tradeCount}
          windowFilter={view.windowFilter}
          rows={view.slice}
          page={view.page}
          pages={view.pages}
          onPage={view.setPage}
        />
      </main>
    </div>
  );
}
