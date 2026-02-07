/**
 * Simple in-memory cache with TTL support
 * Used for caching API responses to improve performance
 */

const cache = new Map();

/**
 * Get cached value if not expired
 * @param {string} key - Cache key
 * @returns {any} Cached value or undefined
 */
export function get(key) {
    const item = cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
        cache.delete(key);
        return undefined;
    }

    return item.value;
}

/**
 * Set cache value with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
export function set(key, value, ttlSeconds = 300) {
    cache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000),
    });
}

/**
 * Get stale value (ignoring expiry) - useful as fallback
 * @param {string} key - Cache key
 * @returns {any} Cached value regardless of expiry
 */
export function getStale(key) {
    const item = cache.get(key);
    return item?.value;
}

/**
 * Clear specific cache key
 * @param {string} key - Cache key to clear
 */
export function clear(key) {
    cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearAll() {
    cache.clear();
}

/**
 * Get cache stats
 * @returns {Object} Cache statistics
 */
export function stats() {
    let expired = 0;
    let valid = 0;

    for (const [key, item] of cache) {
        if (Date.now() > item.expiry) {
            expired++;
        } else {
            valid++;
        }
    }

    return { total: cache.size, valid, expired };
}

export default { get, set, getStale, clear, clearAll, stats };
