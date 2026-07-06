"use client";
import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { addBook, deleteBook, listBooks, type BookMeta } from "../storage/bookStorage";

const LIBRARY_CACHE_KEY = "local-library/list";

export type LibraryItem = BookMeta;

export const useLibrary = (filterQuery: string = "") => {
    const { mutate } = useSWRConfig();
    const { data, isLoading, error } = useSWR<BookMeta[]>(LIBRARY_CACHE_KEY, listBooks, {
        revalidateOnFocus: false
    });

    const items = (data ?? []).filter((b) =>
        filterQuery ? b.fileName.toLowerCase().includes(filterQuery.toLowerCase()) : true
    );
    const allItems = data ?? [];

    const refresh = useCallback(() => mutate(LIBRARY_CACHE_KEY), [mutate]);

    const importFiles = useCallback(
        async (files: FileList | File[]) => {
            const arr = Array.from(files);
            const results = await Promise.allSettled(arr.map((f) => addBook(f)));
            await mutate(LIBRARY_CACHE_KEY);
            const errors = results
                .map((r, i) => (r.status === "rejected" ? { file: arr[i].name, reason: r.reason } : null))
                .filter(Boolean);
            return { added: results.filter((r) => r.status === "fulfilled").length, errors };
        },
        [mutate]
    );

    const removeBook = useCallback(
        async (id: string) => {
            await deleteBook(id);
            await mutate(LIBRARY_CACHE_KEY);
        },
        [mutate]
    );

    return {
        items,
        allItems,
        isLoading,
        error,
        refresh,
        importFiles,
        removeBook
    } as const;
};
