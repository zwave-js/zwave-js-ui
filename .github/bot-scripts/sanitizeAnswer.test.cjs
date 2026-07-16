// @ts-check

import { describe, it, expect } from "vitest";
import {
	sanitizeModelAnswer,
	neutralizeMentions,
	stripHtml,
	stripImages,
	stripLinks,
	neutralizeRawUrls,
} from "./sanitizeAnswer.cjs";

describe("sanitizeAnswer", () => {
	describe("neutralizeMentions", () => {
		it("inserts a zero-width space after every @", () => {
			expect(neutralizeMentions("cc @octocat and @some/team")).toBe(
				"cc @\u200boctocat and @\u200bsome/team",
			);
		});

		it("leaves text with no @ untouched", () => {
			expect(neutralizeMentions("no mentions here")).toBe(
				"no mentions here",
			);
		});

		it("neutralizes encoded mentions outside code", () => {
			expect(
				neutralizeMentions(
					"&#64;octocat &#x40;team &commat;here "
						+ "`&#64;literal`",
				),
			).toBe(
				"@\u200boctocat @\u200bteam @\u200bhere "
					+ "`&#64;literal`",
			);
		});
	});

	describe("stripHtml", () => {
		it("removes HTML comments", () => {
			expect(stripHtml("before<!-- secret -->after")).toBe("beforeafter");
			expect(stripHtml("before<!-- unfinished")).toBe("before");
		});

		it("removes overlapping comment delimiters", () => {
			expect(stripHtml("before<!--<!-->after")).toBe("beforeafter");
		});

		it("removes HTML tags", () => {
			expect(stripHtml("<b>bold</b> and <img src=x>")).toBe(
				"bold and ",
			);
		});

		it("removes malformed/nested tags left after a single pass", () => {
			// A naive single-pass strip of "<<script>script>" would remove
			// just "<<script>" and leave "script>" - not a re-formed tag,
			// but confirm the loop doesn't leave any "<" behind either
			const result = stripHtml("<<script>script>");
			expect(result).not.toContain("<");
			expect(result).toBe("script>");
		});

		it("removes angle-bracket autolinks", () => {
			expect(stripHtml("see <https://example.com/evil>")).toBe("see ");
		});

		it("preserves angle brackets in inline and fenced code", () => {
			const input = [
				"Use `Array<string>` and `x < 5 && y > 3`.",
				"",
				"```ts",
				"const values: Map<string, number> = new Map();",
				"```",
			].join("\n");
			expect(stripHtml(input)).toBe(input);
		});

		it("still removes HTML around code spans", () => {
			expect(stripHtml("<b>Use `Array<string>` here</b>")).toBe(
				"Use `Array<string>` here",
			);
		});

		it("sanitizes content behind escaped or mismatched backticks", () => {
			expect(
				stripHtml(
					"\\`<img src=x> @octocat [click](https://evil.example)`",
				),
			).toBe("\\` @octocat [click](https://evil.example)`");
			expect(
				stripHtml(
					"`<img src=x> @octocat [click](https://evil.example)``",
				),
			).toBe("` @octocat [click](https://evil.example)``");
		});

		it("sanitizes invalid fences and recognizes CRLF closers", () => {
			expect(
				stripHtml("```bad`info\n<img src=x> @octocat"),
			).toBe("```bad`info\n @octocat");
			expect(
				stripHtml(
					"```ts\r\nconst x: Array<string> = [];\r\n```\r\n"
						+ "<img src=x>",
				),
			).toBe(
				"```ts\nconst x: Array<string> = [];\n```\n",
			);
		});

		it("does not treat code spans as crossing block boundaries", () => {
			expect(
				stripHtml(
					"`open\n\n<img src=x> @octocat [click](https://evil.example)\n`",
				),
			).toBe(
				"`open\n\n @octocat [click](https://evil.example)\n`",
			);
		});

		it("recognizes CR-only fenced-code boundaries", () => {
			expect(
				stripHtml(
					"~~~js\rconst x: Array<string> = [];\r~~~\r"
						+ "<img src=x>",
				),
			).toBe(
				"~~~js\nconst x: Array<string> = [];\n~~~\n",
			);
		});
	});

	describe("stripImages", () => {
		it("removes markdown images including alt text", () => {
			expect(
				stripImages("before ![tracking pixel](https://evil.example/x.png) after"),
			).toBe("before  after");
		});
	});

	describe("stripLinks", () => {
		it("reduces markdown links to their label", () => {
			expect(stripLinks("[click here](https://evil.example)")).toBe(
				"click here",
			);
		});

		it("removes link reference definitions", () => {
			expect(
				stripLinks(
					'intro\n[label]: https://evil.example "title"\nmore',
				),
			).toBe("intro\n\nmore");
		});

		it("neutralizes nested markdown link syntax", () => {
			expect(
				stripLinks(
					"Click [here[for help]](evil.example/phish) to continue",
				),
			).toBe(
				String.raw`Click \[here\[for help\]\](evil.example/phish) to continue`,
			);
		});
	});

	describe("neutralizeRawUrls", () => {
		it("breaks raw http(s) URLs", () => {
			expect(neutralizeRawUrls("visit https://evil.example now")).toBe(
				"visit https://\u200bevil.example now",
			);
		});

		it("breaks bare www. URLs", () => {
			expect(neutralizeRawUrls("visit www.evil.example now")).toBe(
				"visit www.\u200bevil.example now",
			);
		});
	});

	describe("sanitizeModelAnswer", () => {
		it("strips links, images, HTML and neutralizes mentions/raw URLs together", () => {
			const input =
				"Hey @someone, see <script>alert(1)</script> ![img](https://evil.example/x.png) and [a link](https://evil.example) or visit https://evil.example directly. <!-- hidden -->";
			const result = sanitizeModelAnswer(input);
			expect(result).not.toContain("<script>");
			expect(result).not.toContain("](");
			expect(result).not.toContain("https://evil.example directly");
			expect(result).toContain("a link");
			expect(result).toContain("@\u200bsomeone");
			expect(result).toContain("https://\u200bevil.example");
		});

		it("preserves legitimate markdown formatting (bold, lists)", () => {
			const input = "**Bold text**\n\n- item one\n- item two";
			expect(sanitizeModelAnswer(input)).toBe(input);
		});

		it("trims surrounding whitespace", () => {
			expect(sanitizeModelAnswer("  hello  ")).toBe("hello");
		});

		it("prevents nested links and images from rendering", () => {
			const result = sanitizeModelAnswer(
				"Click [here[for help]](evil.example/phish) "
					+ "![see[details]](https://evil.example/pixel)",
			);
			expect(result).not.toContain("[here[for help]]");
			expect(result).not.toContain("![see[details]]");
			expect(result).toContain(String.raw`\[here\[for help\]\]`);
			expect(result).toContain(String.raw`!\[see\[details\]\]`);
		});

		it("preserves code while sanitizing surrounding content", () => {
			const input =
				"<b>Use</b> `Map<string, number>` instead of @someone.";
			expect(sanitizeModelAnswer(input)).toBe(
				"Use `Map<string, number>` instead of @\u200bsomeone.",
			);
		});
	});
});
