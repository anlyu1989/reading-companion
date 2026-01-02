/**
 * EPUBから全文テキストを抽出するユーティリティ
 */

type Section = {
    id: string;
    linear?: string;
    createDocument: () => Promise<Document>;
};

type ExtractOptions = {
    concurrency?: number;
    onProgress?: (current: number, total: number) => void;
};

/**
 * EPUBの全セクションからテキストを抽出
 * - 並列処理で効率的に抽出
 * - linearでないセクション（目次など）はスキップ
 */
export const extractFullText = async (sections: Section[] | undefined, options?: ExtractOptions): Promise<string> => {
    if (!sections?.length) return "";

    const concurrency = options?.concurrency ?? 5;
    const linearSections = sections.filter((s) => s.linear !== "no");
    const total = linearSections.length;
    let completed = 0;

    const results: string[] = [];

    // チャンク単位で並列処理
    for (let i = 0; i < linearSections.length; i += concurrency) {
        const chunk = linearSections.slice(i, i + concurrency);
        const chunkResults = await Promise.all(
            chunk.map(async (section) => {
                try {
                    const doc = await section.createDocument();
                    // body全体のテキストを取得し、余分な空白を正規化
                    const text = doc?.body?.textContent?.trim() ?? "";
                    return normalizeText(text);
                } catch (e) {
                    console.warn(`Failed to extract text from section: ${section.id}`, e);
                    return "";
                } finally {
                    completed++;
                    options?.onProgress?.(completed, total);
                }
            })
        );
        results.push(...chunkResults);
    }

    return results.filter(Boolean).join("\n\n");
};

/**
 * テキストを正規化
 * - 連続する空白を1つに
 * - 連続する改行を2つに制限
 */
const normalizeText = (text: string): string => {
    return text
        .replace(/[ \t]+/g, " ") // 連続するスペース・タブを1つに
        .replace(/\n{3,}/g, "\n\n") // 3つ以上の改行を2つに
        .trim();
};

/**
 * テキストをBlobとして取得（アップロード用）
 */
export const createTextBlob = (text: string, fileName: string): { blob: Blob; fileName: string } => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const txtFileName = fileName.replace(/\.[^.]+$/, ".txt");
    return { blob, fileName: txtFileName };
};
