// @ts-check

import { beforeEach, describe, expect, it } from "vitest";

const { embed, embedBatched, setExtractor } = require("./localEmbeddings.cjs");

/** @type {string[][]} */
const extractorCalls = [];

beforeEach(() => {
	extractorCalls.length = 0;
	setExtractor(async (/** @type {string[]} */ batch) => {
		extractorCalls.push([...batch]);
		if (batch.includes("bad-shape")) {
			return { dims: [1, batch.length, 3], tolist: () => [] };
		}
		return {
			dims: [batch.length, 3],
			// Encode the input length so tests can verify ordering across
			// batches, plus an unrounded component for the rounding test
			tolist: () =>
				batch.map((text, i) => [text.length, i + 0.123456789, 0]),
		};
	});
});

describe("localEmbeddings", () => {
	it("returns an empty result for empty input without touching the pipeline", async () => {
		expect(await embed([])).toEqual([]);
		expect(extractorCalls.length).toBe(0);
	});

	it("embeds a single input as one 2D batch", async () => {
		const result = await embed(["ab"]);
		expect(result).toEqual([[2, 0.123456789, 0]]);
		expect(extractorCalls.pop()).toEqual(["ab"]);
	});

	it("splits input at the batch size and preserves input order", async () => {
		const inputs = Array.from(
			{ length: 33 },
			(_, i) => "x".repeat(i + 1),
		);
		const result = await embed(inputs);
		expect(result.length).toBe(33);
		// The first vector component is the input length
		expect(result.map((v) => v[0])).toEqual(
			inputs.map((text) => text.length),
		);
		expect(extractorCalls.splice(0).map((b) => b.length)).toEqual([
			32,
			1,
		]);
	});

	it("restores input order after length-sorted batching", async () => {
		const result = await embed(["xxx", "x", "xx"]);
		expect(result.map((v) => v[0])).toEqual([3, 1, 2]);
		expect(extractorCalls.pop()).toEqual(["x", "xx", "xxx"]);
	});

	it("rejects unexpected tensor shapes instead of guessing", async () => {
		await expect(embed(["bad-shape"])).rejects.toThrow(
			/Unexpected embedding tensor shape/,
		);
	});

	it("rounds index embeddings to 5 decimals", async () => {
		const [vector] = await embedBatched(["ab"]);
		expect(vector).toEqual([2, 0.12346, 0]);
	});
});
