import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

type FeedItem = {
    id: string;
    title: string;
    url: string;
    source: string;
    excerpt?: string;
    author?: string;
    publishedAt?: number;
    attention?: number;
    attentionLabel?: string;
    score?: number;
    reason?: string;
    category?: string;
};

type RankedArticle = {
    id: string;
    score: number;
    reason: string;
    category: string;
};

const AI_KEYWORDS = [
    "ai",
    "artificial intelligence",
    "llm",
    "large language model",
    "openai",
    "anthropic",
    "deepmind",
    "machine learning",
    "generative"
];

const hashUrl = (url: string) => crypto.createHash("sha256").update(url).digest("hex").slice(0, 24);

const decodeEntities = (text: string) =>
    text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

const stripTags = (html: string) =>
    decodeEntities(html)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const firstMatch = (text: string, patterns: RegExp[]) => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return decodeEntities(match[1].trim());
    }
    return undefined;
};

const fetchText = async (url: string) => {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "ReadingCompanion/0.1 (+local AI reading inbox)",
            Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json"
        },
        next: { revalidate: 60 * 30 }
    });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return res.text();
};

const parseDate = (value?: string) => {
    if (!value) return undefined;
    const time = Date.parse(stripTags(value));
    return Number.isFinite(time) ? time : undefined;
};

const parseRss = (xml: string, source: string): FeedItem[] => {
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];
    return itemBlocks
        .map((block) => {
            const title = firstMatch(block, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
            const rawLink =
                firstMatch(block, [/<link[^>]*>([\s\S]*?)<\/link>/i]) ??
                firstMatch(block, [/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i]);
            const url = rawLink?.trim();
            if (!title || !url) return null;
            const excerpt = stripTags(
                firstMatch(block, [
                    /<description[^>]*>([\s\S]*?)<\/description>/i,
                    /<summary[^>]*>([\s\S]*?)<\/summary>/i,
                    /<content[^>]*>([\s\S]*?)<\/content>/i
                ]) ?? ""
            ).slice(0, 360);
            const author = firstMatch(block, [
                /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i,
                /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i,
                /<author[^>]*>([\s\S]*?)<\/author>/i
            ]);
            const publishedAt = parseDate(
                firstMatch(block, [
                    /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
                    /<published[^>]*>([\s\S]*?)<\/published>/i,
                    /<updated[^>]*>([\s\S]*?)<\/updated>/i
                ])
            );
            return {
                id: hashUrl(url),
                title: stripTags(title),
                url,
                source,
                excerpt,
                author: author ? stripTags(author) : undefined,
                publishedAt
            };
        })
        .filter(Boolean) as FeedItem[];
};

const fetchRss = async (source: string, url: string) => parseRss(await fetchText(url), source);

const fetchHackerNews = async (): Promise<FeedItem[]> => {
    const res = await fetch(
        "https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20OpenAI&tags=story&hitsPerPage=30",
        { next: { revalidate: 60 * 20 } }
    );
    if (!res.ok) throw new Error(`HN returned ${res.status}`);
    const data = (await res.json()) as {
        hits?: {
            title?: string;
            story_title?: string;
            url?: string;
            story_url?: string;
            author?: string;
            created_at_i?: number;
            points?: number;
            num_comments?: number;
        }[];
    };
    return (data.hits ?? [])
        .map((hit) => {
            const title = hit.title || hit.story_title;
            const url = hit.url || hit.story_url;
            if (!title || !url) return null;
            const points = hit.points ?? 0;
            const comments = hit.num_comments ?? 0;
            return {
                id: hashUrl(url),
                title,
                url,
                source: "Hacker News",
                excerpt: `HN points: ${points}; comments: ${comments}`,
                author: hit.author,
                attention: points + comments * 2,
                attentionLabel: `${points} HN points, ${comments} comments`,
                publishedAt: hit.created_at_i ? hit.created_at_i * 1000 : undefined
            };
        })
        .filter(Boolean) as FeedItem[];
};

const isLikelyAI = (item: FeedItem) => {
    const haystack = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
    return AI_KEYWORDS.some((keyword) => haystack.includes(keyword));
};

const isFreshEnough = (item: FeedItem) => {
    if (!item.publishedAt) return true;
    const ageDays = (Date.now() - item.publishedAt) / (24 * 60 * 60 * 1000);
    return ageDays <= 120;
};

const heuristicScore = (item: FeedItem) => {
    const text = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
    let score = 45;
    if (item.source === "OpenAI Blog" || item.source === "Google DeepMind" || item.source === "Anthropic News") {
        score += 26;
    }
    if (item.source === "Hacker News") score += 12 + Math.min(18, Math.round((item.attention ?? 0) / 25));
    if (text.includes("llm") || text.includes("large language model")) score += 14;
    if (text.includes("agent") || text.includes("agentic")) score += 10;
    if (text.includes("learning") || text.includes("education") || text.includes("cognitive")) score += 10;
    if (text.includes("product") || text.includes("launch") || text.includes("model")) score += 8;
    const ageDays = item.publishedAt ? (Date.now() - item.publishedAt) / (24 * 60 * 60 * 1000) : 7;
    if (ageDays <= 2) score += 8;
    else if (ageDays > 14) score -= 8;
    return Math.max(0, Math.min(100, Math.round(score)));
};

const heuristicCategory = (item: FeedItem) => {
    const text = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
    if (text.includes("learning") || text.includes("education") || text.includes("cognitive"))
        return "Cognition/Learning";
    if (text.includes("product") || text.includes("launch") || text.includes("pricing")) return "LLM Product";
    if (text.includes("agent") || text.includes("model") || text.includes("llm")) return "AI Frontier";
    return "AI Research";
};

const rankWithHeuristics = (items: FeedItem[], reasonPrefix = "Heuristic fallback") =>
    items
        .map((item) => ({
            ...item,
            score: item.score ?? heuristicScore(item),
            category: item.category ?? heuristicCategory(item),
            reason: item.reason ?? `${reasonPrefix}: related to ${heuristicCategory(item)}.`
        }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

const sourceQuota = (source: string) => {
    if (source === "OpenAI Blog" || source === "Google DeepMind" || source === "Anthropic News") return 6;
    if (source === "Hacker News") return 8;
    return 5;
};

const buildMixedCandidatePool = (items: FeedItem[]) => {
    const bySource = new Map<string, FeedItem[]>();
    for (const item of rankWithHeuristics(items)) {
        const sourceItems = bySource.get(item.source) ?? [];
        sourceItems.push(item);
        bySource.set(item.source, sourceItems);
    }
    const mixed = Array.from(bySource.entries()).flatMap(([source, sourceItems]) =>
        sourceItems.slice(0, sourceQuota(source))
    );
    return Array.from(new Map(mixed.map((item) => [item.url, item])).values())
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.attention ?? 0) - (a.attention ?? 0))
        .slice(0, 32);
};

const SYSTEM_PROMPT = `你是一个英文 AI 阅读材料主编,为一位托福阅读老师/国际学科化学老师筛选每日 AI 英文精读文章。

目标: 从候选文章中选出最值得读的 5-8 篇。

评分权重:
1. 最高权重: 是否代表近期 AI 最新发展、LLM 产品/生态、认知/学习/教育相关洞察。
2. 是否热门、受关注、可能影响行业讨论。
3. 来源权威性: OpenAI/DeepMind/Anthropic/主流技术社区/高质量研究优先。
4. 是否适合英文精读: 标题和摘要信息密度高,有概念解释、观点冲突、长难句价值。
5. 过滤掉过时文章、过窄、过工程细节、纯 benchmark 噪音、和教学/学习/产品趋势关系弱的论文。

返回严格 JSON,不要 markdown:
{"items":[{"id":"候选id","score":0-100,"category":"AI Frontier|LLM Product|Cognition/Learning|AI Research|Industry Signal","reason":"中文,20-45字,说明为什么值得读"}]}`;

const rankWithDeepSeek = async (items: FeedItem[]): Promise<FeedItem[]> => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return rankWithHeuristics(items, "No AI ranking key").slice(0, 8);

    const candidates = rankWithHeuristics(items)
        .slice(0, 24)
        .map((item, index) => ({
            n: index + 1,
            id: item.id,
            title: item.title,
            source: item.source,
            excerpt: item.excerpt?.slice(0, 420),
            author: item.author,
            publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : undefined,
            attention: item.attention,
            attentionLabel: item.attentionLabel,
            heuristicScore: item.score
        }));

    const upstream = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify({ candidates }) }
            ],
            response_format: { type: "json_object" },
            stream: false,
            temperature: 0.2
        })
    });
    if (!upstream.ok) throw new Error(`DeepSeek ranking ${upstream.status}`);
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { items?: RankedArticle[] };
    const ranked = Array.isArray(parsed.items) ? parsed.items : [];
    const byId = new Map(items.map((item) => [item.id, item]));
    const selected = ranked
        .map((rank) => {
            const item = byId.get(rank.id);
            if (!item) return null;
            return {
                ...item,
                score: Math.max(0, Math.min(100, Math.round(Number(rank.score) || heuristicScore(item)))),
                reason: String(rank.reason || "").slice(0, 120),
                category: String(rank.category || heuristicCategory(item)).slice(0, 40)
            };
        })
        .filter(Boolean) as FeedItem[];
    if (selected.length === 0) return rankWithHeuristics(items, "AI ranking returned empty").slice(0, 8);
    return selected.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8);
};

export async function POST() {
    const sources: Promise<FeedItem[]>[] = [
        fetchHackerNews(),
        fetchRss("arXiv cs.AI", "https://rss.arxiv.org/rss/cs.AI"),
        fetchRss("arXiv cs.CL", "https://rss.arxiv.org/rss/cs.CL"),
        fetchRss("arXiv cs.LG", "https://rss.arxiv.org/rss/cs.LG"),
        fetchRss("OpenAI Blog", "https://openai.com/news/rss.xml"),
        fetchRss("Anthropic News", "https://www.anthropic.com/news/rss.xml"),
        fetchRss("Google DeepMind", "https://deepmind.google/blog/rss.xml")
    ];

    const settled = await Promise.allSettled(sources);
    const items = settled
        .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
        .filter((item) => item.title.length > 0 && item.url.startsWith("http"))
        .filter(isFreshEnough)
        .filter((item) => item.source.startsWith("arXiv") || isLikelyAI(item));
    const unique = Array.from(new Map(items.map((item) => [item.url, item])).values()).sort(
        (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
    );
    const candidatePool = buildMixedCandidatePool(unique);
    let ranked: FeedItem[];
    let rankingMode: "deepseek" | "heuristic" = "deepseek";
    let rankingError: string | undefined;
    try {
        ranked = await rankWithDeepSeek(candidatePool);
    } catch (e) {
        rankingMode = "heuristic";
        rankingError = e instanceof Error ? e.message : String(e);
        ranked = rankWithHeuristics(candidatePool, "AI ranking failed").slice(0, 8);
    }

    return NextResponse.json({
        fetchedAt: Date.now(),
        items: ranked,
        candidateCount: unique.length,
        rankedCandidateCount: candidatePool.length,
        rankingMode,
        rankingError,
        sourceErrors: settled
            .map((result, index) => (result.status === "rejected" ? { index, error: String(result.reason) } : null))
            .filter(Boolean)
    });
}
