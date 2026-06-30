/**
 * 收藏 — 3 类合一,用 type 区分
 * - sentence: 原文句子(可跳回 cfi)
 * - answer: AI 回答片段(关联 chatId,可跳回对话)
 * - word: 单词(可带上下文)
 */
import { tx, uuid, STORE_FAVORITES } from "./db";

export type FavoriteType = "sentence" | "answer" | "word";

export type Favorite = {
    id: string;
    type: FavoriteType;
    bookId: string;
    bookTitle: string;
    text: string;
    cfi?: string;
    chatId?: string;
    context?: string;
    note?: string;
    createdAt: number;
};

export type FavoriteInput = Omit<Favorite, "id" | "createdAt">;

export const addFavorite = async (input: FavoriteInput): Promise<Favorite> => {
    const fav: Favorite = { id: uuid(), createdAt: Date.now(), ...input };
    await tx(STORE_FAVORITES, "readwrite", (store) => store.put(fav));
    return fav;
};

export const listFavorites = async (options?: { type?: FavoriteType; bookId?: string }): Promise<Favorite[]> => {
    const all = await tx<Favorite[]>(STORE_FAVORITES, "readonly", (store) => store.getAll() as IDBRequest<Favorite[]>);
    return all
        .filter((f) => (options?.type ? f.type === options.type : true))
        .filter((f) => (options?.bookId ? f.bookId === options.bookId : true))
        .sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteFavorite = async (id: string): Promise<void> => {
    await tx(STORE_FAVORITES, "readwrite", (store) => store.delete(id) as unknown as IDBRequest);
};
