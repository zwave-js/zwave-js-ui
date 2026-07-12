import {
	describe,
	it,
	expect,
	vi,
	afterEach,
} from 'vitest'
import { InclusionCoordinator } from '../../../api/lib/zwave/InclusionCoordinator.ts'
import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionDriverPort,
	InclusionGrantRef,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
	ServiceLogger,
} from '../../../api/lib/zwave/ports.ts'

// ---------------------------------------------------------------------------
// Helpers: minimal fakes for ports
// ---------------------------------------------------------------------------

function createDriverPort(
	overrides: Partial<ReturnType<InclusionDriverPort['getDriver']>> = {},
): InclusionDriverPort {
	const controller = {
		inclusionState: undefined as unknown,
		beginInclusion: vi.fn().mockResolvedValue(true),
		stopInclusion: vi.fn().mockResolvedValue(true),
		beginExclusion: vi.fn().mockResolvedValue(true),
		stopExclusion: vi.fn().mockResolvedValue(true),
		replaceFailedNode: vi.fn().mockResolvedValue(true),
		beginJoiningNetwork: vi.fn().mockResolvedValue({ success: true }),
		stopJoiningNetwork: vi.fn().mockResolvedValue(true),
		...overrides,
	}
	return {
		isDriverReady: () => true,
		getDriver: () => ({
			controller,
			updateOptions: vi.fn(),
			...overrides,
		}),
	} as InclusionDriverPort
}

function createSocketPort(): InclusionSocketPort & {
	sendToSocket: ReturnType<typeof vi.fn>
} {
	return {
		sendToSocket: vi.fn(),
	}
}

function createBackupPort(): InclusionBackupPort & {
	backupNvm: ReturnType<typeof vi.fn>
} {
	return {
		backupOnEvent: false,
		backupNvm: vi.fn().mockResolvedValue(undefined),
	}
}

function createConfigPort(timeout = 30): InclusionConfigPort {
	return {
		commandsTimeout: timeout,
		serverEnabled: true,
	}
}

function createQRPort(
	parsedResult?: { version: number; [k: string]: unknown },
): InclusionQRPort {
	return {
		parseQRCodeString: vi.fn().mockResolvedValue(parsedResult),
	}
}

function createLogger(): ServiceLogger & {
	info: ReturnType<typeof vi.fn>
	warn: ReturnType<typeof vi.fn>
	error: ReturnType<typeof vi.fn>
} {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}

const DEFAULT_SOCKET_EVENTS = {
	grantSecurityClasses: 'GRANT_SECURITY_CLASSES',
	validateDSK: 'VALIDATE_DSK',
	inclusionAborted: 'INCLUSION_ABORTED',
	controller: 'CONTROLLER',
}

function createCoordinator(overrides: {
	driver?: InclusionDriverPort
	socket?: ReturnType<typeof createSocketPort>
	backup?: ReturnType<typeof createBackupPort>
	config?: InclusionConfigPort
	qr?: InclusionQRPort
	logger?: ReturnType<typeof createLogger>
	serverManager?: InclusionServerManagerPort | undefined
	nvmEventSetter?: (event: string) => void
} = {}) {
	const driver = overrides.driver ?? createDriverPort()
	const socket = overrides.socket ?? createSocketPort()
	const backup = overrides.backup ?? createBackupPort()
	const config = overrides.config ?? createConfigPort()
	const qr = overrides.qr ?? createQRPort()
	const logger = overrides.logger ?? createLogger()
	const serverManager = overrides.serverManager ?? undefined
	const nvmEventSetter = overrides.nvmEventSetter ?? vi.fn()

	const coordinator = new InclusionCoordinator(
		driver,
		socket,
		backup,
		config,
		qr,
		logger,
		() => serverManager,
		nvmEventSetter,
		DEFAULT_SOCKET_EVENTS,
	)

	return { coordinator, driver, socket, backup, config, qr, logger, nvmEventSetter }
}

// Strategy constants matching zwave-js
const STRATEGY_DEFAULT = 0
const STRATEGY_SECURITY_S2 = 1
const STRATEGY_INSECURE = 2
const STRATEGY_SECURITY_S0 = 3
const STRATEGY_SMART_START = 4

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InclusionCoordinator', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	describe('startInclusion', () => {
		it('calls beginInclusion with default strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{},
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1,
				0,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith(
				expect.objectContaining({ strategy: STRATEGY_DEFAULT }),
			)
		})

		it('throws for SmartStart strategy', async () => {
			const { coordinator } = createCoordinator()

			await expect(
				coordinator.startInclusion(
					STRATEGY_SMART_START,
					{},
					undefined,
					STRATEGY_SMART_START,
					STRATEGY_SECURITY_S2,
					STRATEGY_DEFAULT,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
					1,
					0,
				),
			).rejects.toThrow('Smart Start')
		})

		it('sets tmpNode from options', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Test', location: 'Room' },
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1,
				0,
			)

			expect(coordinator.tmpNode).toEqual({
				name: 'Test',
				loc: 'Room',
			})
		})

		it('performs NVM backup when backupOnEvent is true', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true
			const nvmSetter = vi.fn()
			const { coordinator } = createCoordinator({
				backup,
				nvmEventSetter: nvmSetter,
			})

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{},
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1,
				0,
			)

			expect(nvmSetter).toHaveBeenCalledWith('before_start_inclusion')
			expect(backup.backupNvm).toHaveBeenCalled()
		})

		it('throws when driver is not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(
				coordinator.startInclusion(
					STRATEGY_DEFAULT,
					{},
					undefined,
					STRATEGY_SMART_START,
					STRATEGY_SECURITY_S2,
					STRATEGY_DEFAULT,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
					1,
					0,
				),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('startExclusion', () => {
		it('calls beginExclusion', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.startExclusion({ strategy: 0 })
			expect(drv.controller.beginExclusion).toHaveBeenCalledWith({
				strategy: 0,
			})
		})

		it('performs NVM backup when backupOnEvent is true', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true
			const { coordinator } = createCoordinator({ backup })

			await coordinator.startExclusion({ strategy: 0 })
			expect(backup.backupNvm).toHaveBeenCalled()
		})
	})

	describe('stopExclusion', () => {
		it('calls stopExclusion on driver', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.stopExclusion()
			expect(drv.controller.stopExclusion).toHaveBeenCalled()
		})
	})

	describe('stopInclusion', () => {
		it('calls stopInclusion on driver', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.stopInclusion()
			expect(drv.controller.stopInclusion).toHaveBeenCalled()
		})
	})

	describe('replaceFailedNode', () => {
		it('calls replaceFailedNode with S2 strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S2,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(
				5,
				expect.objectContaining({ strategy: STRATEGY_SECURITY_S2 }),
			)
			expect(coordinator.isReplacing).toBe(true)
		})

		it('resets isReplacing on error', async () => {
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn(),
						stopInclusion: vi.fn(),
						beginExclusion: vi.fn(),
						stopExclusion: vi.fn(),
						replaceFailedNode: vi.fn().mockRejectedValue(new Error('failed')),
						beginJoiningNetwork: vi.fn(),
						stopJoiningNetwork: vi.fn(),
					},
					updateOptions: vi.fn(),
				}),
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			await expect(
				coordinator.replaceFailedNode(
					5,
					STRATEGY_SECURITY_S2,
					{},
					STRATEGY_SECURITY_S2,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
				),
			).rejects.toThrow('failed')
			expect(coordinator.isReplacing).toBe(false)
		})

		it('throws for unsupported strategy', async () => {
			const { coordinator } = createCoordinator()

			await expect(
				coordinator.replaceFailedNode(
					5,
					99,
					{},
					STRATEGY_SECURITY_S2,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
				),
			).rejects.toThrow('not supported')
		})
	})

	describe('startLearnMode / stopLearnMode', () => {
		it('calls beginJoiningNetwork', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.startLearnMode(0)
			expect(drv.controller.beginJoiningNetwork).toHaveBeenCalledWith(
				expect.objectContaining({ strategy: 0 }),
			)
		})

		it('calls stopJoiningNetwork', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()!

			await coordinator.stopLearnMode()
			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalled()
		})
	})

	describe('grantSecurityClasses / validateDSK / abortInclusion', () => {
		it('resolves grant promise when grantSecurityClasses called', async () => {
			const { coordinator, socket } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1, 2],
				clientSideAuth: false,
			})

			// socket emission happened
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'GRANT_SECURITY_CLASSES',
				expect.objectContaining({ securityClasses: [1, 2] }),
			)

			// Now resolve it
			coordinator.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})

			const result = await grantPromise
			expect(result).toEqual({
				securityClasses: [1],
				clientSideAuth: false,
			})
		})

		it('resolves DSK promise when validateDSK called', async () => {
			const { coordinator, socket } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'VALIDATE_DSK',
				'12345-67890',
			)

			coordinator.validateDSK('12345')
			const result = await dskPromise
			expect(result).toBe('12345')
		})

		it('abortInclusion resolves with false', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})
			const dskPromise = callbacks.validateDSKAndEnterPIN('12345')

			coordinator.abortInclusion()

			expect(await grantPromise).toBe(false)
			expect(await dskPromise).toBe(false)
		})

		it('logs error when no inclusion process started', () => {
			const logger = createLogger()
			const { coordinator } = createCoordinator({ logger })

			coordinator.grantSecurityClasses({
				securityClasses: [],
				clientSideAuth: false,
			})
			expect(logger.error).toHaveBeenCalledWith(
				'No inclusion process started',
			)

			coordinator.validateDSK('1234')
			expect(logger.error).toHaveBeenCalledTimes(2)
		})
	})

	describe('setUserCallbacks / removeUserCallbacks', () => {
		it('sets hasUserCallbacks and updates driver options', () => {
			const updateOptionsMock = vi.fn()
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn(),
						stopInclusion: vi.fn(),
						beginExclusion: vi.fn(),
						stopExclusion: vi.fn(),
						replaceFailedNode: vi.fn(),
						beginJoiningNetwork: vi.fn(),
						stopJoiningNetwork: vi.fn(),
					},
					updateOptions: updateOptionsMock,
				}),
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			coordinator.setUserCallbacks()
			expect(coordinator.hasUserCallbacks).toBe(true)
			expect(updateOptionsMock).toHaveBeenCalledWith(
				expect.objectContaining({
					inclusionUserCallbacks: expect.any(Object),
				}),
			)
		})

		it('removes callbacks and hands control back', () => {
			const serverManager: InclusionServerManagerPort = {
				handInclusionControlBack: vi.fn(),
			}
			const updateOptionsMock = vi.fn()
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn(),
						stopInclusion: vi.fn(),
						beginExclusion: vi.fn(),
						stopExclusion: vi.fn(),
						replaceFailedNode: vi.fn(),
						beginJoiningNetwork: vi.fn(),
						stopJoiningNetwork: vi.fn(),
					},
					updateOptions: updateOptionsMock,
				}),
			}
			const { coordinator } = createCoordinator({
				driver: driverPort,
				serverManager,
			})

			coordinator.setUserCallbacks()
			coordinator.removeUserCallbacks()

			expect(coordinator.hasUserCallbacks).toBe(false)
			expect(updateOptionsMock).toHaveBeenLastCalledWith({
				inclusionUserCallbacks: undefined,
			})
			expect(serverManager.handInclusionControlBack).toHaveBeenCalled()
		})
	})

	describe('onInclusionStateChanged', () => {
		it('updates state and sends socket message', () => {
			const { coordinator, socket } = createCoordinator()

			coordinator.onInclusionStateChanged('including', 'Active', undefined)
			expect(coordinator.inclusionState).toBe('including')
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'CONTROLLER',
				expect.objectContaining({ inclusionState: 'including' }),
			)
		})

		it('does not emit when state unchanged', () => {
			const { coordinator, socket } = createCoordinator()

			coordinator.onInclusionStateChanged('idle', 'Ready', undefined)
			coordinator.onInclusionStateChanged('idle', 'Ready', undefined)
			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
		})
	})

	describe('onInclusionFailed', () => {
		it('resets state and removes ghost nodes', () => {
			const { coordinator } = createCoordinator()
			coordinator.onNodeFound(10)
			coordinator.onNodeFound(11)

			const removed: number[] = []
			coordinator.onInclusionFailed((nodeId) => removed.push(nodeId))

			expect(removed).toContain(10)
			expect(removed).toContain(11)
			expect(coordinator.isReplacing).toBe(false)
			expect(coordinator.tmpNode).toBeUndefined()
			expect(coordinator.pendingInclusionNodeIds.size).toBe(0)
		})
	})

	describe('onNodeFound / onNodeAdded', () => {
		it('tracks and clears pending node IDs', () => {
			const { coordinator } = createCoordinator()

			coordinator.onNodeFound(5)
			expect(coordinator.pendingInclusionNodeIds.has(5)).toBe(true)

			coordinator.onNodeAdded(5)
			expect(coordinator.pendingInclusionNodeIds.has(5)).toBe(false)
		})
	})

	describe('syncFromDriver', () => {
		it('reads inclusion state from driver', () => {
			const driver = createDriverPort({ inclusionState: 'idle' } as any)
			const { coordinator } = createCoordinator({ driver })

			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBe('idle')
		})
	})

	describe('reset', () => {
		it('clears all state', () => {
			const { coordinator } = createCoordinator()
			coordinator.onNodeFound(5)

			coordinator.reset()
			expect(coordinator.pendingInclusionNodeIds.size).toBe(0)
			expect(coordinator.isReplacing).toBe(false)
			expect(coordinator.tmpNode).toBeUndefined()
		})
	})

	describe('abort callback (_onAbortInclusion)', () => {
		it('emits inclusionAborted socket event', () => {
			const { coordinator, socket } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			callbacks.abort()
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'INCLUSION_ABORTED',
				true,
			)
		})
	})
})
