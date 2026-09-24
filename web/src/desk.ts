export const PAGE_SIZE = 80;
export const DEFAULT_CONTRACT = "2026-12-18";

export type WindowFilter = "day" | "1718";
export type ChartMode = "overview" | "analyse";

export type BucketOption = { label: string; value: number };

const DAY_BUCKETS: BucketOption[] = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
];

const WINDOW_BUCKETS: BucketOption[] = [
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
];

export function bucketsFor(window: WindowFilter): BucketOption[] {
  return window === "1718" ? WINDOW_BUCKETS : DAY_BUCKETS;
}

export function defaultBucket(window: WindowFilter): number {
  return window === "1718" ? 30 : 60;
}
