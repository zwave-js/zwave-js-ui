// Characterizes the real activeSockets-driven lifecycle: setUserCallbacks() fires once for the first connection, removeUserCallbacks() fires once when the last client disconnects
import { describe, it, expect } from 'vitest'
import { useSocketHarness } from './harness.ts'
import { createFakeGateway } from './fakes.ts'

describe('Socket contract: first/last client callback lifecycle', () => {
	const getHarness = useSocketHarness()

	it('calls setUserCallbacks() exactly once when the first client connects, not again for a second', async () => {
		const gateway = createFakeGateway()
		const harness = await getHarness({ gateway })

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
		const harness = await getHarness({ gateway })

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
		const harness = await getHarness({ gateway })

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
		const harness = await getHarness({ gateway })

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
		const harness = await getHarness({
			gateway: createFakeGateway({ zwave: undefined }),
		})

		const client = harness.createClient()
		await expect(harness.connectClient(client)).resolves.toBe(client)
		client.disconnect()
		await harness.waitForServerSocketCount(0)
		// There's no zwave collaborator here for a callback to fire on
	})

	it('a gateway swapped in via testHooks between disconnect and reconnect is the one observed - the NEW gateway gets setUserCallbacks(), never a stale captured reference to the old one', async () => {
		// Real-Socket.IO counterpart to `registerSocketApi.ts`'s unit-level
		// "resolves the gateway fresh on every 'clients' firing" test
		// (`handlerUnits.test.ts`): here the swap happens between two REAL
		// connect/disconnect events on the real `SocketManager`, not by
		// directly re-invoking a captured callback.
		const gwA = createFakeGateway()
		harness.testHooks.setGateway(gwA as any)

		const clientA = harness.createClient()
		await harness.connectClient(clientA)
		expect(gwA.zwave.setUserCallbacks).toHaveBeenCalledOnce()

		clientA.disconnect()
		await harness.waitForServerSocketCount(0)
		expect(gwA.zwave.removeUserCallbacks).toHaveBeenCalledOnce()

		// Swap the gateway entirely before the next connection - production
		// would do this across a restart; here `testHooks` does it directly.
		const gwB = createFakeGateway()
		harness.testHooks.setGateway(gwB as any)

		const clientB = harness.createClient()
		await harness.connectClient(clientB)

		expect(gwB.zwave.setUserCallbacks).toHaveBeenCalledOnce()
		// The OLD gateway must never be touched again by a later event.
		expect(gwA.zwave.setUserCallbacks).toHaveBeenCalledOnce()
		expect(gwA.zwave.removeUserCallbacks).toHaveBeenCalledOnce()

		clientB.disconnect()
		await harness.waitForServerSocketCount(0)
		expect(gwB.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
		// Still just the one call from earlier - the last-client disconnect
		// after the swap must resolve gwB, never re-trigger gwA.
		expect(gwA.zwave.removeUserCallbacks).toHaveBeenCalledOnce()
	})
})
