/**
 * Clear all IndexedDB databases
 */
export async function clearIndexedDBCache(): Promise<void> {
    const databases = await window.indexedDB.databases();
    for (const db of databases) {
        if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
        }
    }
}
