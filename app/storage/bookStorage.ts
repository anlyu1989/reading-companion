/**
 * 本地书籍存储
 * - books store: 元数据
 * - bookBlobs store: 二进制 — 分开存,列表查询无需加载 blob
 */
import { openDB, tx, uuid, STORE_BOOKS, STORE_BOOK_BLOBS } from "./db";

export type BookType = "epub" | "pdf";

export type BookMeta = {
    id: string;
    fileName: string;
    addedAt: number;
    size: number;
    type: BookType;
};

const inferType = (fileName: string): BookType | null => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".epub")) return "epub";
    if (lower.endsWith(".pdf")) return "pdf";
    return null;
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
        const transaction = db.transaction([STORE_BOOKS, STORE_BOOK_BLOBS], "readwrite");
        transaction.objectStore(STORE_BOOKS).put(meta);
        transaction.objectStore(STORE_BOOK_BLOBS).put({ id: meta.id, blob: file });
        transaction.oncomplete = () => resolve(meta);
        transaction.onerror = () => reject(transaction.error);
    });
};

export const listBooks = async (): Promise<BookMeta[]> => {
    const all = await tx<BookMeta[]>(STORE_BOOKS, "readonly", (store) => store.getAll() as IDBRequest<BookMeta[]>);
    return all.sort((a, b) => b.addedAt - a.addedAt);
};

export const getBookMeta = async (id: string): Promise<BookMeta | null> => {
    const meta = await tx<BookMeta | undefined>(STORE_BOOKS, "readonly", (store) => store.get(id));
    return meta ?? null;
};

export const getBookBlob = async (id: string): Promise<{ meta: BookMeta; blob: Blob } | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_BOOKS, STORE_BOOK_BLOBS], "readonly");
        let meta: BookMeta | undefined;
        let blob: Blob | undefined;
        transaction.objectStore(STORE_BOOKS).get(id).onsuccess = (e) => {
            meta = (e.target as IDBRequest<BookMeta>).result;
        };
        transaction.objectStore(STORE_BOOK_BLOBS).get(id).onsuccess = (e) => {
            blob = (e.target as IDBRequest<{ blob: Blob }>).result?.blob;
        };
        transaction.oncomplete = () => {
            if (!meta || !blob) resolve(null);
            else resolve({ meta, blob });
        };
        transaction.onerror = () => reject(transaction.error);
    });
};

export const deleteBook = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_BOOKS, STORE_BOOK_BLOBS], "readwrite");
        transaction.objectStore(STORE_BOOKS).delete(id);
        transaction.objectStore(STORE_BOOK_BLOBS).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};
