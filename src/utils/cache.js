const cacheStore = new Map();

const now = () => Date.now();

const getCache = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= now()) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
};

const setCache = (key, value, ttlMs) => {
  const expiresAt = ttlMs ? now() + ttlMs : null;
  cacheStore.set(key, { value, expiresAt });
};

const clearCachePrefix = (prefix) => {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};

module.exports = { getCache, setCache, clearCachePrefix };
