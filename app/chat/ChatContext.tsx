"use client";
import { createContext, useCallback, useContext, useState, type FC, type ReactNode } from "react";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
};

type ChatState = {
    isPanelOpen: boolean;
    messages: ChatMessage[];
    bookTitle?: string;
    chapterText?: string;
    selection?: string;
    isStreaming: boolean;
};

type ChatContextValue = {
    state: ChatState;
    openWith: (args: { selection: string; chapterText: string; bookTitle?: string }) => Promise<void>;
    sendFollowUp: (question: string) => Promise<void>;
    close: () => void;
    clear: () => void;
    fontScale: number;
    setFontScale: (s: number) => void;
};

const FONT_SCALE_KEY = "mubook-hon-chat-font-scale";
const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.6;
const clampFontScale = (s: number) => Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, s));
const readInitialFontScale = (): number => {
    if (typeof localStorage === "undefined") return 1;
    const v = localStorage.getItem(FONT_SCALE_KEY);
    const parsed = v ? parseFloat(v) : NaN;
    return Number.isFinite(parsed) ? clampFontScale(parsed) : 1;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error("useChat must be used within <ChatProvider>");
    return ctx;
};

const uuid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Cap chapter text to keep prompt under a few thousand tokens
const MAX_CHAPTER_CHARS = 6000;

const buildSystemPrompt = (selection: string, chapterText: string, bookTitle?: string) => {
    const titleLine = bookTitle ? `用户正在阅读《${bookTitle}》。\n` : "";
    const ctxText =
        chapterText.length > MAX_CHAPTER_CHARS
            ? chapterText.slice(0, MAX_CHAPTER_CHARS) + "…(后续内容省略)"
            : chapterText;
    return `你是用户的阅读伴侣 AI。${titleLine}
当前章节内容(供你参考):
"""
${ctxText}
"""

用户刚刚划出了这段话:
「${selection}」

请围绕这段话回答用户的问题——可以解释含义、补充背景、揭示作者意图,或回应用户后续追问。回答要简洁有洞察,引用原文用「」标出。默认用中文回答。`;
};

export const ChatProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ChatState>({
        isPanelOpen: false,
        messages: [],
        isStreaming: false
    });
    const [fontScale, setFontScaleState] = useState<number>(readInitialFontScale);
    const setFontScale = useCallback((s: number) => {
        const clamped = clampFontScale(s);
        setFontScaleState(clamped);
        try {
            localStorage.setItem(FONT_SCALE_KEY, String(clamped));
        } catch {
            /* localStorage unavailable, in-memory only */
        }
    }, []);

    const streamFromAPI = useCallback(
        async (apiMessages: { role: "system" | "user" | "assistant"; content: string }[]) => {
            const assistantId = uuid();
            setState((s) => ({
                ...s,
                messages: [...s.messages, { id: assistantId, role: "assistant", content: "", isStreaming: true }],
                isStreaming: true
            }));

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages: apiMessages })
                });
                if (!res.ok || !res.body) {
                    const errText = await res.text().catch(() => "");
                    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let acc = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    acc += decoder.decode(value, { stream: true });
                    setState((s) => ({
                        ...s,
                        messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
                    }));
                }
                setState((s) => ({
                    ...s,
                    messages: s.messages.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
                    isStreaming: false
                }));
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setState((s) => ({
                    ...s,
                    messages: s.messages.map((m) =>
                        m.id === assistantId ? { ...m, content: `❌ ${msg}`, isStreaming: false } : m
                    ),
                    isStreaming: false
                }));
            }
        },
        []
    );

    const openWith = useCallback(
        async ({
            selection,
            chapterText,
            bookTitle
        }: {
            selection: string;
            chapterText: string;
            bookTitle?: string;
        }) => {
            const userMsg: ChatMessage = {
                id: uuid(),
                role: "user",
                content: `请就这段话展开说说。`
            };
            setState({
                isPanelOpen: true,
                messages: [userMsg],
                bookTitle,
                chapterText,
                selection,
                isStreaming: false
            });
            await streamFromAPI([
                { role: "system", content: buildSystemPrompt(selection, chapterText, bookTitle) },
                { role: "user", content: userMsg.content }
            ]);
        },
        [streamFromAPI]
    );

    const sendFollowUp = useCallback(
        async (question: string) => {
            const q = question.trim();
            if (!q) return;
            const sel = state.selection;
            const ch = state.chapterText;
            if (!sel || !ch) return;

            const userMsg: ChatMessage = { id: uuid(), role: "user", content: q };
            const history = [...state.messages, userMsg];
            setState((s) => ({ ...s, messages: history }));

            // build API payload: system + full conversation
            const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
                { role: "system", content: buildSystemPrompt(sel, ch, state.bookTitle) },
                ...history.map((m) => ({ role: m.role, content: m.content }))
            ];
            await streamFromAPI(apiMessages);
        },
        [state.messages, state.selection, state.chapterText, state.bookTitle, streamFromAPI]
    );

    const close = useCallback(() => setState((s) => ({ ...s, isPanelOpen: false })), []);
    const clear = useCallback(() => setState({ isPanelOpen: false, messages: [], isStreaming: false }), []);

    return (
        <ChatContext.Provider value={{ state, openWith, sendFollowUp, close, clear, fontScale, setFontScale }}>
            {children}
        </ChatContext.Provider>
    );
};
