// @ts-check

// Shared helpers for calling the GitHub Models API

const API_BASE = "https://models.github.ai/inference";
const CHAT_MODEL = process.env.CHAT_MODEL || "openai/gpt-4o";

const MAX_RETRIES = 5;

/**
 * Performs a request against the Models API, retrying with backoff
 * on rate limits and transient server errors
 * @param {string} path
 * @param {object} body
 * @param {string} token
 * @returns {Promise<any>}
 */
async function modelsRequest(path, body, token) {
	for (let attempt = 0;; attempt++) {
		const response = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		});
		if (response.ok) return response.json();

		const retriable = response.status === 429 || response.status >= 500;
		if (!retriable || attempt >= MAX_RETRIES) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`Models API request failed with status ${response.status}: ${text}`,
			);
		}

		// Honor Retry-After if present, otherwise back off exponentially
		const retryAfter = Number(response.headers.get("retry-after"));
		const delay = Number.isFinite(retryAfter) && retryAfter > 0
			? retryAfter * 1000
			: Math.min(60_000, 2 ** attempt * 5000);
		console.log(
			`Models API returned ${response.status}, retrying in ${
				Math.round(delay / 1000)
			}s...`,
		);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

module.exports = {
	modelsRequest,
	CHAT_MODEL,
};
