/**
 * SafeStorage Utility
 * Prevents QuotaExceededError from crashing the app and handles private mode restrictions.
 */

const SafeStorage = {
    set: (key, value) => {
        try {
            const stringified = JSON.stringify(value);
            localStorage.setItem(key, stringified);
            return true;
        } catch (e) {
            console.warn(`[SafeStorage] Failed to save ${key}:`, e.message);
            
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                // Urgent pruning for high-concurrency/heavy users
                console.log("[SafeStorage] Storage quota reached. Pruning non-critical data...");
                SafeStorage.prune();
                
                // Retry once after pruning
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryErr) {
                    console.error("[SafeStorage] Pruning insufficient. Data lost for key:", key);
                }
            }
            return false;
        }
    },

    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`[SafeStorage] Error reading ${key}:`, e.message);
            return defaultValue;
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`[SafeStorage] Error removing ${key}:`, e.message);
        }
    },

    prune: () => {
        try {
            // Prune old search histories or large cached items first
            localStorage.removeItem('search_history_backup');
            localStorage.removeItem('cached_college_details_heavy');
            
            // If still tight, notify user would be ideal, but here we just try to save the core app state
            console.log("[SafeStorage] Non-critical cache cleared.");
        } catch (e) {
            console.error("[SafeStorage] Pruning failed:", e);
        }
    }
};

export default SafeStorage;
