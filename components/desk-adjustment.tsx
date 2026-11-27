import { COMPARISON_SECONDS, type Comparison } from "../lib/lean-comparison";

export function DeskAdjustment({
  comparison,
  canBegin,
  onBegin,
}: {
  comparison: Comparison;
  canBegin: boolean;
  onBegin: () => void;
}) {
  const { phase, beforeSeconds, afterSeconds, result } = comparison;
  const beforeReady = beforeSeconds === COMPARISON_SECONDS;

  return (
    <section id="desk-adjustment" className="desk-adjustment" aria-labelledby="adjustment-title">
      <h3 id="adjustment-title">Desk adjustment</h3>
      <div className="sample-tip">
        <p className="sample-label">Sample tip</p>
        <p className="tip-title">Try increasing text size</p>
        <p>Increase your browser zoom one step and keep the camera in the same position.</p>
      </div>

      {phase === "preview" && (
        <>
          {beforeReady ? (
            <p className="comparison-note">When you’re ready, apply the change and click below. Continue the same task while we measure again.</p>
          ) : (
            <>
              <p className="comparison-note">Keep working as usual while we collect your before measurement, then try the tip.</p>
              <label className="comparison-progress">
                <span>Before tracking</span>
                <span>{beforeSeconds} / {COMPARISON_SECONDS}s</span>
                <progress max={COMPARISON_SECONDS} value={beforeSeconds} />
              </label>
            </>
          )}
          <button className="button primary" onClick={onBegin} disabled={!beforeReady || !canBegin}>I tried this</button>
        </>
      )}

      {phase === "measuring" && (
        <>
          <p className="comparison-note" role="status">Collecting data… Keep your face and shoulders in view.</p>
          <label className="comparison-progress">
            <span>After tracking</span>
            <span>{afterSeconds} / {COMPARISON_SECONDS}s</span>
            <progress max={COMPARISON_SECONDS} value={afterSeconds} />
          </label>
        </>
      )}

      {result && (
        <>
          <div className="comparison-result" aria-live="polite">
            <h4>Time spent leaning</h4>
            <p>Based on {COMPARISON_SECONDS} seconds of valid tracking in each window.</p>
            <div className="result-row">
              <span>Before</span>
              <progress max={100} value={result.before} aria-hidden="true" />
              <strong>{result.before}%</strong>
            </div>
            <div className="result-row">
              <span>After</span>
              <progress max={100} value={result.after} aria-hidden="true" />
              <strong>{result.after}%</strong>
            </div>
          </div>
          <fieldset className="comfort-options">
            <legend>How does it feel?</legend>
            {["Better", "About the same", "Worse"].map((answer) => (
              <label key={answer}><input type="radio" name="adjustment-comfort" value={answer} /> {answer}</label>
            ))}
          </fieldset>
        </>
      )}
    </section>
  );
}
