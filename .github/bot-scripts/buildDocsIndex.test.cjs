// @ts-check

import { describe, it, expect } from "vitest";
import {
	chunkMarkdown,
	slugify,
	cleanHeading,
	splitLongText,
} from "./buildDocsIndex.cjs";

describe("buildDocsIndex", () => {
	describe("cleanHeading", () => {
		it("strips HTML tags", () => {
			expect(cleanHeading("Install <code>now</code>")).toBe(
				"Install now",
			);
		});

		it("strips docsify directives", () => {
			expect(cleanHeading("Install {docsify-ignore}")).toBe("Install");
		});

		it("reduces markdown links to their label", () => {
			expect(cleanHeading("See [the docs](https://example.com)")).toBe(
				"See the docs",
			);
		});
	});

	describe("slugify", () => {
		it("lowercases and hyphenates", () => {
			expect(slugify("Getting Started")).toBe("getting-started");
		});

		it("strips punctuation docsify also strips", () => {
			expect(slugify("What's new?")).toBe("whats-new");
		});
	});

	describe("splitLongText", () => {
		it("returns the text unchanged when short enough", () => {
			expect(splitLongText("short text")).toEqual(["short text"]);
		});

		it("splits long text into multiple overlapping parts", () => {
			const paragraph = "word ".repeat(1000).trim();
			const parts = splitLongText(paragraph);
			expect(parts.length).toBeGreaterThan(1);
			for (const part of parts) {
				expect(part.length).toBeGreaterThan(0);
			}
		});

		it("prefers splitting at paragraph boundaries", () => {
			const a = "a".repeat(3000);
			const b = "b".repeat(3000);
			const text = `${a}\n\n${b}`;
			const parts = splitLongText(text);
			// The split should land on the paragraph break rather than
			// mid-run of 'a's or 'b's
			expect(parts[0].endsWith("a")).toBe(true);
			expect(parts[parts.length - 1].startsWith("b") || parts[parts.length - 1].includes("b")).toBe(true);
		});
	});

	describe("chunkMarkdown", () => {
		it("assigns heading-derived breadcrumbs, titles and anchors", () => {
			const content = `# Title

Intro paragraph that is long enough to be kept as its own chunk of text.

## Section One

Some content under section one that is long enough to be a real chunk.
`;
			const chunks = chunkMarkdown("docs/example.md", content);
			expect(chunks.length).toBeGreaterThanOrEqual(2);
			const section = chunks.find((c) => c.title === "Section One");
			expect(section).toBeDefined();
			expect(section?.breadcrumbs).toEqual(["Title", "Section One"]);
			expect(section?.anchor).toBe("section-one");
		});

		it("falls back breadcrumbs to the file title for pre-heading content, never leaving them empty", () => {
			const content =
				"This paragraph appears before any heading in the file and is long enough to be kept as a chunk on its own.\n\n# First Heading\n\nMore text here that is also long enough to become its own chunk of content.\n";
			const chunks = chunkMarkdown("docs/example.md", content);
			const preHeadingChunk = chunks[0];
			expect(preHeadingChunk.breadcrumbs).toEqual(["example"]);
			expect(preHeadingChunk.breadcrumbs.length).toBeGreaterThan(0);
			expect(preHeadingChunk.breadcrumbs.every((b) => b.length > 0))
				.toBe(true);
		});

		it("drops chunks shorter than the minimum chunk length", () => {
			const content = "# Title\n\ntiny\n";
			const chunks = chunkMarkdown("docs/example.md", content);
			expect(chunks).toEqual([]);
		});

		it("does not treat headings inside code fences as real headings", () => {
			const content =
				"# Title\n\n```\n# not a heading, just a comment in a code block that is part of a long enough chunk\n```\n\nAnother paragraph of real content that is long enough to be kept as its own chunk.\n";
			const chunks = chunkMarkdown("docs/example.md", content);
			expect(chunks.every((c) => c.title === "Title")).toBe(true);
		});
	});
});
