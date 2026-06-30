"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { getBookBlob } from "../storage/bookStorage";

/**
 * 替代 viewer 里原本的 useDropboxAPI(client, {fileId})
 * 返回形状与原 hook 兼容: { fileBlobUrl, fileBlob, fileDisplayName, removeCache }
 */
export const useBookBlob = (id: string | null) => {
    const { data, error, mutate } = useSWR(
        id ? ["local-book-blob", id] : null,
        async ([, bookId]: [string, string]) => getBookBlob(bookId),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false
        }
    );

    const fileBlob = data?.blob;
    const fileBlobUrl = useMemo(() => (fileBlob ? URL.createObjectURL(fileBlob) : undefined), [fileBlob]);
    const fileDisplayName = data?.meta.fileName ?? "";

    return {
        fileDisplayName,
        fileBlobUrl,
        fileBlob,
        removeCache: async () => {
            await mutate(undefined, { revalidate: false });
        },
        error
    } as const;
};
