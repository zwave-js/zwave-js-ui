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
	});

	describe("stripHtml", () => {
		it("removes HTML comments", () => {
			expect(stripHtml("before<!-- secret -->after")).toBe("beforeafter");
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
	});
});
