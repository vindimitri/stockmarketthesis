/** True for phone/tablet-ish viewports or touch-primary devices. */
export function isMobileUi(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches;
}
