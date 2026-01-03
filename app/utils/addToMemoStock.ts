export type MemoStockItem = {
    text: string;
    selectors: { start?: string; end?: string };
};

/**
 * Add a selected text to the memo stock
 * @param currentStock - Current memo stock array
 * @param selected - Selected text item to add
 * @returns New memo stock array with the selected item added, or unchanged if selected is invalid
 */
export function addToMemoStock(
    currentStock: MemoStockItem[],
    selected: MemoStockItem | null | undefined
): MemoStockItem[] {
    if (!selected?.text) return currentStock;
    return [...currentStock, selected];
}
