"use client";
import Link from "next/link";
import { useState } from "react";
import { Loading } from "../components/Loading";
import { useArticles } from "./useArticles";
import styles from "./articles.module.css";

const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Unknown date";
    return new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(timestamp));
};

export default function ArticlesPage() {
    const { articles, latestBatchArticles, isLoading, fetchDailyAIArticles, toggleFavoriteArticle, removeArticle } =
        useArticles();
    const [isFetching, setIsFetching] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"today" | "favorites" | "all">("today");
    const favoriteArticles = articles.filter((article) => article.isFavorite);
    const visibleArticles =
        viewMode === "today" ? latestBatchArticles : viewMode === "favorites" ? favoriteArticles : articles;

    const onFetch = async () => {
        setIsFetching(true);
        setStatus(null);
        try {
            const saved = await fetchDailyAIArticles();
            setViewMode("today");
            setStatus(`已生成今日阅读包: ${saved.length} 篇 AI 英文文章`);
        } catch (e) {
            setStatus(e instanceof Error ? `抓取失败: ${e.message}` : "抓取失败");
        } finally {
            setIsFetching(false);
        }
    };

    return (
        <main className={styles.shell}>
            <div className={styles.topbar}>
                <Link href="/" className={styles.navLink}>
                    ← 返回书架
                </Link>
            </div>

            <section className={styles.headerBlock}>
                <div>
                    <h1 className={styles.title}>AI Articles</h1>
                    <p className={styles.subtitle}>AI 精筛最新发展、LLM 产品、认知/学习相关的英文阅读材料。</p>
                </div>
                <button className={styles.primaryButton} onClick={onFetch} disabled={isFetching} type="button">
                    {isFetching ? "AI 精筛中..." : "抓取并精筛今日文章"}
                </button>
            </section>

            {status && <p className={styles.status}>{status}</p>}

            {isLoading ? (
                <Loading>Loading articles...</Loading>
            ) : articles.length === 0 ? (
                <p className={styles.empty}>还没有文章。先点“抓取今日 AI 文章”。</p>
            ) : (
                <>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tabButton} ${viewMode === "today" ? styles.tabButtonActive : ""}`}
                            onClick={() => setViewMode("today")}
                            type="button"
                        >
                            今日阅读包
                        </button>
                        <button
                            className={`${styles.tabButton} ${viewMode === "favorites" ? styles.tabButtonActive : ""}`}
                            onClick={() => setViewMode("favorites")}
                            type="button"
                        >
                            收藏文章
                        </button>
                        <button
                            className={`${styles.tabButton} ${viewMode === "all" ? styles.tabButtonActive : ""}`}
                            onClick={() => setViewMode("all")}
                            type="button"
                        >
                            全部文章
                        </button>
                    </div>
                    <p className={styles.countHint}>
                        {viewMode === "today" && `显示最近一次精筛保存的 ${visibleArticles.length} 篇`}
                        {viewMode === "favorites" && `显示你收藏的 ${visibleArticles.length} 篇文章`}
                        {viewMode === "all" && `显示本地保存的全部 ${visibleArticles.length} 篇`}
                    </p>
                    {visibleArticles.length === 0 ? (
                        <p className={styles.empty}>
                            {viewMode === "favorites" ? "还没有收藏文章。" : "还没有今日阅读包。点上面的按钮生成一次。"}
                        </p>
                    ) : (
                        <ul className={styles.articleList}>
                            {visibleArticles.map((article) => (
                                <li key={article.id} className={styles.articleItem}>
                                    <Link
                                        href={`/articles/read?id=${encodeURIComponent(article.id)}`}
                                        className={styles.articleTitle}
                                    >
                                        {article.title}
                                    </Link>
                                    <div className={styles.meta}>
                                        <span>{article.source}</span>
                                        <span>·</span>
                                        <span>{formatDate(article.publishedAt ?? article.fetchedAt)}</span>
                                        {article.author && (
                                            <>
                                                <span>·</span>
                                                <span>{article.author}</span>
                                            </>
                                        )}
                                    </div>
                                    {(article.score || article.category) && (
                                        <div className={styles.rankRow}>
                                            {article.score && (
                                                <span className={styles.scoreBadge}>{article.score}/100</span>
                                            )}
                                            {article.category && (
                                                <span className={styles.categoryBadge}>{article.category}</span>
                                            )}
                                        </div>
                                    )}
                                    {article.reason && <p className={styles.reason}>筛选理由: {article.reason}</p>}
                                    {article.excerpt && <p className={styles.excerpt}>{article.excerpt}</p>}
                                    <div className={styles.itemActions}>
                                        <div className={styles.itemActionGroup}>
                                            <button
                                                className={styles.ghostButton}
                                                onClick={() => toggleFavoriteArticle(article)}
                                                type="button"
                                            >
                                                {article.isFavorite ? "★ 已收藏" : "☆ 收藏文章"}
                                            </button>
                                            <a
                                                className={styles.sourceLink}
                                                href={article.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                原文链接
                                            </a>
                                        </div>
                                        <button
                                            className={styles.ghostButton}
                                            onClick={() => removeArticle(article.id)}
                                            type="button"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </main>
    );
}
