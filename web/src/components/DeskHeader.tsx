import type { DayRow } from "../api";
import { bufferAch, playAch } from "../achSound";
import type { WindowFilter } from "../desk";
import { DayPicker } from "./DayPicker";
import { WindowButton } from "./ui";

export function DeskHeader({
  windowFilter,
  onWindowFilter,
  days,
  date,
  onDate,
}: {
  windowFilter: WindowFilter;
  onWindowFilter: (value: WindowFilter) => void;
  days: DayRow[];
  date: string;
  onDate: (value: string) => void;
}) {
  return (
    <header className="desk-header shrink-0">
      <div className="desk-toolbar flex h-full min-h-0 min-w-0 items-center justify-between gap-x-8">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            className="desk-figure-btn"
            aria-label="Sound abspielen"
            onPointerEnter={() => void bufferAch()}
            onFocus={() => void bufferAch()}
            onClick={() => void playAch()}
          >
            <img
              src="/avatar.png"
              alt=""
              width={44}
              height={44}
              className="desk-figure"
              decoding="async"
              draggable={false}
            />
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-3.5">
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
        <DayPicker days={days} date={date} onChange={onDate} compact />
      </div>
    </header>
  );
}
