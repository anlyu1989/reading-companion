/**
 * 词性 + 词义查询 — 非流式,JSON 返回
 * - server-only,读 DEEPSEEK_API_KEY
 * - 调 DeepSeek with response_format: json_object 强制 JSON
 */

type DictResult = { pos: string; definitions: string[] };

const SYSTEM_PROMPT = `你是简明英汉/汉英词典。用户输入一个英文或中文词/短语,你返回严格 JSON(不要 markdown 围栏)。

格式:
{"pos": "n.|v.|adj.|adv.|prep.|conj.|phrase|... 多个用 & 拼接如 'n. & v.'", "definitions": ["释义1", "释义2(如有)"]}

要求:
- 英文词 → 中文释义;中文词 → 英文释义
- 简洁:每条释义 4-15 字
- 最多 3 条释义,优先核心义
- 短语/词组用 phrase 作为词性
- 识别不出来时 pos="?", definitions=["未识别"]`;

export async function POST(req: Request) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return new Response("DEEPSEEK_API_KEY missing", { status: 500 });

    let body: { word?: string };
    try {
        body = await req.json();
    } catch {
        return new Response("Invalid JSON body", { status: 400 });
    }
    const word = body.word?.trim();
    if (!word) return new Response("word required", { status: 400 });
    if (word.length > 80) return new Response("word too long", { status: 400 });

    let upstream: Response;
    try {
        upstream = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: word }
                ],
                response_format: { type: "json_object" },
                stream: false,
                temperature: 0.3
            })
        });
    } catch (e) {
        return new Response(`Upstream fetch failed: ${(e as Error).message}`, { status: 502 });
    }

    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        return new Response(`Upstream ${upstream.status}: ${errText.slice(0, 200)}`, { status: upstream.status });
    }

    const data = await upstream.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: DictResult;
    try {
        const raw = JSON.parse(content) as Partial<DictResult>;
        parsed = {
            pos: typeof raw.pos === "string" ? raw.pos : "?",
            definitions: Array.isArray(raw.definitions) ? raw.definitions.slice(0, 3).map(String) : ["解析失败"]
        };
    } catch {
        parsed = { pos: "?", definitions: ["解析失败"] };
    }

    return Response.json(parsed);
}
