// @ts-check

import { describe, it, expect } from "vitest";
import {
	parseAnswerMetadata,
	validateAnswerMetadata,
	scoreReactions,
	reactionWeight,
} from "./collectDocsFeedback.cjs";
import {
	DOCS_ANSWER_METADATA_TAG,
	DOCS_ANSWER_METADATA_VERSION,
	DOCS_BASE_URL,
} from "./answerFromDocs.cjs";

function metadataComment(metadata) {
	return `<!-- ${DOCS_ANSWER_METADATA_TAG} ${
		JSON.stringify(metadata)
	} -->`;
}

describe("collectDocsFeedback", () => {
	describe("validateAnswerMetadata", () => {
		it("accepts a well-formed payload", () => {
			expect(
				validateAnswerMetadata({
					v: DOCS_ANSWER_METADATA_VERSION,
					style: "answer",
					confidence: 87,
					sections: ["docs/a.md#b"],
				}),
			).toEqual({
				style: "answer",
				confidence: 87,
				sections: ["docs/a.md#b"],
			});
		});

		it("rejects a non-object or null payload", () => {
			expect(validateAnswerMetadata(null)).toBeUndefined();
			expect(validateAnswerMetadata("nope")).toBeUndefined();
			expect(validateAnswerMetadata(42)).toBeUndefined();
		});

		it("rejects a mismatched version", () => {
			expect(
				validateAnswerMetadata({
					v: DOCS_ANSWER_METADATA_VERSION + 1,
					style: "answer",
					confidence: 50,
					sections: [],
				}),
			).toBeUndefined();
		});

		it("falls back an unrecognized style to 'answer'", () => {
			expect(
				validateAnswerMetadata({
					v: DOCS_ANSWER_METADATA_VERSION,
					style: "not-a-real-style",
					confidence: null,
					sections: [],
				}),
			).toMatchObject({ style: "answer" });
		});

		it("nulls out an out-of-range or non-finite confidence", () => {
			for (
				const bad of [-1, 101, NaN, Infinity, "80", undefined]
			) {
				expect(
					validateAnswerMetadata({
						v: DOCS_ANSWER_METADATA_VERSION,
						style: "answer",
						confidence: bad,
						sections: [],
					}),
				).toMatchObject({ confidence: null });
			}
		});

		it("empties out sections that are not a string array", () => {
			expect(
				validateAnswerMetadata({
					v: DOCS_ANSWER_METADATA_VERSION,
					style: "answer",
					confidence: null,
					sections: [1, 2, 3],
				}),
			).toMatchObject({ sections: [] });
			expect(
				validateAnswerMetadata({
					v: DOCS_ANSWER_METADATA_VERSION,
					style: "answer",
					confidence: null,
					sections: "not an array",
				}),
			).toMatchObject({ sections: [] });
		});
	});

	describe("parseAnswerMetadata", () => {
		it("parses a well-formed trailing metadata comment", () => {
			const body = `Some answer text\n\n${
				metadataComment({
					v: DOCS_ANSWER_METADATA_VERSION,
					style: "answer",
					confidence: 90,
					sections: ["docs/a.md#b"],
				})
			}`;
			expect(parseAnswerMetadata(body)).toEqual({
				style: "answer",
				confidence: 90,
				sections: ["docs/a.md#b"],
			});
		});

		it("uses only the LAST metadata occurrence, ignoring earlier/injected ones", () => {
			const injected = metadataComment({
				v: DOCS_ANSWER_METADATA_VERSION,
				style: "answer",
				confidence: 99,
				sections: ["docs/injected.md#x"],
			});
			const real = metadataComment({
				v: DOCS_ANSWER_METADATA_VERSION,
				style: "posts",
				confidence: 40,
				sections: [],
			});
			const body =
				`Quoted post content that happens to contain:\n${injected}\n\nActual bot answer\n\n${real}`;
			expect(parseAnswerMetadata(body)).toEqual({
				style: "posts",
				confidence: 40,
				sections: [],
			});
		});

		it("falls back to link parsing when the metadata tag is absent", () => {
			const body =
				`See [Install](${DOCS_BASE_URL}/docs/guide/install?id=setup) for details.`;
			expect(parseAnswerMetadata(body)).toEqual({
				style: "answer",
				confidence: null,
				sections: ["docs/guide/install.md#setup"],
			});
		});

		it("falls back to 'posts' style when no doc links are present", () => {
			expect(parseAnswerMetadata("Just some plain text, no links."))
				.toEqual({
					style: "posts",
					confidence: null,
					sections: [],
				});
		});

		it("falls back to link parsing when the metadata payload is malformed JSON", () => {
			const body =
				`Answer\n\n<!-- ${DOCS_ANSWER_METADATA_TAG} {not valid json} -->`;
			const result = parseAnswerMetadata(body);
			expect(result.style).toBe("posts");
			expect(result.confidence).toBeNull();
		});
	});

	describe("reactionWeight", () => {
		it("weights a maintainer's reaction highest", () => {
			expect(reactionWeight("AlCalzone", "someOtherUser")).toBe(5);
		});

		it("weights the post author's reaction above default", () => {
			expect(reactionWeight("questionAuthor", "questionAuthor")).toBe(
				2,
			);
		});

		it("is case-insensitive when matching maintainers/authors", () => {
			expect(reactionWeight("ALCALZONE", "someone")).toBe(5);
			expect(reactionWeight("QuestionAuthor", "questionauthor")).toBe(2);
		});

		it("weights everyone else at the default weight", () => {
			expect(reactionWeight("randomUser", "questionAuthor")).toBe(1);
		});
	});

	describe("scoreReactions", () => {
		it("collapses multiple same-sign reactions from one user into a single vote", () => {
			const { votes, score } = scoreReactions(
				[
					{ user: "alice", content: "+1" },
					{ user: "alice", content: "heart" },
				],
				"postAuthor",
			);
			expect(votes).toHaveLength(1);
			expect(votes[0].content).toBe("+1");
			expect(score).toBe(1);
		});

		it("cancels out contradicting reactions from the same user into no vote", () => {
			const { votes, score } = scoreReactions(
				[
					{ user: "alice", content: "+1" },
					{ user: "alice", content: "-1" },
				],
				"postAuthor",
			);
			expect(votes).toHaveLength(0);
			expect(score).toBe(0);
		});

		it("caps three same-sign reactions from one user to a single weighted vote", () => {
			const { votes, score } = scoreReactions(
				[
					{ user: "alice", content: "+1" },
					{ user: "alice", content: "heart" },
					{ user: "alice", content: "hooray" },
				],
				"postAuthor",
			);
			expect(votes).toHaveLength(1);
			expect(score).toBe(1);
		});

		it("applies maintainer/author weights once per user after collapsing", () => {
			const { votes, score } = scoreReactions(
				[
					{ user: "AlCalzone", content: "+1" },
					{ user: "AlCalzone", content: "+1" },
					{ user: "postAuthor", content: "+1" },
				],
				"postAuthor",
			);
			expect(votes).toHaveLength(2);
			expect(score).toBe(5 + 2);
		});

		it("ignores reactions with an unrecognized content or bot users", () => {
			const { votes, score } = scoreReactions(
				[
					{ user: "alice", content: "eyes" },
					{ user: "some-bot[bot]", content: "+1" },
				],
				"postAuthor",
			);
			expect(votes).toHaveLength(0);
			expect(score).toBe(0);
		});

		it("understands both REST and GraphQL reaction content notations", () => {
			const { votes: restVotes } = scoreReactions(
				[{ user: "alice", content: "+1" }],
				"postAuthor",
			);
			const { votes: graphqlVotes } = scoreReactions(
				[{ user: "alice", content: "THUMBS_UP" }],
				"postAuthor",
			);
			expect(restVotes).toHaveLength(1);
			expect(graphqlVotes).toHaveLength(1);
		});
	});
});
