"use client";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { SWRConfig } from "swr";
import { useIDBCacheProvider } from "../lib/useIDBCacheProvider";
import { useBookBlob } from "../library/useBookBlob";
import "./toast.css";
import type { BibiReaderProps } from "./bibi-epub/BibiReader";
import { useSearchParams } from "next/navigation";
import { Loading } from "../components/Loading";
import dynamic from "next/dynamic";

const BibiReader = dynamic(() => import("./bibi-epub/BibiReader").then((mod) => ({ default: mod.BibiReader })), {
    ssr: false
});
const FoliateReader = dynamic(() => import("./epub/FoliateReader").then((mod) => ({ default: mod.FoliateReader })), {
    ssr: false
});
const PdfReader = dynamic(() => import("./pdf/PdfReader").then((mod) => ({ default: mod.PdfReader })), { ssr: false });
const KindleReader = dynamic(() => import("./kindle/KindleReader").then((mod) => ({ default: mod.KindleReader })), {
    ssr: false
});

function ViewerContentInner() {
    const searchParams = useSearchParams();
    const cacheProvider = useIDBCacheProvider({
        dbName: "mubook-hon",
        storeName: "mubook-book"
    });
    if (!cacheProvider) {
        return <Loading>Loading Cache Provider...</Loading>;
    }
    const initialPage = searchParams?.get("page") ?? undefined;
    const viewerType = searchParams?.get("viewer") ?? undefined;
    const initialMarker = searchParams?.get("marker") ?? undefined;
    const translation = searchParams?.has("translation") ?? false;
    const fileId = searchParams?.get("id");
    if (!fileId) {
        return <div>ID not found</div>;
    }
    if (
        viewerType !== "epub:bibi" &&
        viewerType !== "epub:foliate" &&
        viewerType !== "pdf:pdfjs" &&
        viewerType !== "kindle"
    ) {
        return <div>Invalid viewer type: {viewerType}</div>;
    }
    return (
        <SWRConfig
            value={{
                provider: () => cacheProvider
            }}
        >
            <App
                viewerType={viewerType}
                id={fileId}
                initialPage={initialPage}
                initialMarker={initialMarker}
                translation={translation}
            />
        </SWRConfig>
    );
}

export function ViewerContent() {
    return (
        <Suspense fallback={<Loading>Loading...</Loading>}>
            <ViewerContentInner />
        </Suspense>
    );
}

const LoadingBook = (props: { tooLoadingLong: boolean; onClickReloadWithoutCache: () => void }) => {
    return (
        <div>
            <Loading>Loading Book...</Loading>
            {props.tooLoadingLong && <button onClick={props.onClickReloadWithoutCache}>Remove Cache and Reload</button>}
        </div>
    );
};

const App = (
    props: Pick<BibiReaderProps, "id" | "initialPage" | "initialMarker" | "translation"> & {
        viewerType: "epub:bibi" | "epub:foliate" | "pdf:pdfjs" | "kindle";
    }
) => {
    const id = props.id;
    const { fileBlobUrl, fileBlob, fileDisplayName, removeCache } = useBookBlob(id);
    const [tooLoadLong, setTooLoadLong] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            setTooLoadLong(true);
        }, 5000);
        return () => {
            clearTimeout(timer);
        };
    }, []);
    const onClickReloadWithoutCache = useCallback(() => {
        removeCache().then(() => {
            location.reload();
        });
    }, [removeCache]);
    return (
        <>
            {props.viewerType === "kindle" && (
                <Suspense
                    fallback={
                        <LoadingBook
                            onClickReloadWithoutCache={onClickReloadWithoutCache}
                            tooLoadingLong={tooLoadLong}
                        />
                    }
                >
                    <KindleReader id={id} initialMarker={props.initialMarker} />
                </Suspense>
            )}
            {props.viewerType === "epub:bibi" && (
                <Suspense
                    fallback={
                        <LoadingBook
                            onClickReloadWithoutCache={onClickReloadWithoutCache}
                            tooLoadingLong={tooLoadLong}
                        />
                    }
                >
                    <BibiReader
                        id={id}
                        bookFileName={fileDisplayName}
                        src={fileBlobUrl}
                        fileBlob={fileBlob}
                        initialPage={props.initialPage}
                        initialMarker={props.initialMarker}
                        translation={props.translation}
                    />
                </Suspense>
            )}
            {props.viewerType === "epub:foliate" && (
                <Suspense
                    fallback={
                        <LoadingBook
                            onClickReloadWithoutCache={onClickReloadWithoutCache}
                            tooLoadingLong={tooLoadLong}
                        />
                    }
                >
                    <FoliateReader
                        id={id}
                        bookFileName={fileDisplayName}
                        src={fileBlobUrl}
                        fileBlob={fileBlob}
                        initialPage={props.initialPage}
                        initialMarker={props.initialMarker}
                        onClearCache={removeCache}
                    />
                </Suspense>
            )}
            {props.viewerType === "pdf:pdfjs" && (
                <Suspense
                    fallback={
                        <LoadingBook
                            onClickReloadWithoutCache={onClickReloadWithoutCache}
                            tooLoadingLong={tooLoadLong}
                        />
                    }
                >
                    <PdfReader
                        src={fileBlobUrl}
                        id={id}
                        bookFileName={fileDisplayName}
                        initialPage={props.initialPage}
                        initialMarker={props.initialMarker}
                    />
                </Suspense>
            )}
        </>
    );
};
