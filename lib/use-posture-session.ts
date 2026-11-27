"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPostureTracker, type PostureReading } from "./posture";
import { createLeanComparison, EMPTY_COMPARISON } from "./lean-comparison";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const SAMPLE_INTERVAL_MS = 100;
const DEMO_HOLD_MS = 5000;
const REGULAR_HOLD_MS = 18000;
const CPU_STARTUP_MESSAGE = "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";

type SessionState = PostureReading["state"] | "idle" | "starting" | "paused" | "error";

let landmarkerInitialization = Promise.resolve();

function loadPoseLandmarker() {
  // MediaPipe uses a shared WASM bootstrap, including when a session restarts mid-load.
  const loading = landmarkerInitialization.then(createPoseLandmarker);
  landmarkerInitialization = loading.then(() => undefined, () => undefined);
  return loading;
}

async function createPoseLandmarker() {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks(WASM_URL);

  // The pinned MediaPipe loader passes self.Module to Emscripten at startup.
  // Route the CPU startup notice as info while preserving all other stderr messages.
  const runtime = self as typeof self & { Module?: { printErr?: (message: string) => void } };
  const previous = runtime.Module;
  const settings = {
    ...previous,
    printErr(message: string) {
      if (message.trim() === CPU_STARTUP_MESSAGE) console.info(message);
      else if (previous?.printErr) previous.printErr(message);
      else console.error(message);
    },
  };

  runtime.Module = settings;
  try {
    return await PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } finally {
    if (runtime.Module === settings || runtime.Module === undefined) runtime.Module = previous;
  }
}

function shoulderWidth(pose: NormalizedLandmark[] | undefined, aspectRatio: number) {
  const nose = pose?.[0];
  const left = pose?.[11];
  const right = pose?.[12];
  if (!nose || !left || !right || Math.min(nose.visibility, left.visibility, right.visibility) < 0.65) {
    return null;
  }

  const width = Math.hypot((left.x - right.x) * aspectRatio, left.y - right.y);
  return Number.isFinite(width) && width > 0 ? width : null;
}

export function usePostureSession(demoMode: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracker = useRef<ReturnType<typeof createPostureTracker> | null>(null);
  const comparisonTracker = useRef<ReturnType<typeof createLeanComparison> | null>(null);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<SessionState>("idle");
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState(EMPTY_COMPARISON);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;

    let disposed = false;
    let stream: MediaStream | undefined;
    let landmarker: PoseLandmarker | undefined;
    let frame = 0;
    let lastSample = -Infinity;
    let lastVideoTime = -1;
    const detector = createPostureTracker();
    tracker.current = detector;
    const measurement = createLeanComparison();
    comparisonTracker.current = measurement;

    function release() {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      if (video) video.srcObject = null;
      landmarker?.close();
      landmarker = undefined;
    }

    function fail(message: string) {
      release();
      setComparison(measurement.reset());
      setScore(null);
      setError(message);
      setState("error");
    }

    function sample(now: number) {
      if (!video || !landmarker || document.hidden) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastSample >= SAMPLE_INTERVAL_MS) {
        lastVideoTime = video.currentTime;
        lastSample = now;

        try {
          const { landmarks } = landmarker.detectForVideo(video, now);
          const width = shoulderWidth(landmarks[0], video.videoWidth / video.videoHeight);
          const reading = detector.sample(width, now, demoMode ? DEMO_HOLD_MS : REGULAR_HOLD_MS);
          setState(reading.state);
          setScore(reading.score === null ? null : Math.round(reading.score * 100));
          const update = measurement.sample(reading.score, now);
          if (update) {
            setComparison((current) =>
              current.phase === update.phase && current.beforeSeconds === update.beforeSeconds &&
              current.afterSeconds === update.afterSeconds ? current : update);
          }
        } catch {
          fail("Posture tracking stopped. Restart the session to try again.");
          return;
        }
      }
      frame = requestAnimationFrame(sample);
    }

    function onVisibilityChange() {
      if (!landmarker) return;
      cancelAnimationFrame(frame);
      detector.interrupt();
      measurement.interrupt();
      setScore(null);
      if (document.hidden) {
        setState("paused");
      } else {
        lastSample = -Infinity;
        lastVideoTime = -1;
        frame = requestAnimationFrame(sample);
      }
    }

    async function openCamera() {
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        fail("Open the app on localhost or HTTPS to use your camera.");
        return;
      }

      try {
        const camera = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (disposed) {
          camera.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = camera;
        const track = stream.getVideoTracks()[0];
        track.addEventListener("ended", () => {
          if (!disposed) fail("The camera was disconnected. Restart the session to try again.");
        }, { once: true });
        video.srcObject = stream;
        await video.play();
      } catch (cause) {
        if (disposed) return;
        const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
        fail(denied
          ? "Camera access was blocked. Allow it in Chrome’s site settings and try again."
          : "Couldn’t open the camera. Check that it’s connected and available, then try again.");
        return;
      }

      try {
        if (disposed || !stream) return;
        const model = await loadPoseLandmarker();
        if (disposed || !stream) {
          model.close();
          return;
        }

        landmarker = model;
        if (document.hidden) setState("paused");
        else {
          setState("calibrate");
          frame = requestAnimationFrame(sample);
        }
      } catch {
        if (!disposed && stream) fail("Couldn’t load the posture model. Check your connection and try again.");
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    void openCamera();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      tracker.current = null;
      comparisonTracker.current = null;
      release();
    };
  }, [active, demoMode]);

  return {
    videoRef, active, state, score, error, comparison,
    openAdjustment() {
      if (comparisonTracker.current) setComparison(comparisonTracker.current.open());
    },
    closeAdjustment() {
      if (comparisonTracker.current) setComparison(comparisonTracker.current.close());
    },
    beginComparison() {
      if (comparisonTracker.current) setComparison(comparisonTracker.current.begin());
    },
    start() {
      setError("");
      setScore(null);
      setState("starting");
      setActive(true);
    },
    calibrate() {
      tracker.current?.calibrate();
      if (comparisonTracker.current) setComparison(comparisonTracker.current.reset());
      setScore(null);
      setState("calibrating");
    },
    stop() {
      setComparison(EMPTY_COMPARISON);
      setActive(false);
      setState("idle");
      setScore(null);
      setError("");
    },
  };
}
