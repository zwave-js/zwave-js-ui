// @ts-check

// Shared helpers for calling the GitHub REST and GraphQL APIs from
// standalone bot scripts that run outside actions/github-script

const API_BASE = "https://api.github.com";

// Bounded retries for rate limits and transient server errors. These
// scripts run in scheduled/triggered CI jobs with no human watching, so
// a single flaky response must not fail the whole job outright.
const MAX_RETRIES = 5;

/**
 * @param {Response} response
 * @param {number} attempt
 */
function getRateLimitDelayMs(response, attempt) {
	if (attempt >= MAX_RETRIES) return undefined;

	const retryAfter = Number(response.headers.get("retry-after"));
	if (Number.isFinite(retryAfter) && retryAfter > 0) {
		return Math.min(retryAfter * 1000, 60_000);
	}

	const reset = Number(response.headers.get("x-ratelimit-reset"));
	if (Number.isFinite(reset) && reset > 0) {
		const delay = reset * 1000 - Date.now();
		if (delay > 0) return Math.min(delay, 60_000);
	}

	return Math.min(60_000, 2 ** attempt * 1000);
}

/**
 * Decides whether a failed response should be retried and, if so, how
 * long to wait first. Handles primary rate limits (429), secondary rate
 * limits (403 with a Retry-After header or a recognizable body message),
 * and transient server errors (5xx). Returns undefined when the
 * response should not (or can no longer) be retried.
 * @param {Response} response
 * @param {number} attempt
 * @returns {Promise<number | undefined>}
 */
async function getRetryDelayMs(response, attempt) {
	const isPrimaryRateLimit = response.status === 429;
	const isServerError = response.status >= 500 && response.status < 600;

	let isSecondaryRateLimit = false;
	if (response.status === 403) {
		// Secondary rate limits are only distinguishable from a genuine
		// permission error by the response body/headers, not the status
		// code alone
		if (response.headers.get("retry-after") != null) {
			isSecondaryRateLimit = true;
		} else {
			const text = await response.clone().text().catch(() => "");
			isSecondaryRateLimit = /secondary rate limit|abuse detection/i
				.test(text);
		}
	}

	if (!isPrimaryRateLimit && !isServerError && !isSecondaryRateLimit) {
		return undefined;
	}
	if (attempt >= MAX_RETRIES) return undefined;

	if (isPrimaryRateLimit || isSecondaryRateLimit) {
		return getRateLimitDelayMs(response, attempt);
	}

	// Fall back to exponential backoff, e.g. for bare 5xx responses
	return Math.min(60_000, 2 ** attempt * 1000);
}

/**
 * @param {Response} response
 * @param {any[]} errors
 * @param {number} attempt
 */
function getGraphqlRetryDelayMs(response, errors, attempt) {
	const isRateLimit = errors.some(
		(error) =>
			error?.type === "RATE_LIMITED"
			|| /rate limit|abuse detection/i.test(error?.message ?? ""),
	);
	return isRateLimit ? getRateLimitDelayMs(response, attempt) : undefined;
}

/**
 * @param {string} method
 * @param {string} url
 * @param {object | undefined} body
 * @param {string} token
 */
async function ghFetch(method, url, body, token) {
	for (let attempt = 0;; attempt++) {
		const response = await fetch(url, {
			method,
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"X-GitHub-Api-Version": "2022-11-28",
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body && JSON.stringify(body),
		});
		if (response.ok) return response;

		const delay = await getRetryDelayMs(response, attempt);
		if (delay === undefined) {
			throw new Error(
				`GitHub API request ${method} ${url} failed with status ${response.status}: ${await response
					.text()
					.catch(() => "")}`,
			);
		}
		console.log(
			`GitHub API request ${method} ${url} returned ${response.status}, retrying in ${
				Math.round(delay / 1000)
			}s...`,
		);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

/**
 * Performs a request against the GitHub REST API
 * @param {string} method
 * @param {string} pathAndQuery
 * @param {object | undefined} body
 * @param {string} token
 * @returns {Promise<any>}
 */
async function ghRequest(method, pathAndQuery, body, token) {
	const response = await ghFetch(
		method,
		`${API_BASE}${pathAndQuery}`,
		body,
		token,
	);
	return response.json();
}

/**
 * Fetches all pages of a REST collection endpoint by following Link headers
 * @param {string} pathAndQuery Initial path including query parameters
 * @param {string} token
 * @returns {Promise<any[]>}
 */
async function ghPaginated(pathAndQuery, token) {
	/** @type {any[]} */
	const results = [];
	/** @type {string | undefined} */
	let next = `${API_BASE}${pathAndQuery}`;
	while (next) {
		const response = await ghFetch("GET", next, undefined, token);
		results.push(...await response.json());
		next = response.headers
			.get("link")
			?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
	}
	return results;
}

/**
 * Performs a request against the GitHub GraphQL API. GraphQL errors are
 * reported inside a 200 response body, so application-level `errors` are
 * not retried (they usually indicate a bad query, not a transient
 * failure) - only HTTP-level failures go through the same retry/backoff
 * as the REST helpers above.
 * @param {string} query
 * @param {object} variables
 * @param {string} token
 * @returns {Promise<any>}
 */
async function ghGraphql(query, variables, token) {
	for (let attempt = 0;; attempt++) {
		const response = await fetch(`${API_BASE}/graphql`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, variables }),
		});
		if (response.ok) {
			const result = await response.json();
			if (result.errors?.length) {
				const delay = getGraphqlRetryDelayMs(
					response,
					result.errors,
					attempt,
				);
				if (delay !== undefined) {
					console.log(
						`GitHub GraphQL request was rate limited, retrying in ${
							Math.round(delay / 1000)
						}s...`,
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
				throw new Error(
					`GitHub GraphQL request failed: ${
						JSON.stringify(result.errors)
					}`,
				);
			}
			return result.data;
		}

		const delay = await getRetryDelayMs(response, attempt);
		if (delay === undefined) {
			throw new Error(
				`GitHub GraphQL request failed with status ${response.status}: ${await response
					.text()
					.catch(() => "")}`,
			);
		}
		console.log(
			`GitHub GraphQL request returned ${response.status}, retrying in ${
				Math.round(delay / 1000)
			}s...`,
		);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
}

module.exports = {
	ghRequest,
	ghPaginated,
	ghGraphql,
	getRetryDelayMs,
	getGraphqlRetryDelayMs,
};
