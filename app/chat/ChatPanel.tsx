"use client";
import * as React from "react";
import { useCallback, useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { useChat } from "./ChatContext";
import { type ChatSession } from "../storage/chatStorage";
import { addFavorite } from "../storage/favoriteStorage";
import styles from "./ChatPanel.module.css";

const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    if (sameDay) return `今天 ${hh}:${mm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};

const HistoryView: FC<{ currentId?: string }> = ({ currentId }) => {
    const { listHistoryForCurrentBook, loadChat } = useChat();
    const [history, setHistory] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        listHistoryForCurrentBook()
            .then((h) => setHistory(h))
            .finally(() => setLoading(false));
    }, [listHistoryForCurrentBook]);

    if (loading) return <div className={styles.historyEmpty}>加载中…</div>;
    if (history.length === 0) return <div className={styles.historyEmpty}>这本书还没有对话历史</div>;

    return (
        <div className={styles.historyList}>
            {history.map((s) => {
                const isActive = s.id === currentId;
                const lastMsg = s.messages.at(-1);
                const preview = lastMsg?.content.slice(0, 60) ?? "";
                return (
                    <button
                        key={s.id}
                        className={`${styles.historyItem} ${isActive ? styles.historyItemActive : ""}`}
                        onClick={() => loadChat(s.id)}
                        type="button"
                    >
                        <div className={styles.historyItemSelection}>「{s.selection.slice(0, 50)}」</div>
                        <div className={styles.historyItemPreview}>{preview}…</div>
                        <div className={styles.historyItemMeta}>
                            {formatTime(s.updatedAt)} · {s.messages.length} 条
                            {isActive && <span className={styles.historyItemBadge}>当前</span>}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export const ChatPanel: FC = () => {
    const { state, sendFollowUp, close, clear, setShowHistory, fontScale, setFontScale } = useChat();
    const [input, setInput] = useState("");
    const [savedMsgIds, setSavedMsgIds] = useState<Set<string>>(new Set());
    const [savedSentence, setSavedSentence] = useState(false);
    const [savedWord, setSavedWord] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [state.messages]);

    useEffect(() => {
        if (!state.isPanelOpen) return;
        const isNarrow = window.matchMedia("(max-width: 600px)").matches;
        if (isNarrow) return;
        const prev = document.body.style.getPropertyValue("--rc-panel-w");
        document.body.style.setProperty("--rc-panel-w", "380px");
        return () => {
            if (prev) document.body.style.setProperty("--rc-panel-w", prev);
            else document.body.style.removeProperty("--rc-panel-w");
        };
    }, [state.isPanelOpen]);

    // 切换会话时清掉"已收藏"本地标记(per session 重置)
    useEffect(() => {
        setSavedMsgIds(new Set());
        setSavedSentence(false);
        setSavedWord(false);
    }, [state.currentChatId]);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        window.setTimeout(() => setToast(null), 1800);
    }, []);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const q = input.trim();
        if (!q || state.isStreaming) return;
        setInput("");
        await sendFollowUp(q);
    };

    // 取当前会话最后一条完成的 AI 回复,作为收藏附带的"AI 分析"
    const lastAssistantAnalysis = (): string | undefined => {
        for (let i = state.messages.length - 1; i >= 0; i--) {
            const m = state.messages[i];
            if (m.role === "assistant" && !m.isStreaming && m.content) return m.content;
        }
        return undefined;
    };

    const favSentence = async () => {
        if (!state.bookId || !state.bookTitle || !state.selection) return;
        await addFavorite({
            type: "sentence",
            bookId: state.bookId,
            bookTitle: state.bookTitle,
            text: state.selection,
            cfi: state.cfi,
            chatId: state.currentChatId,
            aiAnalysis: lastAssistantAnalysis()
        });
        setSavedSentence(true);
        showToast("✓ 已收藏「句子」(含 AI 分析)");
    };

    const favWord = async () => {
        if (!state.bookId || !state.bookTitle || !state.selection) return;
        await addFavorite({
            type: "word",
            bookId: state.bookId,
            bookTitle: state.bookTitle,
            text: state.selection,
            cfi: state.cfi,
            chatId: state.currentChatId,
            aiAnalysis: lastAssistantAnalysis()
        });
        setSavedWord(true);
        showToast("✓ 已收藏「单词」(含 AI 分析)");
    };

    const favAnswer = async (msgId: string, content: string) => {
        if (!state.bookId || !state.bookTitle) return;
        await addFavorite({
            type: "answer",
            bookId: state.bookId,
            bookTitle: state.bookTitle,
            text: content,
            cfi: state.cfi,
            chatId: state.currentChatId
        });
        setSavedMsgIds((prev) => new Set(prev).add(msgId));
        showToast("✓ 已收藏到「回答」");
    };

    if (!state.isPanelOpen) return null;

    return (
        <div
            className={styles.panel}
            role="complementary"
            aria-label="AI 伴读"
            style={{ ["--chat-fs" as string]: fontScale } as React.CSSProperties}
        >
            <div className={styles.header}>
                <span className={styles.title}>{state.showHistory ? "📜 对话历史" : "✨ AI 伴读"}</span>
                <button
                    onClick={() => setShowHistory(!state.showHistory)}
                    title={state.showHistory ? "返回对话" : "对话历史"}
                    className={`${styles.iconBtn} ${state.showHistory ? styles.iconBtnActive : ""}`}
                    type="button"
                >
                    {state.showHistory ? "↩︎" : "📜"}
                </button>
                {!state.showHistory && (
                    <div className={styles.fontControl}>
                        <button
                            onClick={() => setFontScale(fontScale - 0.1)}
                            title="缩小字号"
                            className={styles.fontBtn}
                            type="button"
                        >
                            A−
                        </button>
                        <button
                            onClick={() => setFontScale(fontScale + 0.1)}
                            title="放大字号"
                            className={styles.fontBtn}
                            type="button"
                        >
                            A+
                        </button>
                    </div>
                )}
                <button onClick={clear} title="关闭并清空当前会话" className={styles.iconBtn} type="button">
                    🗑️
                </button>
                <button onClick={close} title="收起" className={styles.iconBtn} type="button">
                    ✕
                </button>
            </div>

            {state.showHistory ? (
                <HistoryView currentId={state.currentChatId} />
            ) : (
                <>
                    {state.selection && (
                        <div className={styles.selectionBlock}>
                            <div className={styles.selectionLabel}>你划的:</div>
                            <blockquote className={styles.selection}>{state.selection}</blockquote>
                            <div className={styles.favRow}>
                                <button
                                    onClick={favSentence}
                                    disabled={savedSentence}
                                    className={styles.favChip}
                                    type="button"
                                >
                                    {savedSentence ? "✓ 句子已收藏" : "⭐ 收藏句子"}
                                </button>
                                <button onClick={favWord} disabled={savedWord} className={styles.favChip} type="button">
                                    {savedWord ? "✓ 单词已收藏" : "⭐ 收藏单词"}
                                </button>
                            </div>
                        </div>
                    )}

                    <div ref={listRef} className={styles.messages}>
                        {state.messages.map((m) => {
                            const saved = savedMsgIds.has(m.id);
                            return (
                                <div key={m.id} className={`${styles.message} ${styles[m.role]}`}>
                                    <div className={styles.bubbleWrap}>
                                        <div className={styles.bubble}>
                                            {m.content || (m.isStreaming ? "思考中…" : "")}
                                            {m.isStreaming && m.content && <span className={styles.cursor}>▊</span>}
                                        </div>
                                        {m.role === "assistant" && !m.isStreaming && m.content && (
                                            <button
                                                onClick={() => favAnswer(m.id, m.content)}
                                                disabled={saved}
                                                className={styles.bubbleFav}
                                                title={saved ? "已收藏" : "收藏这条回答"}
                                                type="button"
                                            >
                                                {saved ? "✓" : "⭐"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <form onSubmit={onSubmit} className={styles.inputBar}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={state.isStreaming ? "正在回答…" : "继续追问…"}
                            disabled={state.isStreaming}
                            className={styles.input}
                        />
                        <button type="submit" disabled={state.isStreaming || !input.trim()} className={styles.sendBtn}>
                            发送
                        </button>
                    </form>
                </>
            )}

            {toast && <div className={styles.toast}>{toast}</div>}
        </div>
    );
};
