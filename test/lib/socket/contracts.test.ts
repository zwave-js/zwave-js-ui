// Structural self-consistency checks against the real SocketEvents.ts exports - expectations are derived from channelMap/socketEvents/inboundEvents themselves, not from a separately hand-typed catalog that could drift unnoticed
import { describe, it, expect } from 'vitest'
import {
	ALL_CHANNELS,
	channelMap,
	eventToChannel,
	inboundEvents,
	socketEvents,
} from '#api/lib/SocketEvents.ts'

describe('Socket contract: inbound/outbound event + channel catalogs', () => {
	it('inboundEvents has no duplicate wire event names across its keys', () => {
		const values = Object.values(inboundEvents)
		expect(new Set(values).size).toBe(values.length)
	})

	it('socketEvents (outbound) has no duplicate wire event names across its keys', () => {
		const values = Object.values(socketEvents)
		expect(new Set(values).size).toBe(values.length)
	})

	it('every channel-mapped event literal is a real declared outbound event (a socketEvents value)', () => {
		const outboundValues = new Set(Object.values(socketEvents))
		for (const events of Object.values(channelMap)) {
			for (const evt of events) {
				expect(outboundValues.has(evt)).toBe(true)
			}
		}
	})

	it('no outbound event is mapped under more than one channel', () => {
		const seenBy = new Map<string, string>()
		for (const [channel, events] of Object.entries(channelMap)) {
			for (const evt of events) {
				expect(seenBy.has(evt)).toBe(false)
				seenBy.set(evt, channel)
			}
		}
	})

	it("ALL_CHANNELS is exactly channelMap's own keys, in declaration order", () => {
		expect(ALL_CHANNELS).toStrictEqual(Object.keys(channelMap))
	})

	it('eventToChannel is exactly the reverse index of channelMap', () => {
		const expectedReverse: Record<string, string> = {}
		for (const [channel, events] of Object.entries(channelMap)) {
			for (const evt of events) {
				expectedReverse[evt] = channel
			}
		}
		expect(eventToChannel).toStrictEqual(expectedReverse)
	})
})
