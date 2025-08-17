"use client";
import "../sakura.css";
import { useCallback, useMemo, useState } from "react";
import { KindlePositionMarker, useNotion } from "../notion/useNotion";

type ImportBookMemo = {
    fileId: string;
    fileName: string;
    title: string;
    currentPage?: number;
    totalPage?: number;
    publisher?: string;
    authors: string[];
    memos: {
        memo: string;
        currentPage?: number;
        marker?: KindlePositionMarker;
    }[];
};
const useImport = () => {
    // fileId is random short id
    const [importJSONText, setImportJSONText] = useState<string>("");
    const importJSON = useMemo<ImportBookMemo | null>(() => {
        try {
            return JSON.parse(importJSONText);
        } catch (e) {
            return null;
        }
    }, [importJSONText]);
    const isValidJSON = useMemo(() => {
        return importJSON != null;
    }, [importJSON]);
    // notion client
    const { addMemo, updateBookStatus } = useNotion({
        fileId: importJSON?.fileId,
        fileName: importJSON?.fileName
    });
    const importBook = useCallback(async () => {
        if (!importJSON) {
            return;
        }
        await updateBookStatus({
            viewer: "kindle",
            fileId: importJSON.fileId,
            fileName: importJSON?.fileName,
            title: importJSON?.title,
            currentPage: importJSON?.currentPage ?? 0,
            totalPage: importJSON?.totalPage ?? 0,
            publisher: importJSON?.publisher,
            authors: importJSON?.authors
        });
        // add memo
        for (const memo of importJSON?.memos ?? []) {
            await addMemo({
                memo: memo.memo,
                currentPage: memo.currentPage ?? 0,
                marker: memo.marker ?? { locationNumber: 0 }
            });
        }
    }, [addMemo, importJSON, updateBookStatus]);
    return {
        importBook,
        importJSON,
        importJSONText,
        setImportJSONText,
        isValidJSON
    } as const;
};
const ImportPage = () => {
    const { importBook, importJSONText, setImportJSONText, isValidJSON } = useImport();
    const [isImporting, setIsImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);

    const handleImport = async () => {
        setIsImporting(true);
        setImportSuccess(false);
        try {
            await importBook();
            setImportSuccess(true);
            setImportJSONText("");
        } catch (error) {
            console.error("Import failed:", error);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className={"main"}>
            <h1>Import Highlights</h1>
            <p>このページでは、KindleやO&apos;Reilly Learningからハイライトをインポートできます。</p>

            <h2>使い方</h2>
            <details open>
                <summary>
                    <strong>Kindle からインポート</strong>
                </summary>
                <ol>
                    <li>
                        <a href="https://read.amazon.co.jp/notebook" target="_blank" rel="noopener noreferrer">
                            Kindle ノートブック
                        </a>
                        を開く
                    </li>
                    <li>インポートしたい本を選択</li>
                    <li>ブラウザの開発者コンソールを開く（F12 または Cmd+Option+I）</li>
                    <li>
                        <a
                            href="https://github.com/azu/mubook-hon/blob/main/app/import/README.md#kindle"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            README
                        </a>
                        にあるコードをコンソールに貼り付けて実行
                    </li>
                    <li>出力されたJSONをコピーして下のテキストエリアに貼り付け</li>
                    <li>「Import」ボタンをクリック</li>
                </ol>
            </details>

            <details>
                <summary>
                    <strong>O&apos;Reilly Learning からインポート</strong>
                </summary>
                <ol>
                    <li>
                        <a href="https://learning.oreilly.com/highlights" target="_blank" rel="noopener noreferrer">
                            O&apos;Reilly Highlights
                        </a>
                        を開く
                    </li>
                    <li>ブラウザの開発者コンソールを開く（F12 または Cmd+Option+I）</li>
                    <li>
                        <a
                            href="https://github.com/azu/mubook-hon/blob/main/app/import/README.md#learning-oreilly"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            README
                        </a>
                        にあるコードをコンソールに貼り付けて実行
                    </li>
                    <li>出力されたJSONをコピーして下のテキストエリアに貼り付け</li>
                    <li>「Import」ボタンをクリック</li>
                </ol>
            </details>

            <h2>インポート</h2>
            <p>JSONデータを貼り付けてください：</p>
            <textarea
                value={importJSONText}
                onChange={(event) => setImportJSONText(event.target.value)}
                placeholder='{"fileId": "...", "fileName": "...", "title": "...", "authors": [...], "memos": [...]}'
                style={{ width: "100%", minHeight: "200px", fontFamily: "monospace" }}
            />

            <div style={{ marginTop: "1rem" }}>
                <button disabled={!isValidJSON || isImporting} onClick={handleImport} style={{ marginRight: "1rem" }}>
                    {isImporting ? "インポート中..." : "Import"}
                </button>

                {!isValidJSON && importJSONText && <span style={{ color: "red" }}>❌ 無効なJSON形式です</span>}
                {isValidJSON && !importSuccess && <span style={{ color: "green" }}>✅ 有効なJSON形式です</span>}
                {importSuccess && <span style={{ color: "green" }}>✅ インポートが完了しました！</span>}
            </div>

            <details style={{ marginTop: "2rem" }}>
                <summary>JSONフォーマットの例</summary>
                <pre style={{ backgroundColor: "#f5f5f5", padding: "1rem", overflow: "auto" }}>
                    {`{
  "fileId": "B0BXXXXXX",
  "fileName": "サンプル本",
  "title": "サンプル本のタイトル",
  "currentPage": 0,
  "totalPage": 300,
  "publisher": "出版社名",
  "authors": ["著者名"],
  "memos": [
    {
      "memo": "ハイライトテキスト",
      "currentPage": 42,
      "marker": {
        "locationNumber": 1234
      }
    }
  ]
}`}
                </pre>
            </details>
        </div>
    );
};
export default ImportPage;
