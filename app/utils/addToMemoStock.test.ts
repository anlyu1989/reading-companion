import { describe, it } from "node:test";
import { addToMemoStock, MemoStockItem } from "./addToMemoStock";
import assert from "node:assert/strict";

describe("addToMemoStock", () => {
    it("should add a selected item to empty stock", () => {
        const currentStock: MemoStockItem[] = [];
        const selected: MemoStockItem = {
            text: "Hello World",
            selectors: { start: "cfi-start", end: "cfi-end" }
        };

        const result = addToMemoStock(currentStock, selected);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].text, "Hello World");
    });

    it("should add a selected item to existing stock", () => {
        const currentStock: MemoStockItem[] = [{ text: "First", selectors: { start: "a", end: "b" } }];
        const selected: MemoStockItem = {
            text: "Second",
            selectors: { start: "c", end: "d" }
        };

        const result = addToMemoStock(currentStock, selected);

        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].text, "First");
        assert.strictEqual(result[1].text, "Second");
    });

    it("should return unchanged stock when selected is null", () => {
        const currentStock: MemoStockItem[] = [{ text: "Existing", selectors: { start: "a", end: "b" } }];

        const result = addToMemoStock(currentStock, null);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result, currentStock);
    });

    it("should return unchanged stock when selected is undefined", () => {
        const currentStock: MemoStockItem[] = [{ text: "Existing", selectors: { start: "a", end: "b" } }];

        const result = addToMemoStock(currentStock, undefined);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result, currentStock);
    });

    it("should return unchanged stock when selected.text is empty string", () => {
        const currentStock: MemoStockItem[] = [{ text: "Existing", selectors: { start: "a", end: "b" } }];
        const selected: MemoStockItem = {
            text: "",
            selectors: { start: "c", end: "d" }
        };

        const result = addToMemoStock(currentStock, selected);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result, currentStock);
    });

    it("should not mutate the original stock", () => {
        const currentStock: MemoStockItem[] = [{ text: "Original", selectors: { start: "a", end: "b" } }];
        const selected: MemoStockItem = {
            text: "New",
            selectors: { start: "c", end: "d" }
        };

        const result = addToMemoStock(currentStock, selected);

        assert.strictEqual(currentStock.length, 1);
        assert.strictEqual(result.length, 2);
        assert.notStrictEqual(result, currentStock);
    });

    it("should handle multiple additions", () => {
        let stock: MemoStockItem[] = [];

        stock = addToMemoStock(stock, { text: "First", selectors: { start: "a", end: "b" } });
        stock = addToMemoStock(stock, { text: "Second", selectors: { start: "c", end: "d" } });
        stock = addToMemoStock(stock, { text: "Third", selectors: { start: "e", end: "f" } });

        assert.strictEqual(stock.length, 3);
        assert.strictEqual(stock[0].text, "First");
        assert.strictEqual(stock[1].text, "Second");
        assert.strictEqual(stock[2].text, "Third");
    });
});
