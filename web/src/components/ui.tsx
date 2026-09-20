export function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="desk-stat">
      <span className="desk-stat-label">{label}</span>
      <span className="desk-stat-value">{value}</span>
    </div>
  );
}

export function WindowButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`desk-segment-btn ${active ? "desk-segment-btn-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
