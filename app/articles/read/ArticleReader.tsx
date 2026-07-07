"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "../../chat/ChatPanel";
import { ChatProvider, useChat } from "../../chat/ChatContext";
import { Loading } from "../../components/Loading";
import { addFavorite } from "../../storage/favoriteStorage";
import styles from "../articles.module.css";
import { useArticle } from "../useArticles";

type SelectionState = {
    text: string;
    x: number;
    y: number;
};

const formatDate = (timestamp?: number) => {
    if (!timestamp) return null;
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(new Date(timestamp));
};

const buildFallbackHtml = (excerpt?: string) =>
    `<p>${(excerpt || "正文还没有抓取成功,可以打开原文链接阅读。").replace(/</g, "&lt;")}</p>`;

// 正文拆成 memo 子组件:selection 变化只影响 ReaderInner,ArticleBody 的 props
// (content/excerpt/onSelection) 都稳定,memo 跳过 re-render,article DOM 不重建,
// 浏览器划词选区得以保留。
const ArticleBody = memo(
    ({
        content,
        excerpt,
        onSelection
    }: {
        content?: string;
        excerpt?: string;
        onSelection: (s: SelectionState | null) => void;
    }) => {
        const bodyRef = useRef<HTMLElement>(null);
        const handleMouseUp = useCallback(() => {
            const sel = window.getSelection();
            const text = sel?.toString().trim();
            if (!sel || !text || text.length < 2 || !bodyRef.current) {
                onSelection(null);
                return;
            }
            const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            if (!range || !bodyRef.current.contains(range.commonAncestorContainer)) {
                onSelection(null);
                return;
            }
            const rect = range.getBoundingClientRect();
            onSelection({
                text: text.slice(0, 1200),
                x: Math.max(12, Math.min(rect.left, window.innerWidth - 220)),
                y: Math.max(12, rect.top - 52)
            });
        }, [onSelection]);
        return (
            <article
                ref={bodyRef}
                className={styles.readerBody}
                onMouseUp={handleMouseUp}
                onTouchEnd={handleMouseUp}
                dangerouslySetInnerHTML={{ __html: content || buildFallbackHtml(excerpt) }}
            />
        );
    }
);
ArticleBody.displayName = "ArticleBody";

const ReaderInner = () => {
    const searchParams = useSearchParams();
    const id = searchParams?.get("id") ?? undefined;
    const { article, isLoading, ensureContent, markReading, toggleFavoriteArticle } = useArticle(id);
    const { openWith, openFreeform } = useChat();
    const [selection, setSelection] = useState<SelectionState | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!article?.id) return;
        void markReading();
    }, [article?.id, markReading]);

    useEffect(() => {
        if (!article?.id) return;
        let canceled = false;
        ensureContent().catch((e) => {
            if (!canceled) setStatus(e instanceof Error ? `正文抓取失败: ${e.message}` : "正文抓取失败");
        });
        return () => {
            canceled = true;
        };
    }, [article?.id, ensureContent]);

    const clearSelection = useCallback(() => {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
    }, []);

    const askAI = async () => {
        if (!article || !selection) return;
        await openWith({
            bookId: article.id,
            bookTitle: article.title,
            selection: selection.text,
            chapterText: article.textContent || article.excerpt || article.title,
            cfi: `article:${article.id}`
        });
        clearSelection();
    };

    const openArticleAI = async () => {
        if (!article) return;
        await openFreeform({
            bookId: article.id,
            bookTitle: article.title,
            chapterText: article.textContent || article.excerpt || article.title,
            cfi: `article:${article.id}`
        });
    };

    const saveSelection = async (type: "sentence" | "word") => {
        if (!article || !selection) return;
        await addFavorite({
            type,
            bookId: article.id,
            bookTitle: article.title,
            text: selection.text,
            cfi: `article:${article.id}`,
            context: article.url
        });
        setStatus(type === "word" ? "已收藏单词" : "已收藏句子");
        window.setTimeout(() => setStatus(null), 1800);
        clearSelection();
    };

    if (isLoading) {
        return (
            <main className={styles.reader}>
                <Loading>Loading article...</Loading>
            </main>
        );
    }

    if (!article) {
        return (
            <main className={styles.reader}>
                <Link href="/articles" className={styles.navLink}>
                    ← 返回文章库
                </Link>
                <p className={styles.empty}>这篇文章不在本地库里。</p>
            </main>
        );
    }

    return (
        <main className={styles.reader}>
            <div className={styles.topbar}>
                <Link href="/articles" className={styles.navLink}>
                    ← 返回文章库
                </Link>
                <div className={styles.readerActions}>
                    <button className={styles.ghostButton} onClick={openArticleAI} type="button">
                        ✨ 问 AI
                    </button>
                    <button className={styles.ghostButton} onClick={toggleFavoriteArticle} type="button">
                        {article.isFavorite ? "★ 已收藏" : "☆ 收藏文章"}
                    </button>
                    <a href={article.url} target="_blank" rel="noreferrer" className={styles.sourceLink}>
                        原文链接
                    </a>
                </div>
            </div>

            <header className={styles.readerHeader}>
                <div className={styles.meta}>
                    <span>{article.source}</span>
                    {formatDate(article.publishedAt) && (
                        <>
                            <span>·</span>
                            <span>{formatDate(article.publishedAt)}</span>
                        </>
                    )}
                    {article.author && (
                        <>
                            <span>·</span>
                            <span>{article.author}</span>
                        </>
                    )}
                </div>
                <h1 className={styles.readerTitle}>{article.title}</h1>
                {status && <p className={styles.status}>{status}</p>}
                {!article.content && !status && <Loading>Fetching readable article...</Loading>}
            </header>

            {selection && (
                <div className={styles.selectedQuote}>
                    <div className={styles.selectedQuoteLabel}>已选中</div>
                    <div className={styles.selectedQuoteText}>「{selection.text}」</div>
                </div>
            )}

            <ArticleBody content={article.content} excerpt={article.excerpt} onSelection={setSelection} />

            {selection && (
                <div className={styles.selectionToolbar} style={{ left: selection.x, top: selection.y }}>
                    <button className={styles.toolbarButton} type="button" onClick={() => saveSelection("sentence")}>
                        ⭐ 句子
                    </button>
                    <button className={styles.toolbarButton} type="button" onClick={() => saveSelection("word")}>
                        🔤 单词
                    </button>
                    <button className={styles.toolbarButton} type="button" onClick={askAI}>
                        ✨ 问 AI
                    </button>
                </div>
            )}
        </main>
    );
};

export const ArticleReader = () => {
    return (
        <ChatProvider>
            <ChatPanel />
            <ReaderInner />
        </ChatProvider>
    );
};
