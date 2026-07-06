"use client";
import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
    articleIdFromUrl,
    deleteArticle,
    getArticle,
    listArticles,
    saveArticle,
    saveArticles,
    updateArticle,
    type Article,
    type ArticleFeedItem
} from "../storage/articleStorage";

const ARTICLES_CACHE_KEY = "local-articles/list";
const articleCacheKey = (id: string) => `local-articles/item/${id}`;

type FetchFeedResponse = {
    items: ArticleFeedItem[];
};

type FetchContentResponse = {
    title?: string;
    byline?: string;
    content: string;
    textContent: string;
};

const shouldRefreshContent = (article: Article) => {
    if (!article.content || !article.textContent) return true;
    const isArxiv = article.url.includes("arxiv.org/abs/");
    return isArxiv && (article.textContent.length < 2500 || article.content.includes("<strong>Abstract:</strong>"));
};

export const useArticles = () => {
    const { mutate } = useSWRConfig();
    const { data, isLoading, error } = useSWR<Article[]>(ARTICLES_CACHE_KEY, listArticles, {
        revalidateOnFocus: false
    });

    const refresh = useCallback(() => mutate(ARTICLES_CACHE_KEY), [mutate]);

    const fetchDailyAIArticles = useCallback(async () => {
        const res = await fetch("/api/articles/fetch", { method: "POST", cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as FetchFeedResponse;
        const fetchedAt = Date.now();
        const batchId = `daily-${new Date(fetchedAt).toISOString().slice(0, 10)}-${fetchedAt}`;
        const inputs = await Promise.all(
            data.items.map(async (item) => ({
                id: item.id || (await articleIdFromUrl(item.url)),
                title: item.title,
                url: item.url,
                source: item.source,
                excerpt: item.excerpt,
                author: item.author,
                publishedAt: item.publishedAt,
                score: item.score,
                reason: item.reason,
                category: item.category,
                batchId,
                fetchedAt,
                tags: ["AI", item.source, item.category].filter(Boolean) as string[]
            }))
        );
        const saved = await saveArticles(inputs);
        await mutate(ARTICLES_CACHE_KEY);
        return saved;
    }, [mutate]);

    const latestBatchId = (data ?? []).find((article) => article.batchId)?.batchId;
    const latestBatchArticles = latestBatchId
        ? (data ?? []).filter((article) => article.batchId === latestBatchId)
        : [];

    const removeArticle = useCallback(
        async (id: string) => {
            await deleteArticle(id);
            await mutate(ARTICLES_CACHE_KEY);
            await mutate(articleCacheKey(id));
        },
        [mutate]
    );

    const toggleFavoriteArticle = useCallback(
        async (article: Article) => {
            const next = await updateArticle(article.id, {
                isFavorite: !article.isFavorite,
                favoritedAt: article.isFavorite ? undefined : Date.now()
            });
            await mutate(ARTICLES_CACHE_KEY);
            await mutate(articleCacheKey(article.id), next, false);
            return next;
        },
        [mutate]
    );

    return {
        articles: data ?? [],
        latestBatchArticles,
        latestBatchId,
        isLoading,
        error,
        refresh,
        fetchDailyAIArticles,
        toggleFavoriteArticle,
        removeArticle
    } as const;
};

export const useArticle = (id?: string) => {
    const { mutate } = useSWRConfig();
    const { data, isLoading, error } = useSWR<Article | null>(id ? articleCacheKey(id) : null, () => getArticle(id!), {
        revalidateOnFocus: false
    });

    const ensureContent = useCallback(async () => {
        if (!id || !data) return null;
        if (!shouldRefreshContent(data)) return data;
        const res = await fetch("/api/articles/content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: data.url }),
            cache: "no-store"
        });
        if (!res.ok) throw new Error(await res.text());
        const content = (await res.json()) as FetchContentResponse;
        const next = await saveArticle({
            ...data,
            title: content.title || data.title,
            author: content.byline || data.author,
            content: content.content,
            textContent: content.textContent,
            fetchedAt: data.fetchedAt,
            status: "reading",
            lastReadAt: Date.now()
        });
        await mutate(articleCacheKey(id), next, false);
        await mutate(ARTICLES_CACHE_KEY);
        return next;
    }, [data, id, mutate]);

    const markReading = useCallback(async () => {
        if (!id) return null;
        const next = await updateArticle(id, { status: "reading", lastReadAt: Date.now() });
        await mutate(articleCacheKey(id), next, false);
        await mutate(ARTICLES_CACHE_KEY);
        return next;
    }, [id, mutate]);

    const toggleFavoriteArticle = useCallback(async () => {
        if (!id || !data) return null;
        const next = await updateArticle(id, {
            isFavorite: !data.isFavorite,
            favoritedAt: data.isFavorite ? undefined : Date.now()
        });
        await mutate(articleCacheKey(id), next, false);
        await mutate(ARTICLES_CACHE_KEY);
        return next;
    }, [data, id, mutate]);

    return {
        article: data ?? null,
        isLoading,
        error,
        ensureContent,
        markReading,
        toggleFavoriteArticle
    } as const;
};
