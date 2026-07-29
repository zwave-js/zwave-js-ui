// @ts-check

import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

// The transformers pipeline is mocked (its dynamic import is the only
// seam vitest can intercept from CJS), so the answer pipeline runs
// against tiny test vectors without downloading the model
vi.mock("@huggingface/transformers", () => ({
	pipeline: vi.fn(async () => async (/** @type {string[]} */ batch) => ({
		dims: [batch.length, 2],
		tolist: () => batch.map(() => [1, 0]),
	})),
}));

import { EMBEDDING_MODEL } from "./localEmbeddings.cjs";

import {
	validateJudgeResponse,
	checkSuppression,
	alreadyAnswered,
	checkAnswerGates,
	composeAndPostAnswer,
	renderDocsSection,
	prepareDocsAnswer,
	postDocsAnswer,
	buildRelatedPostsSection,
	POSTS_MIN_SIMILARITY,
	DOCS_ANSWER_COMMENT_TAG,
	DOCS_ANSWER_METADATA_TAG,
} from "./answerFromDocs.cjs";

/**
 * @param {any[]} comments
 * @param {any[]} events
 */
function mockGithub(comments, events) {
	return /** @type {any} */ ({
		paginate: (/** @type {any} */ route, /** @type {any} */ params) =>
			route(params),
		rest: {
			issues: {
				listComments: () => comments,
				listEventsForTimeline: () => events,
			},
		},
	});
}

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

	describe("alreadyAnswered", () => {
		it("ignores answers inherited from a transferred issue", async () => {
			const events = [{
				event: "transferred",
				created_at: "2026-01-02T00:00:00Z",
			}];
			const inherited = {
				created_at: "2026-01-01T00:00:00Z",
				body: DOCS_ANSWER_COMMENT_TAG,
			};
			const own = {
				created_at: "2026-01-03T00:00:00Z",
				body: DOCS_ANSWER_COMMENT_TAG,
			};
			/** @param {any[]} comments */
			const param = (comments) => ({
				github: mockGithub(comments, events),
				context: /** @type {any} */ ({
					repo: { owner: "zwave-js", repo: "zwave-js-ui" },
				}),
			});

			expect(
				await alreadyAnswered(param([inherited]), { number: 1 }, false),
			).toBe(false);
			expect(
				await alreadyAnswered(
					param([inherited, own]),
					{ number: 1 },
					false,
				),
			).toBe(true);
		});
	});

	describe("buildRelatedPostsSection", () => {
		/** @param {number} similarity Desired cosine against [1, 0] */
		const post = (similarity, number) => ({
			type: "issue",
			number,
			title: `Post ${number}`,
			url: `https://example.com/${number}`,
			state: "open",
			// Unit vector at the desired cosine to the unit question vector
			embedding: [
				similarity,
				Math.sqrt(1 - similarity ** 2),
			],
		});
		const self = { type: "discussion", number: 999 };

		it("suggests posts at the similarity floor", () => {
			const index = { posts: [post(POSTS_MIN_SIMILARITY, 1)] };
			const section = buildRelatedPostsSection(index, [1, 0], self);
			expect(section).toContain("Post 1");
		});

		it("stays silent below the similarity floor", () => {
			const index = { posts: [post(POSTS_MIN_SIMILARITY - 0.01, 1)] };
			expect(
				buildRelatedPostsSection(index, [1, 0], self),
			).toBeUndefined();
		});
	});

	describe("renderDocsSection", () => {
		const chunks = [
			{
				file: "guide/foo.md",
				anchor: "bar",
				title: "Bar",
				breadcrumbs: ["Foo", "Bar"],
				text: "How to bar",
			},
			{
				file: "guide/foo.md",
				anchor: "baz",
				title: "Baz",
				breadcrumbs: ["Foo", "Bar", "Baz"],
				text: "How to baz",
			},
		];

		it("renders a full answer at high confidence", () => {
			const section = renderDocsSection(
				{ confidence: 80, answer: "Do the thing.", relatedExcerpts: [0] },
				chunks,
				true,
			);
			expect(section?.style).toBe("answer");
			expect(section?.text).toContain("Do the thing.");
			expect(section?.text).toContain("guide/foo?id=bar");
			expect(section?.sections).toEqual(["guide/foo.md#bar"]);
		});

		it("degrades to links between the thresholds", () => {
			const section = renderDocsSection(
				{ confidence: 50, answer: "Do the thing.", relatedExcerpts: [0] },
				chunks,
				true,
			);
			expect(section?.style).toBe("links");
			expect(section?.text).not.toContain("Do the thing.");
		});

		it("degrades to links when answers are suppressed", () => {
			const section = renderDocsSection(
				{ confidence: 95, answer: "Do the thing.", relatedExcerpts: [0] },
				chunks,
				false,
			);
			expect(section?.style).toBe("links");
		});

		it("renders nothing below the link threshold or without excerpts", () => {
			expect(
				renderDocsSection(
					{ confidence: 30, answer: null, relatedExcerpts: [0] },
					chunks,
					true,
				),
			).toBeUndefined();
			expect(
				renderDocsSection(
					{ confidence: 80, answer: null, relatedExcerpts: [] },
					chunks,
					true,
				),
			).toBeUndefined();
		});

		it("does not link a subsection next to its ancestor", () => {
			const section = renderDocsSection(
				{ confidence: 50, answer: null, relatedExcerpts: [1, 0] },
				chunks,
				true,
			);
			expect(section?.sections).toEqual(["guide/foo.md#bar"]);
		});
	});

	describe("composeAndPostAnswer", () => {
		function mockPoster() {
			/** @type {string[]} */
			const bodies = [];
			const github = /** @type {any} */ ({
				graphql: async (
					/** @type {string} */ _q,
					/** @type {any} */ vars,
				) => {
					bodies.push(vars.body);
					return {};
				},
				rest: {
					issues: {
						createComment: async (/** @type {any} */ { body }) => {
							bodies.push(body);
							return {};
						},
					},
				},
			});
			const context = /** @type {any} */ ({
				repo: { owner: "o", repo: "r" },
			});
			return { github, context, bodies };
		}
		const docsSection = {
			text: "The docs part",
			style: /** @type {const} */ ("answer"),
			confidence: 90,
			sections: ["a.md#b"],
		};

		/** @param {string} body */
		function parseMetadata(body) {
			const match = body.match(
				new RegExp(`${DOCS_ANSWER_METADATA_TAG} (.*?) -->`),
			);
			return JSON.parse(/** @type {string} */ (match?.[1]));
		}

		it("composes docs + posts for issues", async () => {
			const { github, context, bodies } = mockPoster();
			await composeAndPostAnswer(
				{ github, context },
				{ number: 1 },
				false,
				docsSection,
				"The posts part",
			);
			expect(bodies[0]).toContain("The docs part");
			expect(bodies[0]).toContain("The posts part");
			expect(bodies[0]).toContain(DOCS_ANSWER_COMMENT_TAG);
			expect(parseMetadata(bodies[0])).toMatchObject({
				style: "answer",
				confidence: 90,
				sections: ["a.md#b"],
			});
		});

		it("composes a docs-only answer", async () => {
			const { github, context, bodies } = mockPoster();
			await composeAndPostAnswer(
				{ github, context },
				{ number: 1 },
				false,
				docsSection,
				undefined,
			);
			expect(bodies[0]).toContain("The docs part");
			expect(bodies[0]).not.toContain("existing posts");
		});

		it("composes a posts-only answer", async () => {
			const { github, context, bodies } = mockPoster();
			await composeAndPostAnswer(
				{ github, context },
				{ number: 1 },
				false,
				undefined,
				"The posts part",
			);
			expect(bodies[0]).toContain("The posts part");
			expect(parseMetadata(bodies[0]).style).toBe("posts");
		});

		it("posts to discussions via GraphQL", async () => {
			const { github, context, bodies } = mockPoster();
			await composeAndPostAnswer(
				{ github, context },
				{ node_id: "D_1" },
				true,
				docsSection,
				undefined,
			);
			expect(bodies.length).toBe(1);
		});
	});

	describe("checkAnswerGates", () => {
		const github = mockGithub([], []);
		/** @param {any} payload */
		const param = (payload) => ({
			github,
			context: /** @type {any} */ ({
				payload,
				repo: { owner: "o", repo: "r" },
			}),
		});

		it("skips excluded and bot authors", async () => {
			expect(
				await checkAnswerGates(
					param({ issue: { user: { login: "AlCalzone" } } }),
				),
			).toBeUndefined();
			expect(
				await checkAnswerGates(
					param({
						issue: { user: { login: "some[bot]", type: "Bot" } },
					}),
				),
			).toBeUndefined();
		});

		it("skips discussions outside the question categories", async () => {
			expect(
				await checkAnswerGates(
					param({
						discussion: {
							user: { login: "someuser" },
							category: { slug: "ideas" },
						},
					}),
				),
			).toBeUndefined();
		});

		it("passes a fresh community issue through", async () => {
			const result = await checkAnswerGates(
				param({ issue: { user: { login: "someuser" }, number: 5 } }),
			);
			expect(result?.isDiscussion).toBe(false);
			expect(result?.post?.number).toBe(5);
		});
	});

	describe("prepareDocsAnswer -> postDocsAnswer round trip", () => {
		it("hands off retrieved chunks and posts the judged answer", async () => {
			const dir = await mkdtemp(join(tmpdir(), "docs-answer-"));
			const docsIndex = {
				version: 1,
				model: EMBEDDING_MODEL,
				createdAt: "2026-01-01T00:00:00Z",
				chunks: [
					{
						file: "guide/foo.md",
						anchor: "bar",
						title: "Bar",
						breadcrumbs: ["Foo", "Bar"],
						text: "How to bar properly",
						hash: "h1",
						embedding: [1, 0],
					},
				],
			};
			await writeFile(
				join(dir, "docs-index.json"),
				JSON.stringify(docsIndex),
			);
			process.env.DOCS_INDEX_PATH = join(dir, "docs-index.json");
			process.env.POSTS_INDEX_PATH = join(dir, "missing.json");
			delete process.env.DOCS_FEEDBACK_PATH;
			process.env.DOCS_HANDOFF_PATH = join(dir, "handoff.json");

			/** @type {string[]} */
			const bodies = [];
			const github = /** @type {any} */ ({
				paginate: (
					/** @type {any} */ route,
					/** @type {any} */ params,
				) => route(params),
				rest: {
					issues: {
						listComments: () => [],
						listEventsForTimeline: () => [],
						createComment: async (/** @type {any} */ { body }) => {
							bodies.push(body);
							return {};
						},
					},
				},
			});
			const context = /** @type {any} */ ({
				payload: {
					issue: {
						user: { login: "someuser" },
						number: 7,
						title: "How do I bar?",
						body: "I cannot figure out how to bar.",
					},
				},
				repo: { owner: "o", repo: "r" },
			});

			expect(await prepareDocsAnswer({ github, context })).toBe(true);

			// The judge input is the projected view of the handoff
			const judgeInput = JSON.parse(
				await readFile(join(dir, "judge-input.json"), "utf8"),
			);
			expect(judgeInput.question).toContain("How do I bar?");
			expect(judgeInput.excerpts).toEqual([
				{ breadcrumbs: ["Foo", "Bar"], text: "How to bar properly" },
			]);

			// The judge reports its verdict through the safe-output job
			await writeFile(
				join(dir, "agent-output.json"),
				JSON.stringify({
					items: [{
						type: "post_docs_answer",
						confidence: 90,
						answer: "Bar it properly.",
						related_excerpts: "0",
					}],
				}),
			);
			process.env.GH_AW_AGENT_OUTPUT = join(dir, "agent-output.json");
			await postDocsAnswer({ github, context });

			expect(bodies.length).toBe(1);
			expect(bodies[0]).toContain("Bar it properly.");
			expect(bodies[0]).toContain("guide/foo?id=bar");
		});

		it("drops nothing silently when the judge reports no verdict but posts exist", async () => {
			const dir = await mkdtemp(join(tmpdir(), "docs-answer-"));
			await writeFile(
				join(dir, "handoff.json"),
				JSON.stringify({
					question: "q",
					allowAnswer: true,
					chunks: [],
					postsSection: "Some related posts",
				}),
			);
			await writeFile(
				join(dir, "agent-output.json"),
				JSON.stringify({ items: [] }),
			);
			process.env.DOCS_HANDOFF_PATH = join(dir, "handoff.json");
			process.env.GH_AW_AGENT_OUTPUT = join(dir, "agent-output.json");

			/** @type {string[]} */
			const bodies = [];
			const github = /** @type {any} */ ({
				rest: {
					issues: {
						createComment: async (/** @type {any} */ { body }) => {
							bodies.push(body);
							return {};
						},
					},
				},
			});
			const context = /** @type {any} */ ({
				payload: {
					issue: { user: { login: "someuser" }, number: 7 },
				},
				repo: { owner: "o", repo: "r" },
			});
			// Accepted tradeoff: without a verdict the safe-output job never
			// runs in production; when it does run, it must not throw
			await postDocsAnswer({ github, context });
			expect(bodies).toEqual([]);
		});
	});
});
