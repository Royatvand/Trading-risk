// Shared types for the Pine Script runner.
// Numeric "na" is represented by NaN. Tuples / array literals are plain arrays.

export type PineValue = number | boolean | string | PineValue[];

export class PineError extends Error {
  line: number;
  constructor(line: number, message: string) {
    super(message);
    this.name = "PineError";
    this.line = line;
  }
}

export type PlotStyle = "line" | "histogram" | "circles";

export type PlotPoint = {
  time: number; // UTC seconds
  value?: number; // undefined = gap (na)
  color?: string;
};

export type PinePlot = {
  title: string;
  color: string;
  lineWidth: number;
  style: PlotStyle;
  points: PlotPoint[];
};

export type PineHLine = {
  title: string;
  price: number;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
};

export type PineDiagnostic = {
  line: number; // 1-based, 0 = unknown
  message: string;
};

export type PineResult = {
  title: string;
  overlay: boolean;
  plots: PinePlot[];
  hlines: PineHLine[];
  errors: PineDiagnostic[];
  warnings: PineDiagnostic[];
  runtimeMs: number;
};
