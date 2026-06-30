"use client";
import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { deleteFavorite, listFavorites, type Favorite, type FavoriteType } from "../storage/favoriteStorage";

const cacheKey = (type?: FavoriteType, bookId?: string) => ["favorites/list", type ?? "all", bookId ?? "all"].join(":");

export const useFavorites = (options?: { type?: FavoriteType; bookId?: string }) => {
    const { mutate } = useSWRConfig();
    const key = cacheKey(options?.type, options?.bookId);
    const { data, isLoading, error } = useSWR<Favorite[]>(key, () => listFavorites(options), {
        revalidateOnFocus: false
    });

    const remove = useCallback(
        async (id: string) => {
            await deleteFavorite(id);
            // 失效所有 favorites/list cache(全部 + 各 type 视图)
            await mutate((k) => typeof k === "string" && k.startsWith("favorites/list"));
        },
        [mutate]
    );

    return { items: data ?? [], isLoading, error, remove } as const;
};
