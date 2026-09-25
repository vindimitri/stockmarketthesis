import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DayRow } from "../api";
import { berlinTodayYmd, formatDay, formatMonthTitle, parseYmd } from "../format";

export function DayPicker({
  days,
  date,
  onChange,
}: {
  days: DayRow[];
  date: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const selected =
    parseYmd(date) ?? parseYmd(days[0]?.berlin_date ?? "") ?? parseYmd(berlinTodayYmd())!;
  const [view, setView] = useState({ year: selected.year, month: selected.month });
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
    dialogRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const pick = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <div className="desk-date">
      <button
        type="button"
        className="desk-date-btn"
        onClick={() => setOpen(true)}
        disabled={!days.length}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="desk-date-kicker">Handelstag</span>
        <span>{date ? formatDay(date) : "Datum wählen"}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="desk-modal-scrim fixed inset-0 z-50 flex items-center justify-center px-4"
            onClick={() => setOpen(false)}
          >
            <div
              ref={dialogRef}
              className="desk-dialog w-full max-w-sm p-5"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Tag wählen"
              tabIndex={-1}
            >
              <div className="mb-4 flex items-center justify-between border-b border-desk-border pb-3">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  Tag wählen
                </h2>
                <button type="button" className="desk-btn" onClick={() => setOpen(false)}>
                  Schließen
                </button>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  className="desk-btn"
                  onClick={() => setView(shiftMonth(view, -1))}
                  aria-label="Vorheriger Monat"
                >
                  ‹
                </button>
                <div className="text-sm capitalize">{formatMonthTitle(view.year, view.month)}</div>
                <button
                  type="button"
                  className="desk-btn"
                  onClick={() => setView(shiftMonth(view, 1))}
                  aria-label="Nächster Monat"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-desk-ink-faint">
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
                      aria-current={isSelected ? "date" : undefined}
                      onClick={() => row && pick(cell)}
                      className={`desk-cal-day ${
                        isSelected ? "is-on" : row ? "is-ok" : "is-off"
                      }`}
                    >
                      {Number(cell.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function shiftMonth(view: { year: number; month: number }, delta: number) {
  const next = new Date(view.year, view.month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function monthCells(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}
