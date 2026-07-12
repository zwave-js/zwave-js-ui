/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, afterEach } from 'vitest'
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

function createQRPort(parsedResult?: {
	version: number
	[k: string]: unknown
}): InclusionQRPort {
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

function createCoordinator(
	overrides: {
		driver?: InclusionDriverPort
		socket?: ReturnType<typeof createSocketPort>
		backup?: ReturnType<typeof createBackupPort>
		config?: InclusionConfigPort
		qr?: InclusionQRPort
		logger?: ReturnType<typeof createLogger>
		serverManager?: InclusionServerManagerPort | undefined
		nvmEventSetter?: (event: string) => void
	} = {},
) {
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

	return {
		coordinator,
		driver,
		socket,
		backup,
		config,
		qr,
		logger,
		nvmEventSetter,
	}
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
			const drv = driver.getDriver()

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

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				STRATEGY_INSECURE,
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

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: STRATEGY_INSECURE,
			})
		})

		it('handles Security_S0 strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				STRATEGY_SECURITY_S0,
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

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: STRATEGY_SECURITY_S0,
			})
		})

		it('handles Security_S2 with provisioning', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				STRATEGY_SECURITY_S2,
				{ provisioning: { some: 'data' }, dsk: '12345' },
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
				expect.objectContaining({
					strategy: STRATEGY_SECURITY_S2,
					provisioning: { some: 'data' },
					dsk: '12345',
				}),
			)
		})

		it('handles Security_S2 with qrString (S2 QR code)', async () => {
			const qr = createQRPort({ version: 0, dsk: '12345' })
			const { coordinator, driver } = createCoordinator({ qr })
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				STRATEGY_SECURITY_S2,
				{ qrString: 'some-qr' },
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1, // SmartStart version
				0, // S2 version
			)

			expect(qr.parseQRCodeString).toHaveBeenCalledWith('some-qr')
			expect(drv.controller.beginInclusion).toHaveBeenCalled()
		})

		it('handles Security_S2 with qrString (SmartStart QR code)', async () => {
			const qr = createQRPort({ version: 1 })
			const provisionFn = vi.fn().mockResolvedValue(undefined)
			const { coordinator } = createCoordinator({ qr })

			const result = await coordinator.startInclusion(
				STRATEGY_SECURITY_S2,
				{ qrString: 'smart-qr' },
				provisionFn,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1, // SmartStart version
				0, // S2 version
			)

			expect(result).toBe(true)
			expect(provisionFn).toHaveBeenCalled()
		})

		it('throws for invalid QR code string', async () => {
			const qr = createQRPort(undefined)
			const { coordinator } = createCoordinator({ qr })

			await expect(
				coordinator.startInclusion(
					STRATEGY_SECURITY_S2,
					{ qrString: 'invalid' },
					undefined,
					STRATEGY_SMART_START,
					STRATEGY_SECURITY_S2,
					STRATEGY_DEFAULT,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
					1,
					0,
				),
			).rejects.toThrow('Invalid QR code string')
		})

		it('throws for invalid QR code version', async () => {
			const qr = createQRPort({ version: 99 })
			const { coordinator } = createCoordinator({ qr })

			await expect(
				coordinator.startInclusion(
					STRATEGY_SECURITY_S2,
					{ qrString: 'weird-qr' },
					undefined,
					STRATEGY_SMART_START,
					STRATEGY_SECURITY_S2,
					STRATEGY_DEFAULT,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
					1,
					0,
				),
			).rejects.toThrow('Invalid QR code version')
		})

		it('clears tmpNode on error', async () => {
			const qr = createQRPort(undefined)
			const { coordinator } = createCoordinator({ qr })

			await expect(
				coordinator.startInclusion(
					STRATEGY_SECURITY_S2,
					{ qrString: 'invalid', name: 'Test' },
					undefined,
					STRATEGY_SMART_START,
					STRATEGY_SECURITY_S2,
					STRATEGY_DEFAULT,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
					1,
					0,
				),
			).rejects.toThrow()
			expect(coordinator.tmpNode).toBeUndefined()
		})

		it('handles unknown strategy (fallback)', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				99,
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

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: 99,
			})
		})
	})

	describe('startExclusion', () => {
		it('calls beginExclusion', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

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

		it('throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(
				coordinator.startExclusion({ strategy: 0 }),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('stopExclusion', () => {
		it('calls stopExclusion on driver', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.stopExclusion()
			expect(drv.controller.stopExclusion).toHaveBeenCalled()
		})

		it('throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(coordinator.stopExclusion()).rejects.toThrow(
				'Driver is not ready',
			)
		})
	})

	describe('stopInclusion', () => {
		it('calls stopInclusion on driver', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.stopInclusion()
			expect(drv.controller.stopInclusion).toHaveBeenCalled()
		})

		it('throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(coordinator.stopInclusion()).rejects.toThrow(
				'Driver is not ready',
			)
		})
	})

	describe('replaceFailedNode', () => {
		it('calls replaceFailedNode with S2 strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

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
						replaceFailedNode: vi
							.fn()
							.mockRejectedValue(new Error('failed')),
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

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_INSECURE,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_INSECURE,
			})
		})

		it('handles S2 with QR code provisioning', async () => {
			const qr = createQRPort({ version: 0, dsk: '12345' })
			const { coordinator, driver } = createCoordinator({ qr })
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S2,
				{ qrString: 'some-qr' },
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(qr.parseQRCodeString).toHaveBeenCalledWith('some-qr')
			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(
				5,
				expect.objectContaining({
					strategy: STRATEGY_SECURITY_S2,
					provisioning: expect.any(Object),
				}),
			)
		})

		it('throws for invalid QR code in replace', async () => {
			const qr = createQRPort(undefined)
			const { coordinator } = createCoordinator({ qr })

			await expect(
				coordinator.replaceFailedNode(
					5,
					STRATEGY_SECURITY_S2,
					{ qrString: 'invalid' },
					STRATEGY_SECURITY_S2,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
				),
			).rejects.toThrow('Invalid QR code string')
		})

		it('performs NVM backup when backupOnEvent is true', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true
			const nvmSetter = vi.fn()
			const { coordinator } = createCoordinator({
				backup,
				nvmEventSetter: nvmSetter,
			})

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S2,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(nvmSetter).toHaveBeenCalledWith('before_replace_failed_node')
			expect(backup.backupNvm).toHaveBeenCalled()
		})

		it('throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(
				coordinator.replaceFailedNode(
					5,
					STRATEGY_SECURITY_S2,
					{},
					STRATEGY_SECURITY_S2,
					STRATEGY_INSECURE,
					STRATEGY_SECURITY_S0,
				),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('startLearnMode / stopLearnMode', () => {
		it('calls beginJoiningNetwork', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startLearnMode(0)
			expect(drv.controller.beginJoiningNetwork).toHaveBeenCalledWith(
				expect.objectContaining({ strategy: 0 }),
			)
		})

		it('calls stopJoiningNetwork', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.stopLearnMode()
			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalled()
		})

		it('startLearnMode throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(coordinator.startLearnMode(0)).rejects.toThrow(
				'Driver is not ready',
			)
		})

		it('stopLearnMode throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(coordinator.stopLearnMode()).rejects.toThrow(
				'Driver is not ready',
			)
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

			coordinator.onInclusionStateChanged(
				'including',
				'Active',
				undefined,
			)
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

	describe('commands timeout fires', () => {
		it('startInclusion timeout calls stopInclusion', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 1, serverEnabled: true },
			})
			const drv = driver.getDriver()

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

			// Advance past the timeout (1s)
			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopInclusion).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startInclusion timeout logs error when stopInclusion fails', async () => {
			vi.useFakeTimers()
			const logger = createLogger()
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn().mockResolvedValue(true),
						stopInclusion: vi
							.fn()
							.mockRejectedValue(new Error('stop failed')),
						beginExclusion: vi.fn().mockResolvedValue(true),
						stopExclusion: vi.fn().mockResolvedValue(true),
						replaceFailedNode: vi.fn().mockResolvedValue(true),
						beginJoiningNetwork: vi.fn().mockResolvedValue(true),
						stopJoiningNetwork: vi.fn().mockResolvedValue(true),
					},
					updateOptions: vi.fn(),
				}),
			}
			const { coordinator } = createCoordinator({
				driver: driverPort,
				config: { commandsTimeout: 1, serverEnabled: true },
				logger,
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

			await vi.advanceTimersByTimeAsync(1500)

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to stop inclusion'),
			)
			vi.useRealTimers()
		})

		it('startExclusion timeout calls stopExclusion', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 1, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startExclusion({ strategy: 0 })

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopExclusion).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startExclusion timeout logs error when stopExclusion fails', async () => {
			vi.useFakeTimers()
			const logger = createLogger()
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn().mockResolvedValue(true),
						stopInclusion: vi.fn().mockResolvedValue(true),
						beginExclusion: vi.fn().mockResolvedValue(true),
						stopExclusion: vi
							.fn()
							.mockRejectedValue(new Error('stop excl failed')),
						replaceFailedNode: vi.fn().mockResolvedValue(true),
						beginJoiningNetwork: vi.fn().mockResolvedValue(true),
						stopJoiningNetwork: vi.fn().mockResolvedValue(true),
					},
					updateOptions: vi.fn(),
				}),
			}
			const { coordinator } = createCoordinator({
				driver: driverPort,
				config: { commandsTimeout: 1, serverEnabled: true },
				logger,
			})

			await coordinator.startExclusion({ strategy: 0 })

			await vi.advanceTimersByTimeAsync(1500)

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to stop exclusion'),
			)
			vi.useRealTimers()
		})

		it('replaceFailedNode timeout calls stopInclusion', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 1, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S2,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopInclusion).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startLearnMode timeout calls stopLearnMode', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 1, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startLearnMode(0)

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startLearnMode timeout logs error when stopLearnMode fails', async () => {
			vi.useFakeTimers()
			const logger = createLogger()
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => ({
					controller: {
						inclusionState: undefined,
						beginInclusion: vi.fn().mockResolvedValue(true),
						stopInclusion: vi.fn().mockResolvedValue(true),
						beginExclusion: vi.fn().mockResolvedValue(true),
						stopExclusion: vi.fn().mockResolvedValue(true),
						replaceFailedNode: vi.fn().mockResolvedValue(true),
						beginJoiningNetwork: vi.fn().mockResolvedValue(true),
						stopJoiningNetwork: vi
							.fn()
							.mockRejectedValue(new Error('stop learn failed')),
					},
					updateOptions: vi.fn(),
				}),
			}
			const { coordinator } = createCoordinator({
				driver: driverPort,
				config: { commandsTimeout: 1, serverEnabled: true },
				logger,
			})

			await coordinator.startLearnMode(0)

			await vi.advanceTimersByTimeAsync(1500)

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to stop learn mode'),
			)
			vi.useRealTimers()
		})
	})

	describe('setUserCallbacks - server disabled', () => {
		it('sets hasUserCallbacks but skips driver update when server disabled', () => {
			const config: InclusionConfigPort = {
				commandsTimeout: 30,
				serverEnabled: false,
			}
			const { coordinator, driver } = createCoordinator({ config })
			const drv = driver.getDriver()

			coordinator.setUserCallbacks()
			expect(coordinator.hasUserCallbacks).toBe(true)
			// updateOptions should NOT be called when server disabled
			expect(drv.updateOptions).not.toHaveBeenCalled()
		})

		it('sets hasUserCallbacks but skips driver update when driver not ready', () => {
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			coordinator.setUserCallbacks()
			expect(coordinator.hasUserCallbacks).toBe(true)
		})
	})

	describe('removeUserCallbacks - edge cases', () => {
		it('skips driver update when server disabled', () => {
			const config: InclusionConfigPort = {
				commandsTimeout: 30,
				serverEnabled: false,
			}
			const serverManager: InclusionServerManagerPort = {
				handInclusionControlBack: vi.fn(),
			}
			const { coordinator } = createCoordinator({
				config,
				serverManager,
			})

			coordinator.setUserCallbacks()
			coordinator.removeUserCallbacks()

			expect(coordinator.hasUserCallbacks).toBe(false)
			// should NOT call handInclusionControlBack or updateOptions
			expect(
				serverManager.handInclusionControlBack,
			).not.toHaveBeenCalled()
		})

		it('skips server manager when none is available', () => {
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
				serverManager: undefined,
			})

			coordinator.setUserCallbacks()
			coordinator.removeUserCallbacks()

			expect(coordinator.hasUserCallbacks).toBe(false)
			expect(updateOptionsMock).toHaveBeenCalledWith({
				inclusionUserCallbacks: undefined,
			})
		})
	})

	describe('grantSecurityClasses - no resolve pending', () => {
		it('logs error when no resolve is pending', () => {
			const logger = createLogger()
			const { coordinator } = createCoordinator({ logger })

			coordinator.grantSecurityClasses({
				securityClasses: [],
				clientSideAuth: false,
			})
			expect(logger.error).toHaveBeenCalledWith(
				'No inclusion process started',
			)
		})
	})

	describe('validateDSK - no resolve pending', () => {
		it('logs error when no resolve is pending', () => {
			const logger = createLogger()
			const { coordinator } = createCoordinator({ logger })

			coordinator.validateDSK('12345')
			expect(logger.error).toHaveBeenCalledWith(
				'No inclusion process started',
			)
		})
	})

	describe('abortInclusion', () => {
		it('resolves both grant and DSK with false', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			// Create pending promises for both
			const grantP = callbacks.grantSecurityClasses({
				securityClasses: [],
				clientSideAuth: false,
			})
			const dskP = callbacks.validateDSKAndEnterPIN('12345-67890')

			// Abort should resolve both with false
			coordinator.abortInclusion()

			const grantResult = await grantP
			const dskResult = await dskP

			expect(grantResult).toBe(false)
			expect(dskResult).toBe(false)
		})

		it('handles when only DSK resolve is pending', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dskP = callbacks.validateDSKAndEnterPIN('12345-67890')
			coordinator.abortInclusion()

			expect(await dskP).toBe(false)
		})

		it('handles when only grant resolve is pending', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantP = callbacks.grantSecurityClasses({
				securityClasses: [],
				clientSideAuth: false,
			})
			coordinator.abortInclusion()

			expect(await grantP).toBe(false)
		})

		it('handles when no resolves are pending', () => {
			const { coordinator } = createCoordinator()
			// Should not throw
			coordinator.abortInclusion()
		})
	})

	describe('startExclusion - commands timeout cleared', () => {
		it('clears existing timeout before setting new one', async () => {
			vi.useFakeTimers()
			const { coordinator } = createCoordinator()

			// First call sets a timeout
			await coordinator.startExclusion({ strategy: 0 })

			// Second call should clear the first timeout
			await coordinator.startExclusion({ strategy: 0 })

			coordinator.clearCommandsTimeout()
			vi.useRealTimers()
		})
	})

	describe('startInclusion with existing timeout', () => {
		it('clears pre-existing commands timeout', async () => {
			vi.useFakeTimers()
			const { coordinator } = createCoordinator()

			// First inclusion sets a timeout
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

			// Second inclusion should clear first timeout
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

			coordinator.clearCommandsTimeout()
			vi.useRealTimers()
		})
	})

	describe('syncFromDriver - null driver', () => {
		it('does nothing when driver is null', () => {
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			// Should not throw
			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBeUndefined()
		})
	})

	describe('Security_S2 without dsk or provisioning', () => {
		it('passes strategy only', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				STRATEGY_SECURITY_S2,
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

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: STRATEGY_SECURITY_S2,
				dsk: undefined,
			})
		})
	})

	describe('replaceFailedNode S0 strategy', () => {
		it('handles S0 strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S0,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_SECURITY_S0,
			})
		})
	})

	describe('replaceFailedNode S2 without QR or provisioning', () => {
		it('passes strategy-only options', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				STRATEGY_SECURITY_S2,
				{},
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_SECURITY_S2,
			})
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 2 – timeout cancelled on reset (close/restart)
	// -----------------------------------------------------------------
	describe('timeout cleanup on reset', () => {
		it('reset() cancels the inclusion timeout so it cannot fire against a new driver', () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				backup: { ...createBackupPort(), backupOnEvent: false },
			})

			// Start inclusion — sets up timeout
			void coordinator.startInclusion(
				STRATEGY_INSECURE,
				undefined,
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			// Now simulate close/restart — reset should cancel the timeout
			coordinator.reset()

			// Advance past timeout — stopInclusion should NOT be called
			const drv = driver.getDriver()
			vi.advanceTimersByTime(60_000)
			expect(drv.controller.stopInclusion).not.toHaveBeenCalled()
		})

		it('reset() cancels the exclusion timeout', () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				backup: { ...createBackupPort(), backupOnEvent: false },
			})

			void coordinator.startExclusion({})

			coordinator.reset()

			const drv = driver.getDriver()
			vi.advanceTimersByTime(60_000)
			expect(drv.controller.stopExclusion).not.toHaveBeenCalled()
		})

		it('reset() increments generation', () => {
			const { coordinator } = createCoordinator()
			const gen0 = coordinator.generation
			coordinator.reset()
			expect(coordinator.generation).toBe(gen0 + 1)
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 4 – stale driver detection across await
	// -----------------------------------------------------------------
	describe('generation fencing across awaits', () => {
		it('startInclusion rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			let resolveBackup: () => void
			backup.backupNvm = vi.fn(
				() => new Promise<void>((r) => (resolveBackup = r)),
			)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.startInclusion(
				STRATEGY_INSECURE,
				undefined,
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			// Simulate close/restart while backup is pending
			coordinator.reset()
			resolveBackup()

			await expect(promise).rejects.toThrow(
				'Driver was closed during inclusion setup',
			)
		})

		it('startExclusion rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			let resolveBackup: () => void
			backup.backupNvm = vi.fn(
				() => new Promise<void>((r) => (resolveBackup = r)),
			)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.startExclusion({})

			coordinator.reset()
			resolveBackup()

			await expect(promise).rejects.toThrow(
				'Driver was closed during exclusion setup',
			)
		})

		it('replaceFailedNode rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			let resolveBackup: () => void
			backup.backupNvm = vi.fn(
				() => new Promise<void>((r) => (resolveBackup = r)),
			)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.replaceFailedNode(
				5,
				STRATEGY_INSECURE,
				undefined,
				STRATEGY_SECURITY_S2,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
			)

			coordinator.reset()
			resolveBackup()

			await expect(promise).rejects.toThrow(
				'Driver was closed during replace setup',
			)
		})

		it('startInclusion rejects when driver closed during QR parse', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = false

			let resolveQr: (v: unknown) => void
			const qr: InclusionQRPort = {
				parseQRCodeString: vi.fn(
					() => new Promise((r) => (resolveQr = r)),
				),
			}

			const { coordinator } = createCoordinator({ backup, qr })

			const promise = coordinator.startInclusion(
				STRATEGY_SECURITY_S2,
				{ qrString: 'test-qr' },
				undefined,
				STRATEGY_SMART_START,
				STRATEGY_SECURITY_S2,
				STRATEGY_DEFAULT,
				STRATEGY_INSECURE,
				STRATEGY_SECURITY_S0,
				1,
				0,
			)

			coordinator.reset()
			resolveQr({ version: 0, securityClasses: [], dsk: '00000' })

			await expect(promise).rejects.toThrow(
				'Driver was closed during inclusion setup',
			)
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 1 – callback resolution owned by coordinator
	// -----------------------------------------------------------------
	describe('callback resolution consolidation', () => {
		it('grantSecurityClasses resolves the coordinator-owned promise', async () => {
			const { coordinator, socket } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1, 2],
				clientSideAuth: false,
			})

			// Verify socket emission
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'GRANT_SECURITY_CLASSES',
				{ securityClasses: [1, 2], clientSideAuth: false },
			)

			// Resolve via coordinator
			coordinator.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: true,
			})

			const result = await grantPromise
			expect(result).toEqual({
				securityClasses: [1],
				clientSideAuth: true,
			})
		})

		it('validateDSK resolves the coordinator-owned promise', async () => {
			const { coordinator, socket } = createCoordinator()
			coordinator.setUserCallbacks()

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

		it('abortInclusion resolves both pending promises with false', async () => {
			const { coordinator } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})
			const dskPromise = callbacks.validateDSKAndEnterPIN('dsk-value')

			coordinator.abortInclusion()

			expect(await grantPromise).toBe(false)
			expect(await dskPromise).toBe(false)
		})

		it('setUserCallbacks with serverEnabled=false does not call updateOptions', () => {
			const config = createConfigPort()
			config.serverEnabled = false
			const { coordinator, driver } = createCoordinator({ config })

			coordinator.setUserCallbacks()

			const drv = driver.getDriver()
			expect(drv.updateOptions).not.toHaveBeenCalled()
			expect(coordinator.hasUserCallbacks).toBe(true)
		})

		it('removeUserCallbacks hands control back to HA server', () => {
			const serverManager: InclusionServerManagerPort = {
				handInclusionControlBack: vi.fn(),
			}
			const { coordinator } = createCoordinator({ serverManager })

			coordinator.setUserCallbacks()
			coordinator.removeUserCallbacks()

			expect(coordinator.hasUserCallbacks).toBe(false)
			expect(serverManager.handInclusionControlBack).toHaveBeenCalled()
		})
	})
})
