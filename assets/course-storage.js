/** Browser-only learning records. No network calls; no automatic expiration.
 * Storage failures retain edits in memory for this page and are reported to the UI.
 * Existing keys are retained so upgrading does not reset a student's work.
 */
(function (root) {
    'use strict';

    function owns(key) {
        return typeof key === 'string' &&
            (key.indexOf('AD_course_v1.') === 0 || key.indexOf('design:') === 0);
    }

    function create(getStorage) {
        const memory = new Map();
        const pending = new Map();
        const listeners = new Set();
        let failed = false;

        function unavailable() {
            failed = true;
            listeners.forEach(fn => fn());
        }

        function read(key) {
            if (!owns(key)) throw new Error('Not a course storage key');
            if (pending.has(key)) return pending.get(key);
            try {
                const value = getStorage().getItem(key);
                memory.set(key, value);
                return value;
            } catch (_) {
                unavailable();
                return memory.get(key) || null;
            }
        }

        function write(key, value) {
            if (!owns(key)) throw new Error('Not a course storage key');
            value = String(value);
            memory.set(key, value);
            try {
                getStorage().setItem(key, value);
                pending.delete(key);
                return true;
            } catch (_) {
                pending.set(key, value);
                unavailable();
                return false;
            }
        }

        function readObject(key) {
            try {
                const value = JSON.parse(read(key));
                return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            } catch (_) { return {}; }
        }

        function keys() {
            const found = new Set(memory.keys());
            try {
                const storage = getStorage();
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (owns(key)) found.add(key);
                }
            } catch (_) { unavailable(); }
            pending.forEach((value, key) => {
                if (value === null) found.delete(key); else found.add(key);
            });
            return Array.from(found).filter(key => read(key) !== null).sort();
        }

        function exportData() {
            const records = Object.create(null);
            keys().forEach(key => { records[key] = read(key); });
            return { format: 'ee-review-learning-data', version: 1,
                exportedAt: new Date().toISOString(), storageAccessFailed: failed, records };
        }

        function clear() {
            let errors = 0;
            // A failed enumeration means we cannot promise that every saved key was removed.
            try { void getStorage().length; } catch (_) { errors++; }
            keys().forEach(key => {
                memory.delete(key);
                try {
                    getStorage().removeItem(key);
                    pending.delete(key);
                } catch (_) {
                    pending.set(key, null);
                    errors++;
                    unavailable();
                }
            });
            return { complete: errors === 0 };
        }

        return { read, write, readObject, keys, exportData, clear,
            hasFailed: () => failed,
            subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { create, owns };
    else root.CourseStorage = create(() => root.localStorage);
})(typeof window !== 'undefined' ? window : globalThis);
