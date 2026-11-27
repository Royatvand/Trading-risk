"use client";

import { useRef } from "react";
import { Play, Trash2 } from "lucide-react";
import { PINE_EXAMPLES, type PineResult } from "@/features/pine";

type Props = {
  source: string;
  onSourceChange: (source: string) => void;
  onRun: () => void;
  onRemove: () => void;
  applied: boolean;
  result: PineResult | null;
};

export default function PineEditorPanel({
  source,
  onSourceChange,
  onRun,
  onRemove,
  applied,
  result,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onRun();
      return;
    }

    // Tab inserts four spaces (Pine blocks are indentation based) instead of leaving the editor.
    if (event.key === "Tab") {
      event.preventDefault();
      const area = event.currentTarget;
      const { selectionStart, selectionEnd, value } = area;
      const next = value.slice(0, selectionStart) + "    " + value.slice(selectionEnd);
      onSourceChange(next);
      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(selectionStart + 4, selectionStart + 4);
      });
    }
  };

  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];

  let statusText = "Not on chart";
  let statusClass = "pine-status";
  if (applied && result) {
    if (errors.length > 0) {
      statusText = "Error";
      statusClass += " error";
    } else {
      statusText = "Running · " + result.runtimeMs + " ms";
      statusClass += " ok";
    }
  }

  return (
    <section className="pine-panel" aria-label="Pine Script editor">
      <div className="pine-toolbar">
        <strong className="pine-title">Pine Script</strong>
        <select
          className="pine-select"
          value=""
          aria-label="Load an example script"
          onChange={(event) => {
            const example = PINE_EXAMPLES[Number(event.target.value)];
            if (example) onSourceChange(example.source);
          }}
        >
          <option value="" disabled>Examples…</option>
          {PINE_EXAMPLES.map((example, index) => (
            <option key={example.name} value={index}>{example.name}</option>
          ))}
        </select>
        <span className={statusClass}>{statusText}</span>
        <div className="pine-spacer" />
        <button className="pine-button primary" onClick={onRun} title="Add to chart (Ctrl+Enter)">
          <Play size={13} /> {applied ? "Update on chart" : "Add to chart"}
        </button>
        <button className="pine-button" onClick={onRemove} disabled={!applied} title="Remove from chart">
          <Trash2 size={13} /> Remove
        </button>
      </div>

      <div className="pine-body">
        <textarea
          ref={textareaRef}
          className="pine-code"
          value={source}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Pine Script source"
          onChange={(event) => onSourceChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="pine-output" aria-live="polite">
          {errors.length === 0 && warnings.length === 0 && (
            <p className="pine-hint">
              Write a Pine Script v5 indicator and press <b>Add to chart</b> (Ctrl+Enter).
              Supported: <code>indicator</code>, <code>plot</code>, <code>hline</code>, <code>input.*</code>,
              <code> ta.*</code> (sma, ema, rma, wma, rsi, macd, bb, atr, stdev, highest, lowest, crossover…),
              <code> math.*</code>, <code>var</code>, <code>if</code>/<code>for</code>/<code>while</code>,
              user functions, tuples and <code>series[n]</code> history.
              Strategies, drawings objects and <code>request.*</code> are not supported yet.
            </p>
          )}
          {errors.map((item, index) => (
            <div className="pine-message error" key={"e" + index}>
              {item.line > 0 ? "Line " + item.line + ": " : ""}{item.message}
            </div>
          ))}
          {warnings.map((item, index) => (
            <div className="pine-message warning" key={"w" + index}>
              {item.line > 0 ? "Line " + item.line + ": " : ""}{item.message}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
