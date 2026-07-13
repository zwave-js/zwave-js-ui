// @ts-check

// Shared helpers for calling the GitHub REST and GraphQL APIs from
// standalone bot scripts that run outside actions/github-script

const API_BASE = "https://api.github.com";

/**
 * @param {string} method
 * @param {string} url
 * @param {object | undefined} body
 * @param {string} token
 */
async function ghFetch(method, url, body, token) {
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
	if (!response.ok) {
		throw new Error(
			`GitHub API request ${method} ${url} failed with status ${response.status}: ${await response
				.text()
				.catch(() => "")}`,
		);
	}
	return response;
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
 * Performs a request against the GitHub GraphQL API
 * @param {string} query
 * @param {object} variables
 * @param {string} token
 * @returns {Promise<any>}
 */
async function ghGraphql(query, variables, token) {
	const response = await fetch(`${API_BASE}/graphql`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) {
		throw new Error(
			`GitHub GraphQL request failed with status ${response.status}: ${await response
				.text()
				.catch(() => "")}`,
		);
	}
	const result = await response.json();
	if (result.errors?.length) {
		throw new Error(
			`GitHub GraphQL request failed: ${JSON.stringify(result.errors)}`,
		);
	}
	return result.data;
}

module.exports = {
	ghRequest,
	ghPaginated,
	ghGraphql,
};
