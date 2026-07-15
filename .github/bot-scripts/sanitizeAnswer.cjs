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
 * Inserts a zero-width space after each @ so GitHub does not resolve
 * the text into a user/team mention notification
 * @param {string} text
 */
function neutralizeMentions(text) {
	return text.replace(/@/g, "@\u200b");
}

/**
 * Removes HTML comments and tags, repeating the tag strip to avoid
 * leaving partial tags behind (e.g. from nested/malformed markup)
 * @param {string} text
 */
function stripHtml(text) {
	let result = "";
	let offset = 0;
	while (offset < text.length) {
		if (text.startsWith("<!--", offset)) {
			const end = text.indexOf("-->", offset + 4);
			if (end === -1) break;
			offset = end + 3;
		} else if (text[offset] === "<") {
			const end = text.indexOf(">", offset + 1);
			offset = end === -1 ? offset + 1 : end + 1;
		} else {
			result += text[offset];
			offset++;
		}
	}
	return result;
}

/**
 * Removes markdown image syntax entirely, including the alt text -
 * an image is never needed to answer a documentation question, and its
 * source URL is exactly as untrusted as a link's
 * @param {string} text
 */
function stripImages(text) {
	return text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
}

/**
 * Reduces markdown links to their label, dropping the (untrusted) target.
 * Also drops link reference definitions (`[label]: url`), the other
 * markdown syntax that can point at an arbitrary URL.
 * @param {string} text
 */
function stripLinks(text) {
	return text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^[ \t]*\[[^\]]+\]:\s*\S+.*$/gm, "")
		.replaceAll("[", String.raw`\[`)
		.replaceAll("]", String.raw`\]`);
}

/**
 * Breaks any URL that survived the steps above (e.g. typed as plain
 * text, or an angle-bracket autolink whose brackets were stripped as
 * HTML) so GitHub does not auto-link it into a clickable URL
 * @param {string} text
 */
function neutralizeRawUrls(text) {
	return text.replace(/\b(https?:\/\/|www\.)/gi, "$1\u200b");
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
};
