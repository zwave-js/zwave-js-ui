import * as fs from 'node:fs'
import * as path from 'node:path'
import { Server as SocketServer } from 'socket.io'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildNode } from './fixtures.ts'
import { cleanupTestEnv, ensureTestEnv } from './env.ts'
import type ZWaveClient from '#api/lib/ZwaveClient.ts'
import type jsonStoreType from '#api/lib/jsonStore.ts'
import type storeType from '#api/config/store.ts'

const HOME_ID = '0x12345678'
const OTHER_HOME_ID = '0x87654321'

let ZwaveClientConstructor: typeof ZWaveClient
let jsonStore: typeof jsonStoreType
let store: typeof storeType
let socket: SocketServer
let storeDir: string

function createClient(): ZWaveClient {
	const client = new ZwaveClientConstructor({}, socket)
	Object.defineProperty(client, 'homeHex', { value: HOME_ID })
	return client
}

describe('ZWaveClient HASS persistence integration', () => {
	beforeAll(async () => {
		storeDir = ensureTestEnv()
		;[
			{ default: ZwaveClientConstructor },
			{ default: jsonStore },
			{ default: store },
		] = await Promise.all([
			import('#api/lib/ZwaveClient.ts'),
			import('#api/lib/jsonStore.ts'),
			import('#api/config/store.ts'),
		])
		await jsonStore.init(store)
		socket = new SocketServer()
	})

	beforeEach(async () => {
		await jsonStore.put(store.nodes, {})
	})

	afterAll(() => {
		cleanupTestEnv()
	})

	it('updates only the active home in nodes.json', async () => {
		await jsonStore.put(store.nodes, {
			[HOME_ID]: { 2: { hassDevices: {} } },
			[OTHER_HOME_ID]: { 3: { hassDevices: { preserved: {} } } },
		})
		const client = createClient()
		client.nodes.set(2, buildNode({ id: 2, hassDevices: {} }))
		await client.getStoreNodes()

		await client.storeDevices(
			{
				switch: {
					type: 'switch',
					object_id: 'switch',
					discovery_payload: {},
				},
			},
			2,
			false,
		)

		expect(jsonStore.get(store.nodes)).toEqual({
			[HOME_ID]: {
				2: {
					hassDevices: {
						switch: expect.objectContaining({
							object_id: 'switch',
						}),
					},
				},
			},
			[OTHER_HOME_ID]: { 3: { hassDevices: { preserved: {} } } },
		})
	})

	it('migrates legacy flat node records into the active home', async () => {
		const legacyNodes = { 2: { hassDevices: {} } }
		await jsonStore.put(store.nodes, legacyNodes)
		const client = createClient()

		await client.getStoreNodes()

		expect(jsonStore.get(store.nodes)).toEqual({
			[HOME_ID]: legacyNodes,
		})
	})

	it('converts legacy node arrays before home scoping', async () => {
		const legacyNode = { hassDevices: {} }
		await jsonStore.put(store.nodes, [undefined, undefined, legacyNode])
		const client = createClient()

		await client.getStoreNodes()

		expect(jsonStore.get(store.nodes)).toEqual({
			[HOME_ID]: { 2: legacyNode },
		})
	})

	it('persists HASS device updates to the configured nodes file', async () => {
		await jsonStore.put(store.nodes, {
			[HOME_ID]: { 2: { hassDevices: {} } },
		})
		const client = createClient()
		client.nodes.set(2, buildNode({ id: 2, hassDevices: {} }))
		await client.getStoreNodes()

		await client.storeDevices(
			{
				switch: {
					type: 'switch',
					object_id: 'switch',
					discovery_payload: {},
				},
			},
			2,
			false,
		)

		expect(
			JSON.parse(
				fs.readFileSync(path.join(storeDir, store.nodes.file), 'utf8'),
			),
		).toEqual({
			[HOME_ID]: {
				2: {
					hassDevices: {
						switch: {
							type: 'switch',
							object_id: 'switch',
							discovery_payload: {},
							persistent: true,
						},
					},
				},
			},
		})
	})
})
