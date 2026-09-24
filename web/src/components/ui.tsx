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
