/**
 * 网络文章存储
 * - 第一版把文章正文直接存 IndexedDB,方便离线和复用 AI 伴读能力
 */
import { openDB, tx, STORE_ARTICLES } from "./db";

export type ArticleStatus = "unread" | "reading" | "done";

export type Article = {
    id: string;
    title: string;
    url: string;
    source: string;
    excerpt?: string;
    author?: string;
    publishedAt?: number;
    fetchedAt: number;
    savedAt: number;
    content?: string;
    textContent?: string;
    score?: number;
    reason?: string;
    category?: string;
    batchId?: string;
    isFavorite?: boolean;
    favoritedAt?: number;
    status: ArticleStatus;
    lastReadAt?: number;
    tags: string[];
};

export type ArticleInput = Omit<Article, "savedAt" | "status" | "tags"> & {
    status?: ArticleStatus;
    tags?: string[];
};

export type ArticleFeedItem = Pick<
    Article,
    "id" | "title" | "url" | "source" | "excerpt" | "author" | "publishedAt" | "score" | "reason" | "category"
>;

export const articleIdFromUrl = async (url: string): Promise<string> => {
    const bytes = new TextEncoder().encode(url);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 24);
};

export const saveArticle = async (input: ArticleInput): Promise<Article> => {
    const now = Date.now();
    const existing = await getArticle(input.id);
    const article: Article = {
        ...existing,
        ...input,
        savedAt: existing?.savedAt ?? now,
        fetchedAt: input.fetchedAt,
        status: input.status ?? existing?.status ?? "unread",
        tags: input.tags ?? existing?.tags ?? ["AI"]
    };
    await tx(STORE_ARTICLES, "readwrite", (store) => store.put(article));
    return article;
};

export const saveArticles = async (inputs: ArticleInput[]): Promise<Article[]> => {
    const db = await openDB();
    const articles = await Promise.all(
        inputs.map(async (input) => {
            const existing = await getArticle(input.id);
            const now = Date.now();
            return {
                ...existing,
                ...input,
                savedAt: existing?.savedAt ?? now,
                fetchedAt: input.fetchedAt,
                status: input.status ?? existing?.status ?? "unread",
                tags: input.tags ?? existing?.tags ?? ["AI"]
            };
        })
    );

    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_ARTICLES, "readwrite");
        const store = transaction.objectStore(STORE_ARTICLES);
        articles.forEach((article) => store.put(article));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    return articles;
};

export const listArticles = async (): Promise<Article[]> => {
    const all = await tx<Article[]>(STORE_ARTICLES, "readonly", (store) => store.getAll() as IDBRequest<Article[]>);
    return all.sort(
        (a, b) => (b.lastReadAt ?? b.publishedAt ?? b.fetchedAt) - (a.lastReadAt ?? a.publishedAt ?? a.fetchedAt)
    );
};

export const getArticle = async (id: string): Promise<Article | null> => {
    const article = await tx<Article | undefined>(STORE_ARTICLES, "readonly", (store) => store.get(id));
    return article ?? null;
};

export const updateArticle = async (id: string, patch: Partial<Article>): Promise<Article | null> => {
    const article = await getArticle(id);
    if (!article) return null;
    const next = { ...article, ...patch };
    await tx(STORE_ARTICLES, "readwrite", (store) => store.put(next));
    return next;
};

export const deleteArticle = async (id: string): Promise<void> => {
    await tx(STORE_ARTICLES, "readwrite", (store) => store.delete(id) as unknown as IDBRequest);
};
