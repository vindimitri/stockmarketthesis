import type { IChartApi } from "lightweight-charts";
import { isMobileUi } from "../media";

/** Chart gesture options: mobile keeps vertical page scroll, allows horizontal pan + pinch. */
export function chartInteractionOptions(locked: boolean) {
  const mobile = isMobileUi();
  if (mobile) {
    return {
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: false,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    } as const;
  }
  return {
    handleScale: {
      mouseWheel: !locked,
      pinch: !locked,
      axisPressedMouseMove: !locked,
      axisDoubleClickReset: !locked,
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: !locked,
      horzTouchDrag: !locked,
      vertTouchDrag: !locked,
    },
  } as const;
}

/**
 * Mobile follow-mode: auto-fit while idle; after the user pans/pinches, stop fighting their view
 * until the next viewKey reset (caller calls reset()).
 */
export function attachMobileFollow(host: HTMLElement, chart: IChartApi): {
  shouldFollow: () => boolean;
  reset: () => void;
  detach: () => void;
} {
  if (!isMobileUi()) {
    return {
      shouldFollow: () => true,
      reset: () => {},
      detach: () => {},
    };
  }

  let follow = true;
  let touching = false;

  const onStart = () => {
    touching = true;
  };
  const onEnd = () => {
    touching = false;
  };
  const onRange = () => {
    if (touching) follow = false;
  };

  host.addEventListener("touchstart", onStart, { passive: true });
  host.addEventListener("touchend", onEnd, { passive: true });
  host.addEventListener("touchcancel", onEnd, { passive: true });
  chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

  return {
    shouldFollow: () => follow,
    reset: () => {
      follow = true;
    },
    detach: () => {
      host.removeEventListener("touchstart", onStart);
      host.removeEventListener("touchend", onEnd);
      host.removeEventListener("touchcancel", onEnd);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
    },
  };
}
