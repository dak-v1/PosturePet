import { LEAN_RATIO, MAX_SAMPLE_GAP_MS } from "./posture";

export const COMPARISON_SECONDS = 30;
const WINDOW_MS = COMPARISON_SECONDS * 1000;

type Phase = "hidden" | "preview" | "measuring" | "complete";

export interface Comparison {
  phase: Phase;
  beforeSeconds: number;
  afterSeconds: number;
  result: { before: number; after: number } | null;
}

type Interval = { duration: number; leaning: boolean };

function createWindow() {
  const intervals: Interval[] = [];
  let duration = 0;
  let leaningTime = 0;

  return {
    get duration() { return duration; },
    get percentLeaning() { return Math.round(100 * leaningTime / duration); },
    add(interval: Interval) {
      const last = intervals.at(-1);
      if (last?.leaning === interval.leaning) last.duration += interval.duration;
      else intervals.push(interval);
      duration += interval.duration;
      if (interval.leaning) leaningTime += interval.duration;

      while (duration > WINDOW_MS) {
        const oldest = intervals[0];
        const excess = Math.min(oldest.duration, duration - WINDOW_MS);
        oldest.duration -= excess;
        duration -= excess;
        if (oldest.leaning) leaningTime -= excess;
        if (oldest.duration <= 0) intervals.shift();
      }
    },
  };
}

export const EMPTY_COMPARISON: Comparison = {
  phase: "hidden",
  beforeSeconds: 0,
  afterSeconds: 0,
  result: null,
};

export function createLeanComparison() {
  let phase: Phase = "hidden";
  let before = createWindow();
  let after = createWindow();
  let previous: { time: number; leaning: boolean } | null = null;

  function interrupt() {
    previous = null;
  }

  function snapshot(): Comparison {
    return {
      phase,
      beforeSeconds: Math.floor(before.duration / 1000),
      afterSeconds: Math.floor(after.duration / 1000),
      result: phase === "complete" ? { before: before.percentLeaning, after: after.percentLeaning } : null,
    };
  }

  function close() {
    if (phase === "measuring" || phase === "complete") before = createWindow();
    after = createWindow();
    phase = "hidden";
    interrupt();
    return EMPTY_COMPARISON;
  }

  return {
    interrupt,
    open() {
      if (phase === "hidden") phase = "preview";
      return snapshot();
    },
    begin() {
      if (phase === "preview" && before.duration >= WINDOW_MS) {
        phase = "measuring";
        interrupt();
      }
      return snapshot();
    },
    close,
    reset() {
      before = createWindow();
      return close();
    },
    sample(score: number | null, time: number) {
      if (score === null) {
        interrupt();
        return;
      }

      const last = previous;
      previous = { time, leaning: score >= LEAN_RATIO };
      if (!last) return;

      const duration = time - last.time;
      if (duration <= 0 || duration > MAX_SAMPLE_GAP_MS) return;

      if (phase === "hidden") {
        before.add({ duration, leaning: last.leaning });
        return;
      }
      if (phase === "preview" && before.duration < WINDOW_MS) {
        before.add({ duration: Math.min(duration, WINDOW_MS - before.duration), leaning: last.leaning });
        return snapshot();
      }
      if (phase === "measuring") {
        after.add({ duration: Math.min(duration, WINDOW_MS - after.duration), leaning: last.leaning });
        if (after.duration >= WINDOW_MS) phase = "complete";
        return snapshot();
      }
    },
  };
}
