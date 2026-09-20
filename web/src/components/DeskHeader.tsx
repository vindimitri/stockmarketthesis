import type { DayRow } from "../api";
import type { WindowFilter } from "../desk";
import { formatDateShort, formatInt } from "../format";
import type { ContractRow } from "../lib/trades";
import { DayPicker } from "./DayPicker";
import { WindowButton } from "./ui";

export function DeskHeader({
  windowFilter,
  onWindowFilter,
  days,
  date,
  onDate,
  contract,
  onContract,
  contracts,
  tradeCount,
}: {
  windowFilter: WindowFilter;
  onWindowFilter: (value: WindowFilter) => void;
  days: DayRow[];
  date: string;
  onDate: (value: string) => void;
  contract: string;
  onContract: (value: string) => void;
  contracts: ContractRow[];
  tradeCount: number;
}) {
  return (
    <header className="desk-card desk-header shrink-0 border-x-0 border-t-0">
      <div className="desk-toolbar flex h-full min-h-0 min-w-0 items-center justify-between gap-x-8">
        <div className="flex min-w-0 items-center gap-5">
          <img
            src="/logo.png"
            alt=""
            width={72}
            height={156}
            className="desk-figure"
            decoding="async"
            draggable={false}
          />
          <div className="min-w-0">
            <div className="desk-label">Privatdesk</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1>FDAX Delayed</h1>
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
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <DayPicker days={days} date={date} onChange={onDate} />
          <label className="flex flex-col gap-1 text-desk-ink-muted">
            <span className="desk-label">Kontrakt</span>
            <select
              className="desk-input mono min-w-[11.5rem]"
              value={contract}
              onChange={(e) => onContract(e.target.value)}
              disabled={!contracts.length}
            >
              <option value="all">Alle · {formatInt(tradeCount)}</option>
              {contracts.map((c) => (
                <option key={c.date} value={c.date}>
                  {formatDateShort(c.date)} · {formatInt(c.n)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
