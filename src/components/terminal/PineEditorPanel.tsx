"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, CloseIcon, PlayIcon, TrashIcon } from "./icons";
import { PINE_EXAMPLES, highlightLine, type PineResult } from "@/features/pine";

type Props = {
  source: string;
  onSourceChange: (source: string) => void;
  onRun: () => void;
  onRemove: () => void;
  onClose: () => void;
  applied: boolean;
  result: PineResult | null;
};

const HEIGHT_KEY = "chartmasters:pine:height";
const MIN_HEIGHT = 180;
const DEFAULT_HEIGHT = 300;

function clampHeight(value: number) {
  const max = typeof window === "undefined" ? 700 : Math.max(MIN_HEIGHT, window.innerHeight - 430);
  return Math.min(max, Math.max(MIN_HEIGHT, value));
}

const QUICK_REFERENCE = [
  "indicator", "plot", "hline", "input.int", "ta.sma", "ta.ema", "ta.rsi", "ta.macd", "ta.bb",
  "ta.atr", "ta.crossover", "ta.highest", "math.max", "color.new",
];

export default function PineEditorPanel({
  source,
  onSourceChange,
  onRun,
  onRemove,
  onClose,
  applied,
  result,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(HEIGHT_KEY));
      if (saved > 0) setHeight(clampHeight(saved));
    } catch {
      // keep the default height
    }
  }, []);

  const lines = useMemo(() => source.split("\n"), [source]);
  const highlighted = useMemo(() => lines.map(highlightLine), [lines]);

  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];
  const errorLines = useMemo(() => new Set(errors.map((item) => item.line)), [errors]);
  const firstErrorLine = errors.find((item) => item.line > 0)?.line ?? 0;

  const jumpToLine = (line: number) => {
    const area = textareaRef.current;
    if (!area || line < 1) return;
    const offset = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
    area.focus();
    area.setSelectionRange(offset, offset + (lines[line - 1]?.length ?? 0));
  };

  // Edit the textarea synchronously so the caret is already in place for the next keystroke,
  // then report the new value. React sees an unchanged value and leaves the caret alone.
  const insertText = (area: HTMLTextAreaElement, text: string) => {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
    onSourceChange(area.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onRun();
      return;
    }

    const area = event.currentTarget;
    const { selectionStart, selectionEnd, value } = area;

    // Tab inserts four spaces (Pine blocks are indentation based).
    if (event.key === "Tab") {
      event.preventDefault();
      insertText(area, "    ");
      return;
    }

    // Enter keeps the indentation of the current line and adds one level after a block opener.
    if (event.key === "Enter" && !event.shiftKey && selectionStart === selectionEnd) {
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const beforeCaret = value.slice(lineStart, selectionStart);
      const indent = /^[ \t]*/.exec(beforeCaret)?.[0] ?? "";
      const opensBlock = /(?:=>|\b(?:if|for|while|else)\b[^/]*)\s*$/.test(beforeCaret.replace(/\/\/.*$/, ""));
      const insert = "\n" + indent + (opensBlock ? "    " : "");
      insertText(area, insert);
    }
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setHeight(clampHeight(drag.startHeight + (drag.startY - event.clientY)));
  };
  const endResize = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
    } catch {
      // ignore
    }
  };

  let statusText = "Not on chart";
  let statusClass = "idle";
  if (applied && result) {
    if (errors.length > 0) {
      statusText = errors.length === 1 ? "1 error" : errors.length + " errors";
      statusClass = "error";
    } else {
      statusText = "Running · " + result.runtimeMs + " ms";
      statusClass = "ok";
    }
  }

  return (
    <section className="pine-panel" style={{ flexBasis: height }} aria-label="Pine Script editor">
      <div
        className="pine-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />

      <div className="pine-toolbar">
        <strong className="pine-title">Pine Script</strong>
        <span className="pine-script-name" title="Script name">{result?.title ?? "Untitled script"}</span>

        <label className="pine-select-wrap">
          <select
            className="pine-select"
            value=""
            aria-label="Load an example script"
            onChange={(event) => {
              const example = PINE_EXAMPLES[Number(event.target.value)];
              if (example) onSourceChange(example.source);
            }}
          >
            <option value="" disabled>Examples</option>
            {PINE_EXAMPLES.map((example, index) => (
              <option key={example.name} value={index}>{example.name}</option>
            ))}
          </select>
          <ChevronDownIcon size={20} />
        </label>

        <span className={"pine-status " + statusClass}><i />{statusText}</span>
        <div className="pine-spacer" />

        <button className="pine-button primary" onClick={onRun} title="Add to chart (Ctrl+Enter)">
          <PlayIcon size={18} />
          {applied ? "Update on chart" : "Add to chart"}
          <kbd>Ctrl ↵</kbd>
        </button>
        <button className="pine-button" onClick={onRemove} disabled={!applied} title="Remove from chart">
          <TrashIcon size={20} /> Remove
        </button>
        <button className="pine-icon" onClick={onClose} title="Close editor" aria-label="Close editor">
          <CloseIcon size={22} />
        </button>
      </div>

      <div className="pine-body">
        <div className="pine-editor">
          <div className="pine-scroll">
            <div className="pine-gutter" aria-hidden>
              {lines.map((_, index) => (
                <div key={index} className={errorLines.has(index + 1) ? "has-error" : undefined}>{index + 1}</div>
              ))}
            </div>
            <div className="pine-code-cell">
              {firstErrorLine > 0 && (
                <div className="pine-error-band" style={{ top: "calc(var(--pine-pad) + " + (firstErrorLine - 1) + " * var(--pine-lh))" }} />
              )}
              <pre className="pine-highlight" aria-hidden>
                {highlighted.map((spans, index) => (
                  <span key={index}>
                    {spans.map((span, spanIndex) => (
                      <span key={spanIndex} className={span.cls}>{span.text}</span>
                    ))}
                    {"\n"}
                  </span>
                ))}
              </pre>
              <textarea
                ref={textareaRef}
                className="pine-code"
                value={source}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                wrap="off"
                aria-label="Pine Script source"
                onChange={(event) => onSourceChange(event.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
        </div>

        <aside className="pine-output" aria-live="polite">
          <header className="pine-output-head">
            <span>Problems</span>
            <b className={errors.length > 0 ? "bad" : warnings.length > 0 ? "warn" : "good"}>
              {errors.length + warnings.length}
            </b>
          </header>
          <div className="pine-output-body">
            {errors.length === 0 && warnings.length === 0 && (
              <>
                <p className="pine-hint">
                  {applied
                    ? "No problems. The script is running on the chart."
                    : "Write a Pine Script v5 indicator, then add it to the chart."}
                </p>
                <p className="pine-hint-title">Quick reference</p>
                <div className="pine-chips">
                  {QUICK_REFERENCE.map((name) => <code key={name}>{name}</code>)}
                </div>
                <p className="pine-hint small">
                  Also: <code>var</code>, <code>if</code>/<code>for</code>/<code>while</code>, functions,
                  tuples, <code>series[n]</code>. Strategies and drawing objects are not supported yet.
                </p>
              </>
            )}
            {errors.map((item, index) => (
              <button
                type="button"
                className="pine-message error"
                key={"e" + index}
                onClick={() => jumpToLine(item.line)}
              >
                <span className="pine-message-line">{item.line > 0 ? "Line " + item.line : "Script"}</span>
                {item.message}
              </button>
            ))}
            {warnings.map((item, index) => (
              <button
                type="button"
                className="pine-message warning"
                key={"w" + index}
                onClick={() => jumpToLine(item.line)}
              >
                <span className="pine-message-line">{item.line > 0 ? "Line " + item.line : "Note"}</span>
                {item.message}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
