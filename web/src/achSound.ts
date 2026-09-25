const SRC = "/ach.mp3";

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let playing = false;
let endTimer = 0;

type AchListener = (state: { playing: boolean; durationMs: number }) => void;
const listeners = new Set<AchListener>();

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

function contextCtor(): AudioContextCtor | null {
  const fromWindow = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? fromWindow.webkitAudioContext ?? null;
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = contextCtor();
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

function decode(audioCtx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  if (audioCtx.decodeAudioData.length === 1) {
    return audioCtx.decodeAudioData(data);
  }
  return new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(data, resolve, reject);
  });
}

export function bufferAch(): Promise<void> {
  if (buffer) return Promise.resolve();
  if (loading) return loading;

  loading = (async () => {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const res = await fetch(SRC, { cache: "force-cache" });
    if (!res.ok) throw new Error(`ACH-Sound: ${res.status}`);
    buffer = await decode(audioCtx, await res.arrayBuffer());
  })().catch(() => {
    loading = null;
  });

  return loading;
}

export async function playAch(): Promise<void> {
  if (playing) return;
  try {
    await bufferAch();
    const audioCtx = getContext();
    if (!audioCtx || !buffer) return;
    const durationMs = Math.max(400, Math.round(buffer.duration * 1000));
    emitAch(true, durationMs);
    endTimer = window.setTimeout(() => emitAch(false, durationMs), durationMs + 120);
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.onended = () => emitAch(false, durationMs);
    source.start(0);
  } catch {
    emitAch(false);
  }
}
