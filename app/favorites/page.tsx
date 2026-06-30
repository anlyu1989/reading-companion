"use client";
import { type FC, useState } from "react";
import Link from "next/link";
import { useFavorites } from "../library/useFavorites";
import { type Favorite, type FavoriteType } from "../storage/favoriteStorage";
import { encodeBookMarker } from "../notion/useNotion";
import styles from "./favorites.module.css";

type TabKey = "all" | FavoriteType;

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "all", label: "全部", icon: "🗂️" },
    { key: "sentence", label: "句子", icon: "✍️" },
    { key: "answer", label: "回答", icon: "💬" },
    { key: "word", label: "单词", icon: "🔤" }
];

const formatDate = (ts: number): string => {
    const d = new Date(ts);
    const m = d.getMonth() + 1;
    const dy = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getFullYear()}/${m}/${dy} ${hh}:${mm}`;
};

const typeMeta = (t: FavoriteType) => {
    if (t === "sentence") return { label: "句子", color: "var(--color-brand)" };
    if (t === "answer") return { label: "AI 回答", color: "#8b5cf6" };
    return { label: "单词", color: "#0ea5e9" };
};

// 当前 chat 只在 epub viewer 用,跳转 hardcode epub:foliate;以后扩展 PDF 时调整
const buildOriginUrl = (fav: Favorite) => {
    const params = new URLSearchParams();
    params.set("id", fav.bookId);
    params.set("viewer", "epub:foliate");
    if (fav.cfi) params.set("marker", encodeBookMarker({ cfi: fav.cfi }));
    return `/viewer?${params.toString()}`;
};

const FavoriteRow: FC<{ fav: Favorite; onRemove: (id: string) => void }> = ({ fav, onRemove }) => {
    const meta = typeMeta(fav.type);
    const canJump = !!fav.cfi;
    return (
        <li className={styles.row}>
            <div className={styles.rowHead}>
                <span className={styles.typeBadge} style={{ background: meta.color }}>
                    {meta.label}
                </span>
                <span className={styles.book}>《{fav.bookTitle}》</span>
                <span className={styles.time}>{formatDate(fav.createdAt)}</span>
                <button
                    onClick={() => {
                        if (confirm(`删除这条收藏?\n\n${fav.text.slice(0, 80)}`)) onRemove(fav.id);
                    }}
                    className={styles.deleteBtn}
                    title="删除"
                    type="button"
                >
                    ✕
                </button>
            </div>
            <div className={styles.text}>{fav.text}</div>
            <div className={styles.rowFoot}>
                {canJump ? (
                    <a href={buildOriginUrl(fav)} target="_blank" rel="noopener" className={styles.jumpBtn}>
                        ↗ 打开原文
                    </a>
                ) : (
                    <span className={styles.noJump}>(无原文位置)</span>
                )}
            </div>
        </li>
    );
};

const FavoritesContent: FC = () => {
    const [tab, setTab] = useState<TabKey>("all");
    const { items, isLoading, remove } = useFavorites({ type: tab === "all" ? undefined : tab });

    return (
        <div className={styles.main}>
            <header className={styles.header}>
                <Link href="/" className={styles.backLink}>
                    ←
                </Link>
                <h1 className={styles.title}>⭐ 我的收藏</h1>
            </header>

            <div className={styles.tabs} role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.key}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <p className={styles.empty}>加载中…</p>
            ) : items.length === 0 ? (
                <p className={styles.empty}>这里还没有内容。读书时点 ⭐ 把好句、好答、生词存下来。</p>
            ) : (
                <ul className={styles.list}>
                    {items.map((f) => (
                        <FavoriteRow key={f.id} fav={f} onRemove={remove} />
                    ))}
                </ul>
            )}
        </div>
    );
};

export default function FavoritesPage() {
    return <FavoritesContent />;
}
