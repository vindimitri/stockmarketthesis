type ClipId = "ach" | "panik";

const SRC: Record<ClipId, string> = {
  ach: "/ach.mp3",
  panik: "/panik.mp3",
};

/** Approximate lengths used until media metadata is ready (ms). */
const FALLBACK_MS: Record<ClipId, number> = {
  ach: 2800,
  panik: 17000,
};

type AchListener = (state: { playing: boolean; durationMs: number }) => void;
const listeners = new Set<AchListener>();

let playing = false;
let endTimer = 0;
let active: HTMLAudioElement | null = null;
let unlocked = false;
/** Separate element so unlock never races the audible players. */
let gate: HTMLAudioElement | null = null;

const players: Partial<Record<ClipId, HTMLAudioElement>> = {};

function emitAch(next: boolean, durationMs = 0) {
  if (!next && endTimer) {
    window.clearTimeout(endTimer);
    endTimer = 0;
  }
  playing = next;
  for (const listener of listeners) listener({ playing: next, durationMs });
}

export function subscribeAch(listener: AchListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function makeAudio(src: string): HTMLAudioElement {
  const el = new Audio();
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  el.src = src;
  el.load();
  return el;
}

function getPlayer(id: ClipId): HTMLAudioElement {
  let el = players[id];
  if (el) return el;
  el = makeAudio(SRC[id]);
  players[id] = el;
  return el;
}

function durationMsOf(el: HTMLAudioElement, id: ClipId): number {
  const sec = el.duration;
  if (Number.isFinite(sec) && sec > 0) return Math.max(400, Math.round(sec * 1000));
  return FALLBACK_MS[id];
}

/**
 * Call from pointerdown (same tap as play). Unlocks iOS/Android autoplay
 * policies before any await breaks the user-gesture chain.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  if (!gate) gate = makeAudio(SRC.ach);
  gate.muted = true;
  const run = gate.play();
  if (run && typeof run.then === "function") {
    void run
      .then(() => {
        gate!.pause();
        gate!.currentTime = 0;
        gate!.muted = false;
        unlocked = true;
      })
      .catch(() => {
        gate!.muted = false;
      });
  } else {
    gate.muted = false;
    unlocked = true;
  }
}

export function bufferClip(id: ClipId): Promise<void> {
  const el = getPlayer(id);
  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("canplaythrough", done);
      el.removeEventListener("loadeddata", done);
      resolve();
    };
    el.addEventListener("canplaythrough", done, { once: true });
    el.addEventListener("loadeddata", done, { once: true });
    el.load();
    window.setTimeout(done, 2500);
  });
}

export function bufferAch(): Promise<void> {
  return bufferClip("ach");
}

export function bufferPanik(): Promise<void> {
  return bufferClip("panik");
}

function stopActive(opts?: { quiet?: boolean }) {
  if (active) {
    active.onended = null;
    active.onpause = null;
    try {
      active.pause();
      active.currentTime = 0;
    } catch {
      /* ignore */
    }
    active = null;
  }
  if (endTimer) {
    window.clearTimeout(endTimer);
    endTimer = 0;
  }
  if (playing && !opts?.quiet) emitAch(false);
}

async function playClip(id: ClipId): Promise<void> {
  unlockAudio();
  stopActive({ quiet: true });

  const el = getPlayer(id);
  el.muted = false;
  el.volume = 1;
  try {
    el.pause();
    el.currentTime = 0;
  } catch {
    /* ignore */
  }

  active = el;
  const durationMs = durationMsOf(el, id);

  const finish = () => {
    if (active !== el) return;
    active = null;
    emitAch(false, durationMs);
  };

  el.onended = finish;
  el.onpause = () => {
    if (active !== el) return;
    if (el.ended || el.currentTime <= 0.05) finish();
  };

  try {
    const start = el.play();
    emitAch(true, durationMs);
    endTimer = window.setTimeout(finish, durationMs + 200);
    if (start && typeof start.then === "function") await start;
  } catch {
    active = null;
    emitAch(false);
  }
}

export function playAch(): Promise<void> {
  return playClip("ach");
}

export function playPanik(): Promise<void> {
  return playClip("panik");
}
