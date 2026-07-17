// @ts-check

// Sanitizes the chat model's answer text before it is posted as a GitHub
// comment. The model's output is treated as untrusted content: a
// malicious or crafted question could coax it into emitting @mentions,
// HTML, images, or links (including ones dressed up as "documentation"
// links) that ping people, embed tracking pixels, or point at phishing
// sites. Only this module's output is used for the model-generated part
// of the comment - the doc/related-post links the bot appends itself are
// generated from our own data and are NOT passed through here.
//
// The model is instructed not to produce links at all (the bot appends
// trusted documentation/GitHub links separately), so any link surviving
// in its output is, by definition, unexpected and is stripped down to
// plain text rather than rendered as a clickable link.

/**
 * Applies a transform outside inline and fenced code, where GitHub renders
 * Markdown-like content as literal text
 * @param {string} text
 * @param {(text: string) => string} transform
 */
function transformOutsideCode(text, transform) {
	text = text.replace(/\r\n?/g, "\n");
	let result = "";
	let plainTextStart = 0;
	let offset = 0;

	while (offset < text.length) {
		const lineStart = offset === 0 || text[offset - 1] === "\n";
		if (lineStart) {
			const fenceMatch = text.slice(offset).match(/^( {0,3})(`{3,}|~{3,})/);
			if (fenceMatch) {
				const fenceStart = offset;
				const fence = fenceMatch[2];
				const openingLineEnd = text.indexOf("\n", fenceStart);
				const openingLine = text.slice(
					fenceStart,
					openingLineEnd === -1 ? text.length : openingLineEnd,
				);
				const infoString = openingLine
					.slice(fenceMatch[1].length + fence.length)
					.replace(/\r$/, "");
				if (fence[0] === "`" && infoString.includes("`")) {
					offset += fence.length;
					continue;
				}
				let fenceEnd = text.length;
				let searchOffset = openingLineEnd === -1
					? text.length
					: openingLineEnd + 1;
				const closingPattern = new RegExp(
					`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\r?\\n|\\r?$)`,
					"m",
				);
				const closingMatch = closingPattern.exec(text.slice(searchOffset));
				if (closingMatch) {
					fenceEnd = searchOffset + closingMatch.index
						+ closingMatch[0].length;
				}

				result += transform(text.slice(plainTextStart, fenceStart));
				result += text.slice(fenceStart, fenceEnd);
				offset = fenceEnd;
				plainTextStart = offset;
				continue;
			}
		}

		if (text[offset] === "`") {
			let runLength = 1;
			while (text[offset + runLength] === "`") runLength++;
			let precedingBackslashes = 0;
			for (
				let index = offset - 1;
				index >= 0 && text[index] === "\\";
				index--
			) {
				precedingBackslashes++;
			}
			if (precedingBackslashes % 2 === 1) {
				offset += runLength;
				continue;
			}

			let closingOffset = -1;
			let searchOffset = offset + runLength;
			const lineEnd = text.indexOf("\n", searchOffset);
			const searchEnd = lineEnd === -1 ? text.length : lineEnd;
			while (searchOffset < searchEnd) {
				const nextRun = text.indexOf("`", searchOffset);
				if (nextRun === -1 || nextRun >= searchEnd) break;
				let nextRunLength = 1;
				while (text[nextRun + nextRunLength] === "`") nextRunLength++;
				if (nextRunLength === runLength) {
					closingOffset = nextRun;
					break;
				}
				searchOffset = nextRun + nextRunLength;
			}
			if (closingOffset !== -1) {
				const codeEnd = closingOffset + runLength;
				result += transform(text.slice(plainTextStart, offset));
				result += text.slice(offset, codeEnd);
				offset = codeEnd;
				plainTextStart = offset;
				continue;
			}
			offset += runLength;
			continue;
		}

		offset++;
	}

	result += transform(text.slice(plainTextStart));
	return result;
}

/**
 * Inserts a zero-width space after each literal or encoded @ so GitHub does
 * not resolve the text into a user/team mention notification
 * @param {string} text
 */
function neutralizeMentions(text) {
	return transformOutsideCode(
		text,
		(segment) =>
			segment.replace(
				/@|&#0*64;|&#x0*40;|&commat;/gi,
				"@\u200b",
			),
	);
}

/**
 * Removes HTML comments and tags, repeating the tag strip to avoid
 * leaving partial tags behind (e.g. from nested/malformed markup)
 * @param {string} text
 */
function stripHtml(text) {
	return transformOutsideCode(text, (segment) => {
		let result = "";
		let offset = 0;
		while (offset < segment.length) {
			if (segment.startsWith("<!--", offset)) {
				const end = segment.indexOf("-->", offset + 4);
				if (end === -1) break;
				offset = end + 3;
			} else if (segment[offset] === "<") {
				const end = segment.indexOf(">", offset + 1);
				offset = end === -1 ? offset + 1 : end + 1;
			} else {
				result += segment[offset];
				offset++;
			}
		}
		return result;
	});
}

/**
 * Removes markdown image syntax entirely, including the alt text -
 * an image is never needed to answer a documentation question, and its
 * source URL is exactly as untrusted as a link's
 * @param {string} text
 */
function stripImages(text) {
	return transformOutsideCode(
		text,
		(segment) => segment.replace(/!\[[^\]]*\]\([^)]*\)/g, ""),
	);
}

/**
 * Reduces markdown links to their label, dropping the (untrusted) target.
 * Also drops link reference definitions (`[label]: url`), the other
 * markdown syntax that can point at an arbitrary URL.
 * @param {string} text
 */
function stripLinks(text) {
	return transformOutsideCode(
		text,
		(segment) =>
			segment
				.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
				.replace(/^[ \t]*\[[^\]]+\]:\s*\S+.*$/gm, "")
				.replaceAll("[", String.raw`\[`)
				.replaceAll("]", String.raw`\]`),
	);
}

/**
 * Breaks any URL that survived the steps above (e.g. typed as plain
 * text, or an angle-bracket autolink whose brackets were stripped as
 * HTML) so GitHub does not auto-link it into a clickable URL
 * @param {string} text
 */
function neutralizeRawUrls(text) {
	return transformOutsideCode(
		text,
		(segment) => segment.replace(/\b(https?:\/\/|www\.)/gi, "$1\u200b"),
	);
}

/**
 * Sanitizes untrusted, model-generated answer text before it is embedded
 * in a bot comment. Does NOT need to be (and must not be) applied to the
 * documentation/related-post links the bot generates itself from its own
 * data - only to text that came out of the chat model.
 * @param {string} text
 */
function sanitizeModelAnswer(text) {
	let result = text;
	result = stripHtml(result);
	result = stripImages(result);
	result = stripLinks(result);
	result = neutralizeRawUrls(result);
	result = neutralizeMentions(result);
	return result.trim();
}

module.exports = {
	sanitizeModelAnswer,
	neutralizeMentions,
	stripHtml,
	stripImages,
	stripLinks,
	neutralizeRawUrls,
	transformOutsideCode,
};
