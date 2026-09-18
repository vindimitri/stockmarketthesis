export type DayRow = {
  berlin_date: string;
  first_event: string;
  last_event: string;
  n_trades: number;
  low: number;
  high: number;
};

export type TradeRow = {
  id?: number;
  event_time: string;
  price: number;
  quantity: number;
  contract_date: string;
  venue: string;
  external_id: string;
  notional: number | null;
};

export type TradeListResponse = {
  date: string;
  start: string;
  end: string;
  timezone: string;
  count: number;
  trades: TradeRow[];
};

export type SummaryResponse = {
  date: string;
  start: string;
  end: string;
  timezone: string;
  n_trades: number;
  open: number | null;
  close: number | null;
  low: number | null;
  high: number | null;
  volume: number;
};

export type HealthResponse = {
  ok: boolean;
  database: string;
  timezone: string;
  tape_delay_seconds?: number;
  last_ingest: {
    id?: number;
    started_at?: string;
    finished_at?: string;
    status?: string;
    n_upserted?: number;
  } | null;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error(`${path}: API antwortet nicht mit JSON`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<HealthResponse>("/health"),
  days: () => getJson<DayRow[]>("/days"),
  summary: (date: string) => getJson<SummaryResponse>(`/summary?date=${date}`),
  trades: (date: string, from = "00:00", to = "24:00", afterTime?: string, afterId?: number) => {
    const params = new URLSearchParams({
      date,
      from,
      to,
    });
    if (afterTime) params.set("after_time", afterTime);
    if (afterId != null && afterId > 0) params.set("after_id", String(afterId));
    return getJson<TradeListResponse>(`/trades?${params.toString()}`);
  },
};
