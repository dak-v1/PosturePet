export type PostureState = "calibrate" | "calibrating" | "steady" | "leaning" | "out-of-frame";

const CALIBRATION_MS = 2000;
export const MAX_SAMPLE_GAP_MS = 400;
export const LEAN_RATIO = 1.12;
const RECOVERY_RATIO = 1.07;
const NUDGE_COOLDOWN_MS = 10000;

export interface PostureReading {
  state: PostureState;
  score: number | null;
}

export function createPostureTracker() {
  let baseline: number | null = null;
  let calibration: number[] | null = null;
  let calibrationStart: number | null = null;
  let score: number | null = null;
  let previousTime: number | null = null;
  let leanStart: number | null = null;
  let lastNudge = -Infinity;
  let nudging = false;

  function interrupt() {
    if (calibration) calibration = [];
    calibrationStart = null;
    score = null;
    previousTime = null;
    leanStart = null;
    nudging = false;
  }

  return {
    calibrate() {
      baseline = null;
      calibration = [];
      lastNudge = -Infinity;
      interrupt();
    },
    interrupt,
    sample(width: number | null, now: number, holdMs: number): PostureReading {
      if (width === null) {
        interrupt();
        return { state: "out-of-frame", score: null };
      }
      if (previousTime !== null && now - previousTime > MAX_SAMPLE_GAP_MS) interrupt();
      previousTime = now;

      if (calibration) {
        calibrationStart ??= now;
        calibration.push(width);
        if (now - calibrationStart < CALIBRATION_MS || calibration.length < 8) {
          return { state: "calibrating", score: null };
        }
        calibration.sort((a, b) => a - b);
        baseline = calibration[Math.floor(calibration.length / 2)];
        calibration = null;
      }

      if (baseline === null) return { state: "calibrate", score: null };

      const ratio = width / baseline;
      score = score === null ? ratio : score * 0.75 + ratio * 0.25;

      if (nudging ? score < RECOVERY_RATIO : score < LEAN_RATIO) {
        leanStart = null;
        nudging = false;
      } else {
        leanStart ??= now;
        if (!nudging && now - leanStart >= holdMs && now - lastNudge >= NUDGE_COOLDOWN_MS) {
          nudging = true;
          lastNudge = now;
        }
      }

      return { state: nudging ? "leaning" : "steady", score };
    },
  };
}
