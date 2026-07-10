/**
 * Characterizes: the Socket.IO wire-contract catalogs `api/app.ts`'s
 * real-time transport is built on - `inboundEvents` (client -> server),
 * `socketEvents` (server -> client), and the channel/room routing tables
 * (`channelMap`/`eventToChannel`/`ALL_CHANNELS`) - against independent,
 * hard-coded fixtures.
 *
 * Every fixture below was typed out by hand from reading
 * `api/lib/SocketEvents.ts` directly, NOT derived from (or copy-pasted out
 * of) the production constants under test - so a regression that silently
 * renames/adds/removes a literal, or moves an event to a different
 * channel, fails one of these `.toEqual()`/`.toStrictEqual()` comparisons
 * instead of the two copies just drifting together unnoticed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	ALL_CHANNELS,
	channelMap,
	eventToChannel,
	inboundEvents,
	socketEvents,
} from '../../../api/lib/SocketEvents.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')

/** Independent, hard-coded catalog of the 7 client -> server events. */
const EXPECTED_INBOUND_EVENTS = {
	init: 'INITED',
	zwave: 'ZWAVE_API',
	hass: 'HASS_API',
	mqtt: 'MQTT_API',
	zniffer: 'ZNIFFER_API',
	subscribe: 'SUBSCRIBE',
	unsubscribe: 'UNSUBSCRIBE',
} as const

/** Independent, hard-coded catalog of the 24 server -> client events. */
const EXPECTED_OUTBOUND_EVENTS = {
	init: 'INIT',
	controller: 'CONTROLLER_CMD',
	connected: 'CONNECTED',
	nodeFound: 'NODE_FOUND',
	nodeAdded: 'NODE_ADDED',
	nodeRemoved: 'NODE_REMOVED',
	nodeUpdated: 'NODE_UPDATED',
	valueUpdated: 'VALUE_UPDATED',
	valueRemoved: 'VALUE_REMOVED',
	metadataUpdated: 'METADATA_UPDATED',
	rebuildRoutesProgress: 'REBUILD_ROUTES_PROGRESS',
	healthCheckProgress: 'HEALTH_CHECK_PROGRESS',
	info: 'INFO',
	api: 'API_RETURN',
	debug: 'DEBUG',
	statistics: 'STATISTICS',
	nodeEvent: 'NODE_EVENT',
	grantSecurityClasses: 'GRANT_SECURITY_CLASSES',
	validateDSK: 'VALIDATE_DSK',
	inclusionAborted: 'INCLUSION_ABORTED',
	znifferFrame: 'ZNIFFER_FRAME',
	znifferState: 'ZNIFFER_STATE',
	linkReliability: 'LINK_RELIABILITY',
	otwFirmwareUpdate: 'OTW_FIRMWARE_UPDATE',
} as const

/** Independent, hard-coded channel -> event-literal room-routing table. */
const EXPECTED_CHANNEL_MAP: Record<string, string[]> = {
	controller: ['CONTROLLER_CMD', 'CONNECTED', 'INFO'],
	nodes: [
		'NODE_FOUND',
		'NODE_ADDED',
		'NODE_REMOVED',
		'NODE_UPDATED',
		'NODE_EVENT',
		'GRANT_SECURITY_CLASSES',
		'VALIDATE_DSK',
		'INCLUSION_ABORTED',
	],
	values: ['VALUE_UPDATED', 'VALUE_REMOVED', 'METADATA_UPDATED'],
	statistics: ['STATISTICS'],
	firmware: ['OTW_FIRMWARE_UPDATE'],
	debug: ['DEBUG'],
	znifferFrames: ['ZNIFFER_FRAME'],
	znifferState: ['ZNIFFER_STATE'],
	rebuild: ['REBUILD_ROUTES_PROGRESS'],
	diagnostics: ['HEALTH_CHECK_PROGRESS', 'LINK_RELIABILITY'],
}

const EXPECTED_ALL_CHANNELS = [
	'controller',
	'nodes',
	'values',
	'statistics',
	'firmware',
	'debug',
	'znifferFrames',
	'znifferState',
	'rebuild',
	'diagnostics',
]

describe('Socket contract: inbound/outbound event + channel catalogs', () => {
	it('has exactly 7 inbound (client -> server) events, matching the hard-coded catalog', () => {
		expect(Object.keys(inboundEvents)).toHaveLength(7)
		expect(inboundEvents).toStrictEqual(EXPECTED_INBOUND_EVENTS)
	})

	it('has exactly 24 outbound (server -> client) events, matching the hard-coded catalog', () => {
		expect(Object.keys(socketEvents)).toHaveLength(24)
		expect(socketEvents).toStrictEqual(EXPECTED_OUTBOUND_EVENTS)
	})

	it('has exactly 10 channels, matching the hard-coded channel/event routing table', () => {
		expect(Object.keys(channelMap)).toHaveLength(10)
		expect(channelMap).toStrictEqual(EXPECTED_CHANNEL_MAP)
	})

	it('ALL_CHANNELS matches the hard-coded channel-name list, in order', () => {
		expect(ALL_CHANNELS).toStrictEqual(EXPECTED_ALL_CHANNELS)
	})

	it('eventToChannel is the exact reverse index of the hard-coded channel map', () => {
		const expectedReverse: Record<string, string> = {}
		for (const [channel, events] of Object.entries(EXPECTED_CHANNEL_MAP)) {
			for (const evt of events) {
				expectedReverse[evt] = channel
			}
		}
		expect(eventToChannel).toStrictEqual(expectedReverse)
	})

	it('every channel-mapped event literal is one of the 24 declared outbound events', () => {
		const outboundValues = new Set(Object.values(EXPECTED_OUTBOUND_EVENTS))
		for (const events of Object.values(EXPECTED_CHANNEL_MAP)) {
			for (const evt of events) {
				expect(outboundValues.has(evt)).toBe(true)
			}
		}
	})

	describe('declared-but-unemitted outbound events', () => {
		/**
		 * Scans the real backend source (not test fixtures) for every place
		 * an outbound `socketEvents.<key>` literal is actually *used* as a
		 * producer (`sendToSocket(socketEvents.X, ...)`,
		 * `.emit(socketEvents.X, ...)`, `socket.emit(socketEvents.X, ...)`),
		 * OUTSIDE of `SocketEvents.ts` itself (which only *declares* them).
		 * This is a real regression check, not a hard-coded belief: if a
		 * future PR adds a producer for `CONNECTED` (or removes the last
		 * producer of some other event), this test's assertion changes
		 * with it instead of silently going stale.
		 */
		function countProducerUsages(key: string): number {
			const literal = EXPECTED_OUTBOUND_EVENTS[key]
			const files = [
				'api/app.ts',
				'api/lib/ZwaveClient.ts',
				'api/lib/ZnifferManager.ts',
				'api/lib/Gateway.ts',
			]
			const pattern = new RegExp(`socketEvents\\.${key}\\b`, 'g')
			let count = 0
			for (const file of files) {
				const text = readFileSync(path.join(repoRoot, file), 'utf8')
				count += (text.match(pattern) || []).length
			}
			return count
		}

		it('CONNECTED is declared and channel-mapped, but has zero real producers', () => {
			expect(countProducerUsages('connected')).toBe(0)
		})

		it('every other outbound event has at least one real producer call site', () => {
			const declaredKeys = Object.keys(EXPECTED_OUTBOUND_EVENTS)
			const unemitted = declaredKeys.filter(
				(key) => key !== 'connected' && countProducerUsages(key) === 0,
			)
			expect(unemitted).toEqual([])
		})
	})
})
