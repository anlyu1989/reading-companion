"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FC, type ReactNode } from "react";
import {
    createChat,
    getChat,
    listChatsForBook,
    updateChatMessages,
    type ChatSession,
    type StoredMessage
} from "../storage/chatStorage";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
};

type ChatState = {
    isPanelOpen: boolean;
    showHistory: boolean;
    messages: ChatMessage[];
    bookId?: string;
    bookTitle?: string;
    chapterText?: string;
    selection?: string;
    cfi?: string;
    currentChatId?: string;
    isStreaming: boolean;
};

type ChatContextValue = {
    state: ChatState;
    openWith: (args: {
        bookId: string;
        bookTitle: string;
        selection: string;
        chapterText: string;
        cfi: string;
    }) => Promise<void>;
    sendFollowUp: (question: string) => Promise<void>;
    loadChat: (chatId: string) => Promise<void>;
    listHistoryForCurrentBook: () => Promise<ChatSession[]>;
    setShowHistory: (v: boolean) => void;
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

const toStored = (messages: ChatMessage[]): StoredMessage[] =>
    messages.map((m) => ({ role: m.role, content: m.content }));

const fromStored = (messages: StoredMessage[]): ChatMessage[] =>
    messages.map((m) => ({ id: uuid(), role: m.role, content: m.content }));

export const ChatProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ChatState>({
        isPanelOpen: false,
        showHistory: false,
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
            /* unavailable */
        }
    }, []);

    // 流式回答结束后,自动把完整 messages 持久化到 chat session
    const lastSavedRef = useRef<string>("");
    useEffect(() => {
        if (state.isStreaming) return;
        if (!state.currentChatId || state.messages.length === 0) return;
        const stored = toStored(state.messages);
        const sig = state.currentChatId + ":" + stored.length + ":" + (stored.at(-1)?.content.length ?? 0);
        if (sig === lastSavedRef.current) return;
        lastSavedRef.current = sig;
        updateChatMessages(state.currentChatId, stored).catch((e) => console.error("[chat] save failed", e));
    }, [state.isStreaming, state.currentChatId, state.messages]);

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
            bookId,
            bookTitle,
            selection,
            chapterText,
            cfi
        }: {
            bookId: string;
            bookTitle: string;
            selection: string;
            chapterText: string;
            cfi: string;
        }) => {
            const userMsg: ChatMessage = { id: uuid(), role: "user", content: `请就这段话展开说说。` };
            // 先在 DB 创建空 session(只含 user msg),拿到 id 写入 state
            const session = await createChat({
                bookId,
                bookTitle,
                selection,
                cfi,
                messages: toStored([userMsg])
            });
            lastSavedRef.current = "";
            setState({
                isPanelOpen: true,
                showHistory: false,
                messages: [userMsg],
                bookId,
                bookTitle,
                chapterText,
                selection,
                cfi,
                currentChatId: session.id,
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

            const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
                { role: "system", content: buildSystemPrompt(sel, ch, state.bookTitle) },
                ...history.map((m) => ({ role: m.role, content: m.content }))
            ];
            await streamFromAPI(apiMessages);
        },
        [state.messages, state.selection, state.chapterText, state.bookTitle, streamFromAPI]
    );

    const loadChat = useCallback(async (chatId: string) => {
        const session = await getChat(chatId);
        if (!session) return;
        lastSavedRef.current = "";
        setState((s) => ({
            ...s,
            isPanelOpen: true,
            showHistory: false,
            messages: fromStored(session.messages),
            bookId: session.bookId,
            bookTitle: session.bookTitle,
            selection: session.selection,
            cfi: session.cfi,
            // chapterText: 历史 session 没存(避免重复),追问时只能基于已有对话
            chapterText: s.chapterText ?? "",
            currentChatId: session.id,
            isStreaming: false
        }));
    }, []);

    const listHistoryForCurrentBook = useCallback(async (): Promise<ChatSession[]> => {
        if (!state.bookId) return [];
        return listChatsForBook(state.bookId);
    }, [state.bookId]);

    const setShowHistory = useCallback((v: boolean) => setState((s) => ({ ...s, showHistory: v })), []);
    const close = useCallback(() => setState((s) => ({ ...s, isPanelOpen: false, showHistory: false })), []);
    const clear = useCallback(
        () =>
            setState((s) => ({ ...s, isPanelOpen: false, showHistory: false, messages: [], currentChatId: undefined })),
        []
    );

    return (
        <ChatContext.Provider
            value={{
                state,
                openWith,
                sendFollowUp,
                loadChat,
                listHistoryForCurrentBook,
                setShowHistory,
                close,
                clear,
                fontScale,
                setFontScale
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
