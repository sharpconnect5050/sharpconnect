const API_BASE = "/api/data";

let _serverAvailable: boolean | null = null;

export async function isServerAvailable(): Promise<boolean> {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const res = await fetch(`${API_BASE}/campaigns`, { method: "GET", signal: AbortSignal.timeout(3000) });
    _serverAvailable = res.ok;
    return _serverAvailable;
  } catch (e) {
    _serverAvailable = false;
    console.warn("[data-api] server unavailable:", e);
    return false;
  }
}

export async function apiGet<T>(collection: string, query?: Record<string, string>): Promise<T[]> {
  const params = new URLSearchParams(query);
  const res = await fetch(`${API_BASE}/${collection}?${params}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`API GET failed: ${res.status}`);
  return res.json();
}

export async function apiGetById<T>(collection: string, id: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}/${collection}?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`API GET by ID failed: ${res.status}`);
  return res.json();
}

export async function apiQuery<T>(collection: string, key: string, value: string): Promise<T[]> {
  const res = await fetch(`${API_BASE}/${collection}?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`API query failed: ${res.status}`);
  return res.json();
}

export async function apiUpsert<T>(collection: string, data: T): Promise<T> {
  const res = await fetch(`${API_BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert", data }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API upsert failed: ${res.status}`);
  return res.json();
}

export async function apiInsert<T>(collection: string, data: T): Promise<T> {
  const res = await fetch(`${API_BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "insert", data }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API insert failed: ${res.status}`);
  return res.json();
}

export async function apiUpdate<T>(collection: string, id: string, data: Partial<T>): Promise<T | null> {
  const res = await fetch(`${API_BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", id, data }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API update failed: ${res.status}`);
  return res.json();
}

export async function apiDelete(collection: string, id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`API delete failed: ${res.status}`);
  const data = await res.json();
  return data.deleted;
}

export async function apiSetAll<T>(collection: string, data: T[]): Promise<void> {
  await fetch(`${API_BASE}/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setAll", data }),
    signal: AbortSignal.timeout(5000),
  });
}
