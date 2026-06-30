"use client";
import * as React from "react";
import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { useChat } from "./ChatContext";
import styles from "./ChatPanel.module.css";

export const ChatPanel: FC = () => {
    const { state, sendFollowUp, close, clear, fontScale, setFontScale } = useChat();
    const [input, setInput] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [state.messages]);

    // 给页面其他元素让位:viewer 主容器 + 右侧浮动按钮通过 var(--rc-panel-w) 自动避让
    useEffect(() => {
        if (!state.isPanelOpen) return;
        // 移动端 panel 全屏(参考 ChatPanel.module.css 的 600px 媒体查询),不挤压
        const isNarrow = window.matchMedia("(max-width: 600px)").matches;
        if (isNarrow) return;
        const prev = document.body.style.getPropertyValue("--rc-panel-w");
        document.body.style.setProperty("--rc-panel-w", "380px");
        return () => {
            if (prev) document.body.style.setProperty("--rc-panel-w", prev);
            else document.body.style.removeProperty("--rc-panel-w");
        };
    }, [state.isPanelOpen]);

    if (!state.isPanelOpen) return null;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const q = input.trim();
        if (!q || state.isStreaming) return;
        setInput("");
        await sendFollowUp(q);
    };

    return (
        <div
            className={styles.panel}
            role="complementary"
            aria-label="AI 伴读"
            style={{ ["--chat-fs" as string]: fontScale } as React.CSSProperties}
        >
            <div className={styles.header}>
                <span className={styles.title}>✨ AI 伴读</span>
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
                <button onClick={clear} title="清空对话" className={styles.iconBtn} type="button">
                    🗑️
                </button>
                <button onClick={close} title="收起" className={styles.iconBtn} type="button">
                    ✕
                </button>
            </div>

            {state.selection && (
                <div className={styles.selectionBlock}>
                    <div className={styles.selectionLabel}>你划的:</div>
                    <blockquote className={styles.selection}>{state.selection}</blockquote>
                </div>
            )}

            <div ref={listRef} className={styles.messages}>
                {state.messages.map((m) => (
                    <div key={m.id} className={`${styles.message} ${styles[m.role]}`}>
                        <div className={styles.bubble}>
                            {m.content || (m.isStreaming ? "思考中…" : "")}
                            {m.isStreaming && m.content && <span className={styles.cursor}>▊</span>}
                        </div>
                    </div>
                ))}
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
        </div>
    );
};
