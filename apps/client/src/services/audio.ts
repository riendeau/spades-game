const buffers = new Map<string, AudioBuffer>();
let ctx: AudioContext | null = null;
const activeSources = new Map<string, AudioBufferSourceNode>();

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

export async function preload(id: string, url: string): Promise<void> {
  if (buffers.has(id)) return;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await getContext().decodeAudioData(arrayBuffer);
    buffers.set(id, audioBuffer);
  } catch (err) {
    console.warn(`[audio] failed to preload "${id}":`, err);
  }
}

export function play(id: string): void {
  const buffer = buffers.get(id);
  if (!buffer) return;

  const audioCtx = getContext();
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  activeSources.set(id, source);
  source.onended = () => activeSources.delete(id);
}

export function stop(id: string): void {
  const source = activeSources.get(id);
  if (source) {
    source.stop();
    activeSources.delete(id);
  }
}
