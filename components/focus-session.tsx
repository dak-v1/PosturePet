"use client";

import { useState } from "react";
import { usePostureSession } from "../lib/use-posture-session";
import { DeskAdjustment } from "./desk-adjustment";

const messages = {
  idle: ["Ready to focus", "Start a session when you’re ready to work."],
  starting: ["Starting your camera", "Allow camera access to start tracking."],
  calibrate: ["Find a comfortable position", "Frame your face and both shoulders, then select Calibrate."],
  calibrating: ["Calibrating", "Sit comfortably and hold still for about two seconds."],
  steady: ["Looking good", "The rabbit will give you a nudge if you lean forward for a while."],
  leaning: ["Leaning forward", "If it feels comfortable, ease back toward where you started."],
  "out-of-frame": ["Can’t see you clearly", "Bring your face and both shoulders into view."],
  paused: ["Tracking paused", "Return to this tab to resume tracking."],
  error: ["Session interrupted", ""],
} as const;

function Rabbit({ concerned = false, small = false }: { concerned?: boolean; small?: boolean }) {
  return (
    <span className={`rabbit${concerned ? " rabbit-concerned" : ""}${small ? " rabbit-small" : ""}`} aria-hidden="true">
      <span className="rabbit-ear rabbit-ear-left" />
      <span className="rabbit-ear rabbit-ear-right" />
      <span className="rabbit-head"><span className="rabbit-face" /></span>
    </span>
  );
}

export default function FocusSession() {
  const [demoMode, setDemoMode] = useState(false);
  const [laptopOnly, setLaptopOnly] = useState(false);
  const [zeroBudget, setZeroBudget] = useState(false);
  const {
    videoRef, active, state, score, error, comparison,
    start, calibrate, stop, openAdjustment, closeAdjustment, beginComparison,
  } = usePostureSession(demoMode);
  const [status, detail] = messages[state];
  const concerned = state === "leaning";
  const cameraAvailable = active && state !== "error";
  const calibrated = state === "steady" || state === "leaning";
  const showAdjustment = comparison.phase !== "hidden";

  return (
    <div className="shell">
      <header className="site-header">
        <div className="brand"><span className="brand-icon"><Rabbit small /></span> Posture Pet</div>
        <span className="privacy"><span className="status-dot" /> On-device tracking</span>
      </header>

      <main className="page">
        <div className="introduction">
          <h1>{active ? "Focus session" : "Start a focus session"}</h1>
          <p>{active ? "Keep your face and shoulders in view as you work." : "A quiet companion for your time at the desk."}</p>
        </div>

        <div className="session-grid">
          <section className="panel main-panel" aria-label={active ? "Camera preview" : "Session setup"}>
            {!active ? (
              <>
                <div className="rabbit-scene">
                  <span className="scene-ring scene-ring-outer" aria-hidden="true" />
                  <span className="scene-ring scene-ring-inner" aria-hidden="true" />
                  <span className="scene-ground" aria-hidden="true" />
                  <Rabbit />
                </div>
                <div className="panel-copy">
                  <h2>Ready to focus</h2>
                  <p>Sit comfortably for a quick calibration. Your pet will give you a gentle reminder when you lean forward for a while.</p>
                </div>
              </>
            ) : (
              <>
                <div className="camera-stage">
                  <video ref={videoRef} className={cameraAvailable ? "" : "camera-off"} muted playsInline aria-label="Your live camera preview" />
                  {state === "error" && <p className="camera-placeholder">Camera unavailable</p>}
                  {state === "starting" && <p className="camera-placeholder">Connecting to your camera…</p>}
                  {state === "paused" && <p className="camera-placeholder">Tracking paused</p>}
                </div>
                <div className={concerned ? "panel-copy session-status session-status-nudge" : "panel-copy session-status"}>
                  <div className={concerned ? "status-rabbit concerned" : "status-rabbit"}><Rabbit small concerned={concerned} /></div>
                  <div aria-live="polite">
                    <h2>{status}</h2>
                    <p>{error || detail}</p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="panel controls">
            {active ? (
              <>
                <h2>Session controls</h2>
                <p className="controls-description">{demoMode ? "Demo mode · 5-second lean reminder" : "Regular mode · 18-second lean reminder"}</p>
                <div className="session-actions">
                  {state !== "error" && (
                    <>
                      <button className="button primary" onClick={calibrate} disabled={state === "starting" || state === "calibrating" || state === "paused"}>
                        {calibrated ? "Recalibrate" : state === "calibrating" ? "Calibrating…" : "Calibrate"}
                      </button>
                      <button className={concerned ? "button adjustment adjustment-highlight" : "button adjustment"} onClick={showAdjustment ? closeAdjustment : openAdjustment} aria-expanded={showAdjustment} aria-controls="desk-adjustment">
                        {showAdjustment ? "Close adjustment" : "Help me adjust"}
                      </button>
                      {showAdjustment && <DeskAdjustment comparison={comparison} canBegin={calibrated} onBegin={beginComparison} />}
                    </>
                  )}
                  <button className="button secondary" onClick={stop}>{state === "error" ? "Back to setup" : "Stop session"}</button>
                </div>
                <details className="diagnostics">
                  <summary>Tracking details</summary>
                  <p>Lean score: {score === null ? "—" : `${score}% of your baseline`}</p>
                  <p>Camera position and lighting affect the reading.</p>
                </details>
              </>
            ) : (
              <>
                <h2>Your workspace</h2>
                <p className="controls-description">Choose what applies to your setup.</p>
                <label className="option"><input type="checkbox" checked={laptopOnly} onChange={(event) => setLaptopOnly(event.target.checked)} /> Laptop only</label>
                <label className="option"><input type="checkbox" checked={zeroBudget} onChange={(event) => setZeroBudget(event.target.checked)} /> Zero budget</label>
                <label className="option demo-option">
                  <input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />
                  <span>Demo mode <span className="option-detail">Nudge after 5 seconds of leaning</span></span>
                </label>
                <button className="button primary start-button" onClick={start}>Start session</button>
                <p className="privacy-note">Your live camera feed stays on this device.</p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
