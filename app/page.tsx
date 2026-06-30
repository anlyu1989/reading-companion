"use client";
import { FC, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useNotionList } from "./notion/useNotionList";
import { Loading } from "./components/Loading";
import { useUserSettings } from "./settings/useUserSettings";
import { usePWAFreshLaunch, useLastRead } from "./lib/usePWAFreshLaunch";
import { useLibrary, type LibraryItem } from "./library/useLibrary";

const emptySubscribe = () => () => {};
const useReady = () => {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
};
const useSearch = (initialSearch: string) => {
    const [searchInput, setSearchInput] = useState(initialSearch);
    const onInputSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    }, []);
    return {
        searchInput,
        onInputSearch
    };
};

const RESUME_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const viewerTypeForBook = (item: LibraryItem) => (item.type === "epub" ? "epub:foliate" : "pdf:pdfjs");

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const HomeContent: FC = () => {
    const ready = useReady();
    const { userSettings } = useUserSettings();
    const searchParams = useSearchParams();
    const { recentBooks, isLoadingRecentBooks } = useNotionList();
    const { searchInput, onInputSearch } = useSearch(searchParams?.get("filter") || "");
    const { items, isLoading: isLoadingLibrary, importFiles, removeBook } = useLibrary(searchInput);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [importStatus, setImportStatus] = useState<string | null>(null);

    const isFreshLaunch = usePWAFreshLaunch();
    const lastRead = useLastRead();
    const [isAutoNavigating, setIsAutoNavigating] = useState(false);

    useEffect(() => {
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

    useEffect(() => {
        if (!isFreshLaunch || !lastRead) return;
        const isWithin24Hours = Date.now() - lastRead.timestamp < RESUME_THRESHOLD_MS;
        if (!isWithin24Hours) return;
        setIsAutoNavigating(true);
        window.location.href = `/viewer?id=${encodeURIComponent(lastRead.fileId)}&viewer=${encodeURIComponent(lastRead.viewer)}`;
    }, [isFreshLaunch, lastRead]);

    const handleFiles = useCallback(
        async (files: FileList | File[]) => {
            const { added, errors } = await importFiles(files);
            const errCount = errors.length;
            setImportStatus(
                errCount === 0 ? `已导入 ${added} 本书` : `导入 ${added} 本,${errCount} 本失败 (仅支持 .epub / .pdf)`
            );
            window.setTimeout(() => setImportStatus(null), 4000);
        },
        [importFiles]
    );

    const onSelectFiles = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = ""; // reset so the same file can be re-selected
        },
        [handleFiles]
    );

    const onDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    if (isAutoNavigating && lastRead) {
        return (
            <div className={"main"}>
                <Loading>Resuming: {lastRead.title || lastRead.fileName}...</Loading>
            </div>
        );
    }

    if (!ready) {
        return (
            <div className={"main"}>
                <Loading>Loading...</Loading>
            </div>
        );
    }

    return (
        <div className={"main"}>
            <header>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                    <div style={{ flex: 1, justifyContent: "flex-start" }}>
                        <h1 style={{ margin: 0 }}>
                            <Link href={"/"}>
                                <img
                                    src={"/icons/icon-256x256.png"}
                                    style={{ width: "1em", height: "1em", margin: "0" }}
                                    alt={"reading-companion"}
                                />
                            </Link>
                        </h1>
                    </div>
                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "1em" }}>
                        <Link href={"/settings"} style={{ fontSize: "1.2em" }} title={"Settings"}>
                            ⚙️Settings
                        </Link>
                    </div>
                </div>
            </header>

            <h2>Recent Books</h2>
            <details>
                <summary>
                    {isLoadingRecentBooks ? (
                        "Loading recent books..."
                    ) : !recentBooks || recentBooks.length === 0 ? (
                        "No recent books (configure Notion in Settings to enable)"
                    ) : (
                        <a
                            href={`/viewer?id=${encodeURIComponent(recentBooks[0].fileId)}&viewer=${encodeURIComponent(recentBooks[0].viewer)}`}
                        >
                            📖 {recentBooks[0].fileName}
                        </a>
                    )}
                </summary>
                <ul>
                    {recentBooks?.slice(1).map((item) => (
                        <li key={item.fileId}>
                            📖{" "}
                            <a
                                href={`/viewer?id=${encodeURIComponent(item.fileId)}&viewer=${encodeURIComponent(item.viewer)}`}
                                target={userSettings?.openNewTab ? "_blank" : undefined}
                                rel={userSettings?.openNewTab ? "noopener" : undefined}
                            >
                                {item.fileName}
                            </a>
                        </li>
                    ))}
                </ul>
            </details>

            <h2>My Library</h2>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: `2px dashed ${isDragging ? "#0070f3" : "#ccc"}`,
                    background: isDragging ? "#eef6ff" : "#fafafa",
                    borderRadius: 8,
                    padding: "1.5em",
                    textAlign: "center",
                    cursor: "pointer",
                    marginBottom: "1em",
                    transition: "all 0.15s ease"
                }}
            >
                <div style={{ fontSize: "2em", marginBottom: "0.3em" }}>📚</div>
                <div>拖拽 epub / pdf 到这里,或点击选择文件</div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".epub,.pdf"
                    multiple
                    onChange={onSelectFiles}
                    style={{ display: "none" }}
                />
            </div>

            {importStatus && (
                <div style={{ padding: "0.5em 1em", background: "#e6f7e6", borderRadius: 4, marginBottom: "1em" }}>
                    {importStatus}
                </div>
            )}

            <form style={{ display: "flex", flexDirection: "row" }} onSubmit={(event) => event.preventDefault()}>
                <label htmlFor={"input-search"}>🔎</label>
                <input
                    id="input-search"
                    type={"text"}
                    value={searchInput}
                    onInput={onInputSearch}
                    style={{ flex: 1, marginLeft: "0.5em", fontSize: "16px" }}
                />
            </form>

            {isLoadingLibrary ? (
                <Loading>Loading library...</Loading>
            ) : items.length === 0 ? (
                <p style={{ color: "#666", marginTop: "1em" }}>书架空空如也,导入一本书开始阅读吧。</p>
            ) : (
                <ul>
                    {items.map((item) => (
                        <li key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
                            <a
                                href={`/viewer?id=${encodeURIComponent(item.id)}&viewer=${encodeURIComponent(viewerTypeForBook(item))}`}
                                target={userSettings?.openNewTab ? "_blank" : undefined}
                                rel={userSettings?.openNewTab ? "noopener" : undefined}
                                style={{ flex: 1 }}
                            >
                                {item.type === "epub" ? "📘" : "📄"} {item.fileName}
                            </a>
                            <span style={{ color: "#888", fontSize: "0.85em" }}>{formatSize(item.size)}</span>
                            <button
                                onClick={async () => {
                                    if (confirm(`删除「${item.fileName}」?`)) await removeBook(item.id);
                                }}
                                title="删除"
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    color: "#888",
                                    fontSize: "1em"
                                }}
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Home: FC = () => {
    return (
        <Suspense fallback={<Loading>Loading...</Loading>}>
            <HomeContent />
        </Suspense>
    );
};

export default Home;
