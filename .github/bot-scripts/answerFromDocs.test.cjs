// @ts-check

import { describe, it, expect } from "vitest";
import {
	validateJudgeResponse,
	checkSuppression,
} from "./answerFromDocs.cjs";

describe("answerFromDocs", () => {
	describe("validateJudgeResponse", () => {
		it("accepts a well-formed response", () => {
			expect(
				validateJudgeResponse({
					confidence: 82,
					answer: "You can do X by running Y.",
					relatedExcerpts: [0, 2],
				}),
			).toEqual({
				confidence: 82,
				answer: "You can do X by running Y.",
				relatedExcerpts: [0, 2],
			});
		});

		it("degrades to a safe no-answer for a non-object response", () => {
			for (const bad of [null, undefined, "not json", 42, []]) {
				expect(validateJudgeResponse(bad)).toEqual({
					confidence: 0,
					answer: null,
					relatedExcerpts: [],
				});
			}
		});

		it("degrades to a safe no-answer for a non-finite/out-of-range confidence", () => {
			for (
				const bad of [-1, 101, NaN, Infinity, "80", null, undefined]
			) {
				expect(
					validateJudgeResponse({
						confidence: bad,
						answer: "text",
						relatedExcerpts: [],
					}),
				).toEqual({ confidence: 0, answer: null, relatedExcerpts: [] });
			}
		});

		it("accepts confidence at the 0 and 100 boundaries", () => {
			expect(
				validateJudgeResponse({
					confidence: 0,
					answer: null,
					relatedExcerpts: [],
				}).confidence,
			).toBe(0);
			expect(
				validateJudgeResponse({
					confidence: 100,
					answer: "text",
					relatedExcerpts: [],
				}).confidence,
			).toBe(100);
		});

		it("nulls out a non-string answer instead of throwing", () => {
			expect(
				validateJudgeResponse({
					confidence: 90,
					answer: 12345,
					relatedExcerpts: [],
				}).answer,
			).toBeNull();
		});

		it("filters relatedExcerpts down to non-negative integers, dropping the rest", () => {
			expect(
				validateJudgeResponse({
					confidence: 50,
					answer: null,
					relatedExcerpts: [0, 1.5, -1, "2", 3, null],
				}).relatedExcerpts,
			).toEqual([0, 3]);
		});

		it("defaults relatedExcerpts to an empty array when not an array", () => {
			expect(
				validateJudgeResponse({
					confidence: 50,
					answer: null,
					relatedExcerpts: "not an array",
				}).relatedExcerpts,
			).toEqual([]);
		});
	});

	describe("checkSuppression", () => {
		const embeddingModel = "text-embedding-3-small";
		const questionEmbedding = [1, 0, 0];

		it("allows when there is no feedback cache", () => {
			expect(checkSuppression(questionEmbedding, undefined, embeddingModel))
				.toBe("allow");
		});

		it("allows when the feedback cache used a different embedding model", () => {
			expect(
				checkSuppression(
					questionEmbedding,
					{ model: "a-different-model", suppressed: [] },
					embeddingModel,
				),
			).toBe("allow");
		});

		it("allows when no suppressed entry is similar enough", () => {
			expect(
				checkSuppression(
					questionEmbedding,
					{
						model: embeddingModel,
						suppressed: [
							{
								embedding: [0, 1, 0],
								style: "answer",
								url: "https://example/1",
							},
						],
					},
					embeddingModel,
				),
			).toBe("allow");
		});

		it("demotes to linksOnly when similar to a downvoted full answer", () => {
			expect(
				checkSuppression(
					questionEmbedding,
					{
						model: embeddingModel,
						suppressed: [
							{
								embedding: [1, 0, 0],
								style: "answer",
								url: "https://example/1",
							},
						],
					},
					embeddingModel,
				),
			).toBe("linksOnly");
		});

		it("silences entirely when similar to a downvoted links-only answer", () => {
			expect(
				checkSuppression(
					questionEmbedding,
					{
						model: embeddingModel,
						suppressed: [
							{
								embedding: [1, 0, 0],
								style: "links",
								url: "https://example/1",
							},
						],
					},
					embeddingModel,
				),
			).toBe("silent");
		});

		it("ignores malformed suppression entries instead of throwing or NaN-passing", () => {
			expect(
				checkSuppression(
					questionEmbedding,
					{
						model: embeddingModel,
						suppressed: [
							{ embedding: "not an array", style: "answer" },
							{ embedding: [1, 0], style: "answer" }, // wrong length
							{ style: "answer" }, // missing embedding
						],
					},
					embeddingModel,
				),
			).toBe("allow");
		});
	});
});
