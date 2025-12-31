"use client";
import { useEffect, useState } from "react";
import { clearIndexedDBCache } from "../../lib/clearIndexedDBCache";

export default function Page() {
    const [isClearing, setIsClearing] = useState(true);
    useEffect(() => {
        async function main() {
            try {
                await clearIndexedDBCache();
            } catch (error: unknown) {
                console.error(error);
                alert(error instanceof Error ? error.message : String(error));
            } finally {
                setIsClearing(false);
            }
        }

        main();
    }, []);
    return <div className={"main"}>{isClearing ? "Clearing..." : "Cleared"}</div>;
}
