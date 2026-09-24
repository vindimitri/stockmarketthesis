const SRC = "/ach.mp3";

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
let playing = false;

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
  playing = true;
  try {
    await bufferAch();
    const audioCtx = getContext();
    if (!audioCtx || !buffer) {
      playing = false;
      return;
    }
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
      playing = false;
    };
    source.start(0);
  } catch {
    playing = false;
  }
}
