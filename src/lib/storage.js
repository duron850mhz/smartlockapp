const KEYS = {
  locks: "smartlock:locks",
  apiKey: "smartlock:apiKey",
  statusCache: "smartlock:statusCache",
  autoRefreshOnStart: "smartlock:autoRefreshOnStart",
};

function safeParse(json, fallback) {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function loadLocks() {
  return safeParse(localStorage.getItem(KEYS.locks), []);
}

export function saveLocks(locks) {
  localStorage.setItem(KEYS.locks, JSON.stringify(locks));
}

export function loadApiKey() {
  return localStorage.getItem(KEYS.apiKey) || "";
}

export function saveApiKey(apiKey) {
  localStorage.setItem(KEYS.apiKey, apiKey);
}

// 状態キャッシュ: { [lockId]: { status, battery, position, updatedAt } }
export function loadStatusCache() {
  return safeParse(localStorage.getItem(KEYS.statusCache), {});
}

export function saveStatusCache(cache) {
  localStorage.setItem(KEYS.statusCache, JSON.stringify(cache));
}

export function updateStatusCacheEntry(lockId, entry) {
  const cache = loadStatusCache();
  cache[lockId] = entry;
  saveStatusCache(cache);
  return cache;
}

export function loadAutoRefreshOnStart() {
  return localStorage.getItem(KEYS.autoRefreshOnStart) === "true";
}

export function saveAutoRefreshOnStart(value) {
  localStorage.setItem(KEYS.autoRefreshOnStart, value ? "true" : "false");
}
