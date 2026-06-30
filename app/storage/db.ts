/**
 * 统一 IndexedDB 入口 — 所有 store 集中在一个 DB,一个版本号,一处 onupgradeneeded
 *
 * Schema 演进:
 * v1: books, bookBlobs                                       (Phase 1)
 * v2: + chats (索引 bookId, updatedAt), favorites (索引 bookId, type, createdAt)
 */

export const DB_NAME = "reading-companion";
export const DB_VERSION = 2;

export const STORE_BOOKS = "books";
export const STORE_BOOK_BLOBS = "bookBlobs";
export const STORE_CHATS = "chats";
export const STORE_FAVORITES = "favorites";

let dbPromise: Promise<IDBDatabase> | null = null;

export const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = req.result;
            const oldVersion = event.oldVersion;
            if (oldVersion < 1) {
                if (!db.objectStoreNames.contains(STORE_BOOKS)) {
                    db.createObjectStore(STORE_BOOKS, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(STORE_BOOK_BLOBS)) {
                    db.createObjectStore(STORE_BOOK_BLOBS, { keyPath: "id" });
                }
            }
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains(STORE_CHATS)) {
                    const s = db.createObjectStore(STORE_CHATS, { keyPath: "id" });
                    s.createIndex("bookId", "bookId", { unique: false });
                    s.createIndex("updatedAt", "updatedAt", { unique: false });
                }
                if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                    const s = db.createObjectStore(STORE_FAVORITES, { keyPath: "id" });
                    s.createIndex("bookId", "bookId", { unique: false });
                    s.createIndex("type", "type", { unique: false });
                    s.createIndex("createdAt", "createdAt", { unique: false });
                }
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
};

/** 单 store 读/写的便捷封装 */
export const tx = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
    const db = await openDB();
    return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const req = fn(transaction.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        transaction.onerror = () => reject(transaction.error);
    });
};

export const uuid = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
