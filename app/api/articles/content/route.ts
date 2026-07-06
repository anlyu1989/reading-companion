import { NextResponse } from "next/server";

export const runtime = "nodejs";

const decodeEntities = (text: string) =>
    text
        .replace(/&nbsp;/g, " ")
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
        if (match?.[1]) return decodeEntities(stripTags(match[1]));
    }
    return undefined;
};

const cleanHtml = (html: string) =>
    html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/<form[\s\S]*?<\/form>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "")
        .replace(/\s(?:class|id|style|onclick|data-[a-z0-9-]+)=["'][^"']*["']/gi, "");

const pickMainHtml = (html: string) => {
    const candidates = [
        html.match(/<article[^>]+class=["'][^"']*ltx_document[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1],
        html.match(/<div[^>]+class=["'][^"']*ltx_document[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1],
        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1],
        html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ].filter(Boolean) as string[];
    return candidates.sort((a, b) => stripTags(b).length - stripTags(a).length)[0] ?? html;
};

const normalizeReadableHtml = (html: string) => {
    const readable = cleanHtml(pickMainHtml(html))
        .replace(/<h1[^>]*>/gi, "<h2>")
        .replace(/<\/h1>/gi, "</h2>")
        .replace(/<h[3-6][^>]*>/gi, "<h3>")
        .replace(/<\/h[3-6]>/gi, "</h3>")
        .replace(/<(p|h2|h3|blockquote|li|ul|ol|pre|code|strong|em|a|br)\b[^>]*>/gi, (tag) => tag)
        .replace(/<(?!\/?(?:p|h2|h3|blockquote|li|ul|ol|pre|code|strong|em|a|br)\b)[^>]+>/gi, " ")
        .replace(/<a\b([^>]*)>/gi, (_tag, attrs: string) => {
            const href = String(attrs).match(/href=["']([^"']+)["']/i)?.[1];
            return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : "<a>";
        })
        .replace(/\s+/g, " ")
        .replace(/<\/(p|h2|h3|blockquote|li|ul|ol|pre)>/g, "</$1>\n");
    return readable.trim();
};

const fetchHtml = async (url: string) => {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "ReadingCompanion/0.1 (+local article reader)",
            Accept: "text/html,application/xhtml+xml"
        },
        next: { revalidate: 60 * 60 }
    });
    if (!res.ok) return null;
    return res.text();
};

const extractArxivHtml = (html: string) => {
    const title = firstMatch(html, [
        /<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>[\s\S]*?<span[^>]*>Title:<\/span>([\s\S]*?)<\/h1>/i
    ]);
    const authors = firstMatch(html, [/<div[^>]*class=["'][^"']*authors[^"']*["'][^>]*>([\s\S]*?)<\/div>/i]);
    const abstract = firstMatch(html, [
        /<blockquote[^>]*class=["'][^"']*abstract[^"']*["'][^>]*>[\s\S]*?<span[^>]*>Abstract:<\/span>([\s\S]*?)<\/blockquote>/i
    ]);
    if (!abstract) return null;
    const parts = [
        title ? `<h2>${title}</h2>` : "",
        authors ? `<p><strong>Authors:</strong> ${authors.replace(/^Authors:\s*/i, "")}</p>` : "",
        `<blockquote><strong>Abstract:</strong> ${abstract}</blockquote>`
    ];
    return {
        title,
        byline: authors?.replace(/^Authors:\s*/i, ""),
        content: parts.join("\n"),
        textContent: stripTags(parts.join(" "))
    };
};

const arxivHtmlUrl = (url: URL) => {
    const match = url.pathname.match(/^\/abs\/(\d{4}\.\d+)(v\d+)?/);
    if (!match) return null;
    return `https://arxiv.org/html/${match[1]}${match[2] ?? ""}`;
};

const extractArxivFullText = async (url: URL) => {
    const htmlUrl = arxivHtmlUrl(url);
    if (!htmlUrl) return null;
    const html = await fetchHtml(htmlUrl);
    if (!html) return null;
    const title =
        firstMatch(html, [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<title[^>]*>([\s\S]*?)<\/title>/i
        ]) ?? "arXiv article";
    const byline = firstMatch(html, [
        /<meta[^>]+name=["']citation_author["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<div[^>]+class=["'][^"']*ltx_authors[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    ]);
    const content = normalizeReadableHtml(html);
    const textContent = stripTags(content);
    if (textContent.length < 2500) return null;
    return {
        title,
        byline,
        content,
        textContent
    };
};

export async function POST(req: Request) {
    let body: { url?: string };
    try {
        body = await req.json();
    } catch {
        return new NextResponse("Invalid JSON body", { status: 400 });
    }
    const url = body.url;
    if (!url) return new NextResponse("Missing url", { status: 400 });
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return new NextResponse("Invalid url", { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return new NextResponse("Only http(s) urls are supported", { status: 400 });
    }

    if (parsed.hostname === "arxiv.org") {
        const fullText = await extractArxivFullText(parsed);
        if (fullText) return NextResponse.json(fullText);
    }

    const html = await fetchHtml(parsed.toString());
    if (!html) return new NextResponse("Source returned an error", { status: 502 });
    if (parsed.hostname === "arxiv.org") {
        const arxiv = extractArxivHtml(html);
        if (arxiv) return NextResponse.json(arxiv);
    }
    const title =
        firstMatch(html, [
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
            /<title[^>]*>([\s\S]*?)<\/title>/i
        ]) ?? parsed.hostname;
    const byline = firstMatch(html, [
        /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i,
        /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ]);
    const content = normalizeReadableHtml(html);
    const textContent = stripTags(content);

    return NextResponse.json({
        title,
        byline,
        content,
        textContent
    });
}
