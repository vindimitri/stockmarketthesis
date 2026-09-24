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

type TradeListResponse = {
  date: string;
  start: string;
  end: string;
  timezone: string;
  count: number;
  trades: TradeRow[];
};

type HealthResponse = {
  tape_delay_seconds?: number;
  ingest_active?: boolean;
};

function httpError(path: string, status: number, body: string): Error {
  if (status === 502 || status === 503 || status === 504) {
    return new Error("API startet noch. Seite in ein paar Sekunden neu laden.");
  }
  const snippet = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return new Error(snippet ? `${status} ${path}: ${snippet}` : `${status} ${path}`);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    throw httpError(path, res.status, await res.text());
  }
  if (!contentType.includes("application/json")) {
    throw new Error(`${path}: API antwortet nicht mit JSON`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => getJson<HealthResponse>("/health"),
  days: () => getJson<DayRow[]>("/days"),
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
