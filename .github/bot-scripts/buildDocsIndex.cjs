// @ts-check

// Builds a semantic search index over the documentation by chunking all
// markdown files and embedding the chunks using GitHub Models.
// Usage: node buildDocsIndex.cjs <docs-dir> <output-file>
// Requires GITHUB_TOKEN with models:read permission.

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { embedBatched, EMBEDDING_MODEL } = require("./modelsApi.cjs");

const INDEX_VERSION = 1;

// Chunks shorter than this are unlikely to contain useful information
const MIN_CHUNK_LENGTH = 50;
// Sections longer than this are sub-split so nothing gets truncated away
const MAX_CHUNK_LENGTH = 4000;
// Overlap between sub-splits so answers spanning a split boundary aren't lost
const CHUNK_OVERLAP = 400;

/**
 * Removes HTML tags, repeating to avoid leaving partial tags behind
 * @param {string} str
 */
function stripHtmlTags(str) {
	let prev;
	do {
		prev = str;
		str = str.replace(/<[^>]*>/g, "");
	} while (str !== prev);
	return str;
}

/**
 * Normalizes a heading to the text docsify renders, stripping HTML tags,
 * docsify directives and markdown link syntax
 * @param {string} heading
 */
function cleanHeading(heading) {
	return stripHtmlTags(heading)
		.replace(/\{docsify-[^}]*\}/g, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.trim();
}

// Matches the characters docsify's slugify removes from heading anchors
const docsifySlugStripRegex =
	/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

/**
 * Approximates docsify's heading anchor slugs
 * @param {string} heading
 */
function slugify(heading) {
	return cleanHeading(heading.toLowerCase())
		.replace(docsifySlugStripRegex, "")
		.replace(/\s/g, "-");
}

/**
 * Splits a long text into overlapping parts, preferring paragraph boundaries
 * @param {string} text
 */
function splitLongText(text) {
	if (text.length <= MAX_CHUNK_LENGTH) return [text];

	/** @type {string[]} */
	const parts = [];
	let start = 0;
	while (start < text.length) {
		let end = Math.min(start + MAX_CHUNK_LENGTH, text.length);
		if (end < text.length) {
			// Prefer splitting at a paragraph break, then at a line break
			const window = text.slice(start, end);
			const paragraphBreak = window.lastIndexOf("\n\n");
			const lineBreak = window.lastIndexOf("\n");
			if (paragraphBreak > MAX_CHUNK_LENGTH / 2) {
				end = start + paragraphBreak;
			} else if (lineBreak > MAX_CHUNK_LENGTH / 2) {
				end = start + lineBreak;
			}
		}
		parts.push(text.slice(start, end).trim());
		if (end >= text.length) break;
		start = Math.max(start + 1, end - CHUNK_OVERLAP);
	}
	return parts;
}

/**
 * Splits a markdown file into chunks by heading, tracking breadcrumbs and anchors
 * @param {string} file Repo-relative path of the file
 * @param {string} content
 */
function chunkMarkdown(file, content) {
	const lines = content.split("\n");
	/** @type {{file: string, anchor: string, title: string, breadcrumbs: string[], text: string}[]} */
	const chunks = [];

	/** @type {{level: number, title: string}[]} */
	const headingStack = [];
	/** @type {string[]} */
	let currentLines = [];
	let currentTitle = path.basename(file, ".md");
	let currentAnchor = "";
	let inCodeFence = false;

	const pushChunk = () => {
		const text = currentLines.join("\n").trim();
		if (text.length >= MIN_CHUNK_LENGTH) {
			for (const part of splitLongText(text)) {
				chunks.push({
					file,
					anchor: currentAnchor,
					title: currentTitle,
					breadcrumbs: headingStack.map((h) => h.title),
					text: part,
				});
			}
		}
	};

	for (const line of lines) {
		if (/^\s*(```|~~~)/.test(line)) {
			inCodeFence = !inCodeFence;
			currentLines.push(line);
			continue;
		}
		const heading = !inCodeFence && line.match(/^(#{1,4})\s+(.+?)\s*$/);
		if (heading) {
			pushChunk();
			const level = heading[1].length;
			const title = cleanHeading(heading[2]);
			while (
				headingStack.length
				&& headingStack[headingStack.length - 1].level >= level
			) {
				headingStack.pop();
			}
			headingStack.push({ level, title });
			currentTitle = title;
			currentAnchor = slugify(title);
			currentLines = [];
		} else {
			currentLines.push(line);
		}
	}
	pushChunk();

	return chunks;
}

/** @param {string} dir */
async function* walkMarkdownFiles(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name.startsWith("_") || entry.name.startsWith(".")) {
				continue;
			}
			yield* walkMarkdownFiles(full);
		} else if (
			entry.isFile()
			&& entry.name.endsWith(".md")
			&& !entry.name.startsWith("_")
		) {
			yield full;
		}
	}
}

async function main() {
	const [docsDir, outputFile] = process.argv.slice(2);
	if (!docsDir || !outputFile) {
		console.error(
			"Usage: node buildDocsIndex.cjs <docs-dir> <output-file>",
		);
		process.exit(1);
	}
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		console.error("GITHUB_TOKEN environment variable is required");
		process.exit(1);
	}

	// Reuse embeddings from a previous index for unchanged chunks
	/** @type {Map<string, number[]>} */
	const previousEmbeddings = new Map();
	try {
		const previous = JSON.parse(await fs.readFile(outputFile, "utf8"));
		if (
			previous.version === INDEX_VERSION
			&& previous.model === EMBEDDING_MODEL
		) {
			for (const chunk of previous.chunks) {
				previousEmbeddings.set(chunk.hash, chunk.embedding);
			}
			console.log(
				`Found previous index with ${previousEmbeddings.size} chunks`,
			);
		}
	} catch {
		// No previous index available, embed everything
	}

	/** @type {any[]} */
	const allChunks = [];
	for await (const file of walkMarkdownFiles(docsDir)) {
		const content = await fs.readFile(file, "utf8");
		const relative = path
			.relative(docsDir, file)
			.replaceAll(path.sep, "/");
		for (const chunk of chunkMarkdown(relative, content)) {
			const embeddedText = [
				...chunk.breadcrumbs,
				chunk.text,
			].join("\n");
			const hash = crypto
				.createHash("sha256")
				.update(embeddedText)
				.digest("hex");
			allChunks.push({
				...chunk,
				hash,
				embeddedText,
				embedding: previousEmbeddings.get(hash),
			});
		}
	}
	console.log(`Collected ${allChunks.length} chunks`);

	const pending = allChunks.filter((c) => !c.embedding);
	console.log(`${pending.length} chunks need new embeddings`);

	const embeddings = await embedBatched(
		pending.map((c) => c.embeddedText),
		token,
	);
	pending.forEach((chunk, i) => chunk.embedding = embeddings[i]);

	const index = {
		version: INDEX_VERSION,
		model: EMBEDDING_MODEL,
		createdAt: new Date().toISOString(),
		chunks: allChunks.map(({ embeddedText, ...chunk }) => chunk),
	};
	await fs.mkdir(path.dirname(outputFile), { recursive: true });
	await fs.writeFile(outputFile, JSON.stringify(index));
	console.log(`Wrote index with ${allChunks.length} chunks to ${outputFile}`);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
