// @ts-check

import { describe, expect, it } from "vitest";
import { lastTransferTime } from "./utils.cjs";

describe("lastTransferTime", () => {
	it("returns 0 when the issue was never transferred", () => {
		expect(lastTransferTime([
			{ event: "labeled", created_at: "2026-01-01T00:00:00Z" },
			{ event: "committed" },
		])).toBe(0);
	});

	it("returns the transfer timestamp", () => {
		expect(lastTransferTime([
			{ event: "labeled", created_at: "2026-01-01T00:00:00Z" },
			{ event: "transferred", created_at: "2026-01-02T00:00:00Z" },
		])).toBe(new Date("2026-01-02T00:00:00Z").getTime());
	});

	it("returns the newest of multiple transfers, regardless of order", () => {
		expect(lastTransferTime([
			{ event: "transferred", created_at: "2026-01-03T00:00:00Z" },
			{ event: "transferred", created_at: "2026-01-02T00:00:00Z" },
		])).toBe(new Date("2026-01-03T00:00:00Z").getTime());
	});
});
