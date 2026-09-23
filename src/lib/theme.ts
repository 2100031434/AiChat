// Categorical palette from the dataviz skill's validated default (fixed hue
// order — never reassign a slot to a different model once charted). Light
// values only; the dashboard doesn't yet implement a dark-chart variant.
export const CATEGORICAL_SERIES = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export function seriesColor(index: number): string {
  return CATEGORICAL_SERIES[index % CATEGORICAL_SERIES.length];
}
