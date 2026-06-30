/**
 * 本地书籍存储 (IndexedDB)
 * - books store: 元数据 (id, fileName, addedAt, size, type)
 * - bookBlobs store: 二进制 (id, blob) —— 分开存,列表查询无需加载 blob
 */

const DB_NAME = "reading-companion";
const DB_VERSION = 1;
const STORE_META = "books";
const STORE_BLOB = "bookBlobs";

export type BookType = "epub" | "pdf";

export type BookMeta = {
    id: string;
    fileName: string;
    addedAt: number;
    size: number;
    type: BookType;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(STORE_BLOB)) {
                db.createObjectStore(STORE_BLOB, { keyPath: "id" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
};

const tx = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> => {
    const db = await openDB();
    return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = fn(store);
        transaction.onerror = () => reject(transaction.error);
        if (result instanceof IDBRequest) {
            result.onsuccess = () => resolve(result.result);
            result.onerror = () => reject(result.error);
        } else {
            result.then(resolve, reject);
        }
    });
};

const inferType = (fileName: string): BookType | null => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".epub")) return "epub";
    if (lower.endsWith(".pdf")) return "pdf";
    return null;
};

const uuid = (): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const addBook = async (file: File): Promise<BookMeta> => {
    const type = inferType(file.name);
    if (!type) {
        throw new Error(`Unsupported file type: ${file.name}. Only .epub and .pdf are supported.`);
    }
    const meta: BookMeta = {
        id: uuid(),
        fileName: file.name,
        addedAt: Date.now(),
        size: file.size,
        type
    };
    const db = await openDB();
    return new Promise<BookMeta>((resolve, reject) => {
        const transaction = db.transaction([STORE_META, STORE_BLOB], "readwrite");
        transaction.objectStore(STORE_META).put(meta);
        transaction.objectStore(STORE_BLOB).put({ id: meta.id, blob: file });
        transaction.oncomplete = () => resolve(meta);
        transaction.onerror = () => reject(transaction.error);
    });
};

export const listBooks = async (): Promise<BookMeta[]> => {
    const all = await tx<BookMeta[]>(STORE_META, "readonly", (store) => store.getAll() as IDBRequest<BookMeta[]>);
    return all.sort((a, b) => b.addedAt - a.addedAt);
};

export const getBookBlob = async (id: string): Promise<{ meta: BookMeta; blob: Blob } | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_META, STORE_BLOB], "readonly");
        let meta: BookMeta | undefined;
        let blob: Blob | undefined;
        const metaReq = transaction.objectStore(STORE_META).get(id);
        const blobReq = transaction.objectStore(STORE_BLOB).get(id);
        metaReq.onsuccess = () => {
            meta = metaReq.result;
        };
        blobReq.onsuccess = () => {
            blob = blobReq.result?.blob;
        };
        transaction.oncomplete = () => {
            if (!meta || !blob) {
                resolve(null);
            } else {
                resolve({ meta, blob });
            }
        };
        transaction.onerror = () => reject(transaction.error);
    });
};

export const deleteBook = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_META, STORE_BLOB], "readwrite");
        transaction.objectStore(STORE_META).delete(id);
        transaction.objectStore(STORE_BLOB).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
