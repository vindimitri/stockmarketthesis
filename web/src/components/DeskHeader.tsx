import { useRef } from "react";
import type { DayRow } from "../api";
import { bufferAch, bufferPanik, playAch, playPanik } from "../achSound";
import { DayPicker } from "./DayPicker";

function bounceButton(btn: HTMLButtonElement | null, lock: { current: boolean }) {
  if (!btn || lock.current) return;
  lock.current = true;
  const press = btn.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(0.78)", offset: 0.28 },
      { transform: "scale(1.12)", offset: 0.68 },
      { transform: "scale(1)" },
    ],
    {
      duration: 340,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "none",
    },
  );
  press.onfinish = () => {
    lock.current = false;
  };
}

export function DeskHeader({
  days,
  date,
  onDate,
}: {
  days: DayRow[];
  date: string;
  onDate: (value: string) => void;
}) {
  const bouncing = useRef(false);

  return (
    <header className="desk-header shrink-0">
      <div className="desk-toolbar flex h-full min-h-0 min-w-0 items-center justify-between gap-x-8">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            className="desk-figure-btn"
            aria-label="ACH abspielen"
            onPointerEnter={() => void bufferAch()}
            onFocus={() => void bufferAch()}
            onClick={(event) => {
              void playAch();
              bounceButton(event.currentTarget, bouncing);
            }}
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
          <div className="desk-brand">
            <h1>FDAX Delayed</h1>
          </div>
          <button
            type="button"
            className="desk-figure-btn"
            aria-label="Panikverkauf abspielen"
            onPointerEnter={() => void bufferPanik()}
            onFocus={() => void bufferPanik()}
            onClick={(event) => {
              void playPanik();
              bounceButton(event.currentTarget, bouncing);
            }}
          >
            <img
              src="/felix.png"
              alt=""
              width={44}
              height={44}
              className="desk-figure"
              decoding="async"
              draggable={false}
            />
          </button>
        </div>
        <DayPicker days={days} date={date} onChange={onDate} />
      </div>
    </header>
  );
}
