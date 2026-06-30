/**
 * Chat session 持久化(按书隔离)
 * 一次"划词 → 问 AI"开启一个 ChatSession,后续追问追加到同一个 session
 */
import { openDB, tx, uuid, STORE_CHATS } from "./db";

export type ChatRole = "user" | "assistant";
export type StoredMessage = { role: ChatRole; content: string };

export type ChatSession = {
    id: string;
    bookId: string;
    bookTitle: string;
    selection: string;
    cfi: string;
    messages: StoredMessage[];
    createdAt: number;
    updatedAt: number;
};

export const createChat = async (input: {
    bookId: string;
    bookTitle: string;
    selection: string;
    cfi: string;
    messages: StoredMessage[];
}): Promise<ChatSession> => {
    const now = Date.now();
    const session: ChatSession = {
        id: uuid(),
        bookId: input.bookId,
        bookTitle: input.bookTitle,
        selection: input.selection,
        cfi: input.cfi,
        messages: input.messages,
        createdAt: now,
        updatedAt: now
    };
    await tx(STORE_CHATS, "readwrite", (store) => store.put(session));
    return session;
};

export const updateChatMessages = async (id: string, messages: StoredMessage[]): Promise<void> => {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_CHATS, "readwrite");
        const store = transaction.objectStore(STORE_CHATS);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const existing = getReq.result as ChatSession | undefined;
            if (!existing) {
                resolve();
                return;
            }
            store.put({ ...existing, messages, updatedAt: Date.now() });
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getChat = async (id: string): Promise<ChatSession | null> => {
    const r = await tx<ChatSession | undefined>(STORE_CHATS, "readonly", (store) => store.get(id));
    return r ?? null;
};

export const listChatsForBook = async (bookId: string): Promise<ChatSession[]> => {
    const all = await tx<ChatSession[]>(STORE_CHATS, "readonly", (store) => {
        const idx = store.index("bookId");
        return idx.getAll(bookId) as IDBRequest<ChatSession[]>;
    });
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteChat = async (id: string): Promise<void> => {
    await tx(STORE_CHATS, "readwrite", (store) => store.delete(id) as unknown as IDBRequest);
};
