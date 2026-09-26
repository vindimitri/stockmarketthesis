type ClipId = "ach" | "panik";

const SRC: Record<ClipId, string> = {
  ach: "/ach.mp3",
  panik: "/panik.mp3",
};

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const buffers: Partial<Record<ClipId, AudioBuffer>> = {};
const loading: Partial<Record<ClipId, Promise<void>>> = {};
let playing = false;
let endTimer = 0;
let activeSource: AudioBufferSourceNode | null = null;

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

export function bufferClip(id: ClipId): Promise<void> {
  if (buffers[id]) return Promise.resolve();
  if (loading[id]) return loading[id]!;

  loading[id] = (async () => {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const res = await fetch(SRC[id], { cache: "force-cache" });
    if (!res.ok) throw new Error(`Sound ${id}: ${res.status}`);
    buffers[id] = await decode(audioCtx, await res.arrayBuffer());
  })().catch(() => {
    delete loading[id];
  });

  return loading[id]!;
}

export function bufferAch(): Promise<void> {
  return bufferClip("ach");
}

export function bufferPanik(): Promise<void> {
  return bufferClip("panik");
}

async function playClip(id: ClipId): Promise<void> {
  if (playing) return;
  try {
    await bufferClip(id);
    const audioCtx = getContext();
    const clip = buffers[id];
    if (!audioCtx || !clip) return;
    const durationMs = Math.max(400, Math.round(clip.duration * 1000));
    emitAch(true, durationMs);
    endTimer = window.setTimeout(() => emitAch(false, durationMs), durationMs + 120);
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const source = audioCtx.createBufferSource();
    activeSource = source;
    source.buffer = clip;
    source.connect(audioCtx.destination);
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      emitAch(false, durationMs);
    };
    source.start(0);
  } catch {
    emitAch(false);
  }
}

export function playAch(): Promise<void> {
  return playClip("ach");
}

export function playPanik(): Promise<void> {
  return playClip("panik");
}
