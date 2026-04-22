export type SseStageEvent = { stage: string };
export type SseDoneEvent = { stage: 'done'; result: unknown };
export type SseErrorEvent = { stage: 'error'; message: string };

export interface SseCallbacks {
  onStage: (stage: string) => void;
  onDone: (result: unknown) => void;
  onError: (message: string) => void;
}

const MIN_STAGE_MS = 300;

export async function consumeSseStream(
  response: Response,
  callbacks: SseCallbacks,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let stageShownAt = 0;

  const showStage = async (stage: string) => {
    const elapsed = Date.now() - stageShownAt;
    if (stageShownAt > 0 && elapsed < MIN_STAGE_MS) {
      await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
    }
    callbacks.onStage(stage);
    stageShownAt = Date.now();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json) continue;

        let event: SseStageEvent | SseDoneEvent | SseErrorEvent;
        try {
          event = JSON.parse(json);
        } catch {
          continue;
        }

        if (event.stage === 'done') {
          const elapsed = Date.now() - stageShownAt;
          if (stageShownAt > 0 && elapsed < MIN_STAGE_MS) {
            await new Promise((r) => setTimeout(r, MIN_STAGE_MS - elapsed));
          }
          callbacks.onDone((event as SseDoneEvent).result);
          return;
        } else if (event.stage === 'error') {
          callbacks.onError((event as SseErrorEvent).message ?? 'Unknown error');
          return;
        } else {
          await showStage(event.stage);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
