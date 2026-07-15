// @ts-check

import { describe, it, expect } from "vitest";
import {
	getRetryDelayMs,
	getGraphqlRetryDelayMs,
} from "./githubApi.cjs";

/**
 * @param {number} status
 * @param {Record<string, string>} headers
 * @param {string} body
 */
function mockResponse(status, headers = {}, body = "") {
	const headerMap = new Map(
		Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
	);
	return {
		status,
		headers: { get: (/** @type {string} */ name) => headerMap.get(name.toLowerCase()) ?? null },
		clone() {
			return this;
		},
		async text() {
			return body;
		},
	};
}

describe("githubApi", () => {
	describe("getRetryDelayMs", () => {
		it("does not retry a plain 404", async () => {
			expect(await getRetryDelayMs(mockResponse(404), 0)).toBeUndefined();
		});

		it("does not retry a plain 403 without retry-after or a rate-limit body", async () => {
			expect(
				await getRetryDelayMs(
					mockResponse(403, {}, "You do not have permission"),
					0,
				),
			).toBeUndefined();
		});

		it("honors Retry-After (seconds) for a 429", async () => {
			expect(
				await getRetryDelayMs(mockResponse(429, { "Retry-After": "3" }), 0),
			).toBe(3000);
		});

		it("retries a secondary rate limit 403 identified by Retry-After", async () => {
			expect(
				await getRetryDelayMs(mockResponse(403, { "Retry-After": "2" }), 0),
			).toBe(2000);
		});

		it("retries a secondary rate limit 403 identified by body text", async () => {
			const delay = await getRetryDelayMs(
				mockResponse(403, {}, "You have exceeded a secondary rate limit"),
				0,
			);
			expect(delay).toBeGreaterThan(0);
		});

		it("falls back to x-ratelimit-reset when Retry-After is absent", async () => {
			const resetAt = Math.floor(Date.now() / 1000) + 5;
			const delay = await getRetryDelayMs(
				mockResponse(429, { "x-ratelimit-reset": String(resetAt) }),
				0,
			);
			expect(delay).toBeGreaterThan(0);
			expect(delay).toBeLessThanOrEqual(5000);
		});

		it("falls back to exponential backoff for a bare 5xx", async () => {
			expect(await getRetryDelayMs(mockResponse(502), 0)).toBe(1000);
			expect(await getRetryDelayMs(mockResponse(502), 2)).toBe(4000);
		});

		it("keeps backing off exponentially up to the last allowed attempt", async () => {
			// MAX_RETRIES=5 means attempts 0-4 are retried; the 60s cap
			// exists as a defensive ceiling for future higher retry counts
			expect(await getRetryDelayMs(mockResponse(502), 4)).toBe(16_000);
		});

		it("stops retrying once the max retry count is reached", async () => {
			expect(await getRetryDelayMs(mockResponse(429), 5)).toBeUndefined();
			expect(await getRetryDelayMs(mockResponse(502), 5)).toBeUndefined();
		});
	});

	describe("getGraphqlRetryDelayMs", () => {
		it("retries rate-limit errors returned with HTTP 200", () => {
			const response = mockResponse(200, { "Retry-After": "2" });
			expect(
				getGraphqlRetryDelayMs(
					response,
					[{ type: "RATE_LIMITED", message: "API rate limit exceeded" }],
					0,
				),
			).toBe(2000);
		});

		it("does not retry ordinary GraphQL errors", () => {
			expect(
				getGraphqlRetryDelayMs(
					mockResponse(200),
					[{ type: "NOT_FOUND", message: "Could not resolve node" }],
					0,
				),
			).toBeUndefined();
		});

		it("stops retrying GraphQL rate limits at the retry cap", () => {
			expect(
				getGraphqlRetryDelayMs(
					mockResponse(200),
					[{ message: "You have exceeded a secondary rate limit" }],
					5,
				),
			).toBeUndefined();
		});
	});
});
