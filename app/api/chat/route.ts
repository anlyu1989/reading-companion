/**
 * DeepSeek 流式代理
 * - server-only,读 DEEPSEEK_API_KEY (不带 NEXT_PUBLIC_)
 * - 把 DeepSeek 的 SSE chunk 解出 content delta,以纯文本流返给浏览器
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        return new Response("DEEPSEEK_API_KEY missing in .env.local", { status: 500 });
    }

    let body: { messages?: ChatMessage[] };
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
        return new Response("messages array required", { status: 400 });
    }

    const upstream = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages,
            stream: true,
            temperature: 0.7
        })
    });

    if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        return new Response(`DeepSeek upstream ${upstream.status}: ${errText.slice(0, 300)}`, {
            status: upstream.status
        });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() ?? "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data:")) continue;
                        const data = trimmed.slice(5).trim();
                        if (data === "[DONE]") continue;
                        try {
                            const json = JSON.parse(data);
                            const delta: string | undefined = json.choices?.[0]?.delta?.content;
                            if (delta) controller.enqueue(encoder.encode(delta));
                        } catch {
                            // ignore parse error on partial chunks
                        }
                    }
                }
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no"
        }
    });
}
