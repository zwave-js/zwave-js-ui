// @ts-check

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	DOCS_INDEX_VERSION,
	isValidChunk,
	loadDocsIndex,
	cosineSimilarity,
	retrieve,
} from "./docsIndex.cjs";

function validChunk(overrides = {}) {
	return {
		file: "docs/getting-started.md",
		anchor: "#install",
		title: "Install",
		breadcrumbs: ["Getting started", "Install"],
		text: "Run npm install to get started.",
		embedding: [1, 0, 0],
		...overrides,
	};
}

describe("docsIndex", () => {
	describe("isValidChunk", () => {
		it("accepts a well-formed chunk", () => {
			expect(isValidChunk(validChunk())).toBe(true);
		});

		it("rejects non-objects", () => {
			expect(isValidChunk(null)).toBe(false);
			expect(isValidChunk(undefined)).toBe(false);
			expect(isValidChunk("chunk")).toBe(false);
			expect(isValidChunk(42)).toBe(false);
		});

		it("rejects a chunk missing required string fields", () => {
			expect(isValidChunk(validChunk({ file: undefined }))).toBe(false);
			expect(isValidChunk(validChunk({ anchor: 5 }))).toBe(false);
			expect(isValidChunk(validChunk({ title: null }))).toBe(false);
			expect(isValidChunk(validChunk({ text: 123 }))).toBe(false);
		});

		it("rejects a chunk whose breadcrumbs are not a string array", () => {
			expect(isValidChunk(validChunk({ breadcrumbs: "not an array" })))
				.toBe(false);
			expect(isValidChunk(validChunk({ breadcrumbs: [1, 2] }))).toBe(
				false,
			);
		});

		it("rejects a chunk whose embedding is not an array", () => {
			expect(isValidChunk(validChunk({ embedding: "not an array" })))
				.toBe(false);
			expect(isValidChunk(validChunk({ embedding: undefined }))).toBe(
				false,
			);
		});

		it("rejects an empty, non-numeric, or zero embedding", () => {
			expect(isValidChunk(validChunk({ embedding: [] }))).toBe(false);
			expect(isValidChunk(validChunk({ embedding: [1, "bad", 0] })))
				.toBe(false);
			expect(isValidChunk(validChunk({ embedding: [1, Number.NaN, 0] })))
				.toBe(false);
			expect(isValidChunk(validChunk({ embedding: [0, 0, 0] }))).toBe(
				false,
			);
		});
	});

	describe("loadDocsIndex", () => {
		/** @type {string} */
		let dir;

		beforeEach(async () => {
			dir = await mkdtemp(path.join(tmpdir(), "docs-index-test-"));
		});

		afterEach(async () => {
			await rm(dir, { recursive: true, force: true });
		});

		it("returns undefined when given no path", async () => {
			expect(await loadDocsIndex(undefined)).toBeUndefined();
		});

		it("returns undefined when the file does not exist", async () => {
			expect(await loadDocsIndex(path.join(dir, "missing.json")))
				.toBeUndefined();
		});

		it("returns undefined for invalid JSON", async () => {
			const file = path.join(dir, "index.json");
			await writeFile(file, "{ not json");
			expect(await loadDocsIndex(file)).toBeUndefined();
		});

		it("returns undefined for a mismatched version", async () => {
			const file = path.join(dir, "index.json");
			await writeFile(
				file,
				JSON.stringify({
					version: DOCS_INDEX_VERSION + 1,
					model: "some-model",
					chunks: [validChunk()],
				}),
			);
			expect(await loadDocsIndex(file)).toBeUndefined();
		});

		it("returns undefined when model is missing or not a string", async () => {
			const file = path.join(dir, "index.json");
			await writeFile(
				file,
				JSON.stringify({
					version: DOCS_INDEX_VERSION,
					chunks: [validChunk()],
				}),
			);
			expect(await loadDocsIndex(file)).toBeUndefined();
		});

		it("returns undefined when chunks is missing or contains an invalid chunk", async () => {
			const file = path.join(dir, "index.json");
			await writeFile(
				file,
				JSON.stringify({
					version: DOCS_INDEX_VERSION,
					model: "some-model",
					chunks: [validChunk(), { file: "only-a-file" }],
				}),
			);
			expect(await loadDocsIndex(file)).toBeUndefined();
		});

		it("returns undefined when embedding dimensions are inconsistent", async () => {
			const file = path.join(dir, "index.json");
			await writeFile(
				file,
				JSON.stringify({
					version: DOCS_INDEX_VERSION,
					model: "some-model",
					chunks: [
						validChunk(),
						validChunk({ embedding: [1, 0] }),
					],
				}),
			);
			expect(await loadDocsIndex(file)).toBeUndefined();
		});

		it("returns the parsed index when it is well-formed", async () => {
			const file = path.join(dir, "index.json");
			const index = {
				version: DOCS_INDEX_VERSION,
				model: "some-model",
				createdAt: "2024-01-01T00:00:00.000Z",
				chunks: [validChunk()],
			};
			await writeFile(file, JSON.stringify(index));
			expect(await loadDocsIndex(file)).toEqual(index);
		});
	});

	describe("cosineSimilarity", () => {
		it("returns 1 for identical vectors", () => {
			expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
		});

		it("returns 0 for orthogonal vectors", () => {
			expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
		});

		it("returns -1 for opposite vectors", () => {
			expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
		});
	});

	describe("retrieve", () => {
		it("ranks the chunk closest to the query embedding first", () => {
			const index = {
				chunks: [
					validChunk({
						title: "Unrelated",
						text: "Something about cats",
						breadcrumbs: ["Unrelated"],
						embedding: [0, 1, 0],
					}),
					validChunk({
						title: "Install",
						text: "Run npm install to get started",
						breadcrumbs: ["Install"],
						embedding: [1, 0, 0],
					}),
				],
			};
			const { results, bestSimilarity } = retrieve(
				index,
				[1, 0, 0],
				"how do I install this",
				1,
			);
			expect(results).toHaveLength(1);
			expect(results[0].chunk.title).toBe("Install");
			expect(bestSimilarity).toBeCloseTo(1);
		});

		it("returns no results for an empty index", () => {
			const { results, bestSimilarity } = retrieve(
				{ chunks: [] },
				[1, 0, 0],
				"anything",
				5,
			);
			expect(results).toEqual([]);
			expect(bestSimilarity).toBe(0);
		});
	});
});
