"use client";
import "../sakura.css";
import { useNotionSetting } from "../notion/useNotion";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useUserSettings } from "./useUserSettings";
import { TapZoneSettings } from "./TapZoneSettings";

const emptySubscribe = () => () => {};
const useReady = () => {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
};
export default function Page() {
    const ready = useReady();
    const { notionSetting, updateNotionSettings } = useNotionSetting();
    const { userSettings, updateUserSettings } = useUserSettings();
    if (!ready) {
        return <div className={"main"}></div>;
    }
    return (
        <div className={"main"}>
            <h1>Settings</h1>
            <div>
                <h2>Notion</h2>
                <div>
                    <label htmlFor="notion-api-key">Notion API Key:</label>
                    <input
                        id="notion-api-key"
                        type="password"
                        value={notionSetting?.apiKey}
                        style={{ width: "100%" }}
                        onChange={(e) => {
                            updateNotionSettings({
                                ...notionSetting,
                                apiKey: e.target.value
                            });
                        }}
                    />
                </div>
                <div>
                    <label htmlFor="notion-book-list-id">Book List Database Id:</label>
                    <input
                        id="notion-book-list-id"
                        type="text"
                        value={notionSetting?.bookListDatabaseId}
                        style={{ width: "100%" }}
                        onChange={(e) => {
                            updateNotionSettings({
                                ...notionSetting,
                                bookListDatabaseId: e.target.value
                            });
                        }}
                    />
                </div>
                <div>
                    <label htmlFor="notion-memo-id">Book Memo Database Id:</label>
                    <input
                        id="notion-memo-id"
                        type="text"
                        value={notionSetting?.bookMemoDatabaseId}
                        style={{ width: "100%" }}
                        onChange={(e) => {
                            updateNotionSettings({
                                ...notionSetting,
                                bookMemoDatabaseId: e.target.value
                            });
                        }}
                    />
                </div>
                <div>
                    <h2>Options</h2>
                    <div
                        style={{
                            display: "flex"
                        }}
                    >
                        <label htmlFor="open-new-tab">Open Book in New Tab</label>
                        <input
                            id="open-new-tab"
                            type="checkbox"
                            checked={userSettings?.openNewTab}
                            onChange={(e) => {
                                updateUserSettings({
                                    openNewTab: e.target.checked,
                                    uploadBookToNotion: userSettings?.uploadBookToNotion ?? false
                                });
                            }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex"
                        }}
                    >
                        <label htmlFor="upload-book-to-notion">Upload Book to Notion</label>
                        <input
                            id="upload-book-to-notion"
                            type="checkbox"
                            checked={userSettings?.uploadBookToNotion}
                            onChange={(e) => {
                                updateUserSettings({
                                    openNewTab: userSettings?.openNewTab ?? true,
                                    uploadBookToNotion: e.target.checked
                                });
                            }}
                        />
                    </div>
                </div>
                <div>
                    <h2>Viewer</h2>
                    <TapZoneSettings />
                </div>
                <div>
                    <h2>Tools</h2>
                    <ul>
                        <li>
                            <Link href={"/import"}>Import Highlights</Link> - Import highlights from Kindle or
                            O&apos;Reilly
                        </li>
                        <li>
                            <Link href={"/settings/clear-cache"}>Clear Cache</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
