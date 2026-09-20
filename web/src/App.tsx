import { DeskHeader } from "./components/DeskHeader";
import { QuotePanel } from "./components/QuotePanel";
import { TradesPanel } from "./components/TradesPanel";
import { useDeskData } from "./hooks/useDeskData";
import { useDeskView } from "./hooks/useDeskView";

export default function App() {
  const { days, date, setDate, trades, loading, error, live, taped } = useDeskData();
  const view = useDeskView(date, trades, taped, live);

  return (
    <div className="desk-shell">
      <DeskHeader
        windowFilter={view.windowFilter}
        onWindowFilter={view.setWindowFilter}
        days={days}
        date={date}
        onDate={setDate}
        contract={view.contract}
        onContract={view.setContract}
        contracts={view.contracts}
        tradeCount={trades.length}
      />

      {error && (
        <div className="mx-4 mt-3 border border-desk-down-soft bg-desk-down-soft px-4 py-2 text-sm text-desk-down">
          {error}
        </div>
      )}

      <main className="grid min-h-[28rem] flex-1 grid-cols-1 gap-px bg-desk-border p-px lg:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.85fr)]">
        <QuotePanel
          productName={view.productName}
          stats={view.stats}
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
          viewKey={`${date}|${view.windowFilter}|${view.contract}|${view.bucket}`}
          lastTick={view.lastTick}
          showSeconds={view.windowFilter === "1718"}
          windowFilter={view.windowFilter}
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
