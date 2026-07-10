/**
 * Characterizes: the `'clients'` connect/disconnect callback lifecycle
 * wired at the bottom of `api/app.ts`'s `setupSocket()` -
 * `gw.zwave?.setUserCallbacks()` fires exactly when the FIRST client
 * connects (`activeSockets.size === 1` right after the new socket was
 * added), and `gw.zwave?.removeUserCallbacks()` fires exactly when the
 * LAST client disconnects (`activeSockets.size === 0` right after it was
 * removed) - both driven by `SocketManager`'s real `activeSockets` Map
 * (`api/lib/SocketManager.ts`), not a fake.
 *
 * One harness is shared for the whole file (`beforeAll`/`afterAll`).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createSocketHarness, type SocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

describe('Socket contract: first/last client callback lifecycle', () => {
	let harness: SocketHarness

	beforeAll(async () => {
		harness = await createSocketHarness()
	})

	afterAll(async () => {
		await harness.close()
	})

	afterEach(async () => {
		await harness.disconnectAllClients()
		harness.resetState()
	})

	it('calls setUserCallbacks() exactly once when the first client connects, not again for a second', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)

		const clientA = harness.createClient()
		await harness.connectClient(clientA)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		const clientB = harness.createClient()
		await harness.connectClient(clientB)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()
		expect(gateway.zwave.removeUserCallbacks).not.toHaveBeenCalled()
	})

	it('does not call removeUserCallbacks() while at least one client remains connected', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)

		const clientA = harness.createClient()
		const clientB = harness.createClient()
		await Promise.all([
			harness.connectClient(clientA),
			harness.connectClient(clientB),
		])
		await harness.waitForServerSocketCount(2)

		clientA.disconnect()
		await harness.waitForServerSocketCount(1)

		expect(gateway.zwave.removeUserCallbacks).not.toHaveBeenCalled()
	})

	it('calls removeUserCallbacks() exactly once when the last client disconnects', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)

		const clientA = harness.createClient()
		const clientB = harness.createClient()
		await Promise.all([
			harness.connectClient(clientA),
			harness.connectClient(clientB),
		])
		await harness.waitForServerSocketCount(2)

		clientA.disconnect()
		await harness.waitForServerSocketCount(1)
		clientB.disconnect()
		await harness.waitForServerSocketCount(0)

		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})

	it('re-fires setUserCallbacks()/removeUserCallbacks() across a full disconnect + reconnect cycle', async () => {
		const gateway = createFakeGateway()
		harness.testHooks.setGateway(gateway as any)

		const client = harness.createClient()
		await harness.connectClient(client)
		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		client.disconnect()
		await harness.waitForServerSocketCount(0)
		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()

		client.connect()
		await new Promise<void>((resolve, reject) => {
			client.once('connect', () => resolve())
			client.once('connect_error', (err: Error) => reject(err))
		})
		await harness.waitForServerSocketCount(1)

		expect(gateway.zwave.setUserCallbacks).toHaveBeenCalledTimes(2)
		expect(gateway.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})

	it('never throws/blocks when gw.zwave is undefined (optional chaining tolerates a disconnected client)', async () => {
		harness.testHooks.setGateway(
			createFakeGateway({ zwave: undefined }) as any,
		)

		const client = harness.createClient()
		await expect(harness.connectClient(client)).resolves.toBe(client)
		client.disconnect()
		await harness.waitForServerSocketCount(0)
		// No assertion beyond "didn't throw/hang" - there's no zwave
		// collaborator whose callbacks could have been (not) called.
	})
})
