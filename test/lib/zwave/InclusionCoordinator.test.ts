/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { InclusionCoordinator } from '../../../api/lib/zwave/InclusionCoordinator.ts'
import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionControllerEventPort,
	InclusionDriverPort,
	InclusionGrant,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
	ServiceLogger,
} from '../../../api/lib/zwave/ports.ts'
import {
	InclusionStrategy,
	QRCodeVersion,
} from '../../../api/lib/zwave/ports.ts'

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

function createQRPort(parsedResult?: Record<string, unknown>): InclusionQRPort {
	return {
		parseQRCodeString: vi.fn().mockResolvedValue(parsedResult),
	} as InclusionQRPort
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

function createControllerEventPort(): InclusionControllerEventPort & {
	emitControllerEvent: ReturnType<typeof vi.fn>
} {
	return {
		emitControllerEvent: vi.fn(),
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
		controllerEvent?: ReturnType<typeof createControllerEventPort>
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
	const controllerEvent =
		overrides.controllerEvent ?? createControllerEventPort()
	const backup = overrides.backup ?? createBackupPort()
	const config = overrides.config ?? createConfigPort()
	const qr = overrides.qr ?? createQRPort()
	const logger = overrides.logger ?? createLogger()
	const serverManager = overrides.serverManager ?? undefined
	const nvmEventSetter = overrides.nvmEventSetter ?? vi.fn()

	const coordinator = new InclusionCoordinator(
		driver,
		socket,
		controllerEvent,
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
		controllerEvent,
		backup,
		config,
		qr,
		logger,
		nvmEventSetter,
	}
}

const STRATEGY_DEFAULT = InclusionStrategy.Default
const STRATEGY_SECURITY_S2 = InclusionStrategy.Security_S2
const STRATEGY_INSECURE = InclusionStrategy.Insecure
const STRATEGY_SECURITY_S0 = InclusionStrategy.Security_S0
const STRATEGY_SMART_START = InclusionStrategy.SmartStart

describe('InclusionCoordinator', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	describe('startInclusion', () => {
		it('calls beginInclusion with default strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith(
				expect.objectContaining({ strategy: STRATEGY_DEFAULT }),
			)
		})

		it('throws for SmartStart strategy', async () => {
			const { coordinator } = createCoordinator()

			await expect(
				coordinator.startInclusion(STRATEGY_SMART_START, {}, undefined),
			).rejects.toThrow('Smart Start')
		})

		it('sets tmpNode from options', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Test', location: 'Room' },
				undefined,
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

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

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
				coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined),
			).rejects.toThrow('Driver is not ready')
		})

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(STRATEGY_INSECURE, {}, undefined)

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
				{ provisioning: { some: 'data' } as never, dsk: '12345' },
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith(
				expect.objectContaining({
					strategy: STRATEGY_SECURITY_S2,
					provisioning: { some: 'data' },
				}),
			)
		})

		it('handles Security_S2 with qrString (S2 QR code)', async () => {
			const qr = createQRPort({ version: QRCodeVersion.S2, dsk: '12345' })
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
			const qr = createQRPort({ version: QRCodeVersion.SmartStart })
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
				),
			).rejects.toThrow()
			expect(coordinator.tmpNode).toBeUndefined()
		})

		it('handles unknown strategy (fallback)', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				99 as InclusionStrategy,
				{},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith()
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

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})

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
				coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {}),
			).rejects.toThrow('failed')
			expect(coordinator.isReplacing).toBe(false)
		})

		it('throws for unsupported strategy', async () => {
			const { coordinator } = createCoordinator()

			await expect(
				coordinator.replaceFailedNode(5, 99 as InclusionStrategy, {}),
			).rejects.toThrow('not supported')
		})

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(5, STRATEGY_INSECURE, {})

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_INSECURE,
			})
		})

		it('handles S2 with QR code provisioning', async () => {
			const qr = createQRPort({ version: QRCodeVersion.S2, dsk: '12345' })
			const { coordinator, driver } = createCoordinator({ qr })
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {
				qrString: 'some-qr',
			})

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
				coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {
					qrString: 'invalid',
				}),
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

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})

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
				coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {}),
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

			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'GRANT_SECURITY_CLASSES',
				expect.objectContaining({ securityClasses: [1, 2] }),
			)

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

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

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

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

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

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})

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

			const grantP = callbacks.grantSecurityClasses({
				securityClasses: [],
				clientSideAuth: false,
			})
			const dskP = callbacks.validateDSKAndEnterPIN('12345-67890')

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
			coordinator.abortInclusion()
		})
	})

	describe('startExclusion - commands timeout cleared', () => {
		it('clears existing timeout before setting new one', async () => {
			vi.useFakeTimers()
			const { coordinator } = createCoordinator()

			await coordinator.startExclusion({ strategy: 0 })

			await coordinator.startExclusion({ strategy: 0 })

			coordinator.clearCommandsTimeout()
			vi.useRealTimers()
		})
	})

	describe('startInclusion with existing timeout', () => {
		it('clears pre-existing commands timeout', async () => {
			vi.useFakeTimers()
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

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

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S0, {})

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_SECURITY_S0,
			})
		})
	})

	describe('replaceFailedNode S2 without QR or provisioning', () => {
		it('passes strategy-only options', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: STRATEGY_SECURITY_S2,
			})
		})
	})

	describe('timeout cleanup on reset', () => {
		it('reset() cancels the inclusion timeout so it cannot fire against a new driver', () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				backup: { ...createBackupPort(), backupOnEvent: false },
			})

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

			coordinator.reset()

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
	})

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
			)

			coordinator.reset()
			resolveQr({
				version: QRCodeVersion.S2,
				securityClasses: [],
				dsk: '00000',
			})

			await expect(promise).rejects.toThrow(
				'Driver was closed during inclusion setup',
			)
		})
	})

	describe('callback resolution consolidation', () => {
		it('grantSecurityClasses resolves the coordinator-owned promise', async () => {
			const { coordinator, socket } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1, 2],
				clientSideAuth: false,
			})

			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'GRANT_SECURITY_CLASSES',
				{ securityClasses: [1, 2], clientSideAuth: false },
			)

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

	describe('controller event emission (MQTT regression)', () => {
		it('_onGrantSecurityClasses emits socket + controller event with exact payload/order', async () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const requested: InclusionGrant = {
				securityClasses: [0, 1, 2],
				clientSideAuth: true,
			}

			const grantPromise = callbacks.grantSecurityClasses(requested)

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'GRANT_SECURITY_CLASSES',
				requested,
			)

			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledWith(
				'grant security classes',
				requested,
			)

			const socketOrder = socket.sendToSocket.mock.invocationCallOrder[0]
			const controllerOrder =
				controllerEvent.emitControllerEvent.mock.invocationCallOrder[0]
			expect(socketOrder).toBeLessThan(controllerOrder)

			coordinator.grantSecurityClasses(requested)
			await grantPromise
		})

		it('_onValidateDSK emits socket + controller event with exact payload/order', async () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dsk = '12345-67890-11111-22222'
			const dskPromise = callbacks.validateDSKAndEnterPIN(dsk)

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'VALIDATE_DSK',
				dsk,
			)

			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledWith(
				'validate dsk',
				dsk,
			)

			const socketOrder = socket.sendToSocket.mock.invocationCallOrder[0]
			const controllerOrder =
				controllerEvent.emitControllerEvent.mock.invocationCallOrder[0]
			expect(socketOrder).toBeLessThan(controllerOrder)

			coordinator.validateDSK(dsk)
			await dskPromise
		})

		it('_onAbortInclusion emits socket + controller event with exact payload/order', () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			callbacks.abort()

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'INCLUSION_ABORTED',
				true,
			)

			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledWith(
				'inclusion aborted',
			)

			const socketOrder = socket.sendToSocket.mock.invocationCallOrder[0]
			const controllerOrder =
				controllerEvent.emitControllerEvent.mock.invocationCallOrder[0]
			expect(socketOrder).toBeLessThan(controllerOrder)
		})

		it('abort during active DSK/grant resolvers still emits controller event', () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			void callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})
			void callbacks.validateDSKAndEnterPIN('some-dsk')

			socket.sendToSocket.mockClear()
			controllerEvent.emitControllerEvent.mockClear()

			callbacks.abort()

			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledWith(
				'inclusion aborted',
			)

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'INCLUSION_ABORTED',
				true,
			)

			expect(coordinator.hasUserCallbacks).toBe(false)
		})
	})

	describe('stopInclusion/stopExclusion timer cancellation', () => {
		it('stopInclusion clears coordinator timeout without duplicate driver call', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Default,
				{},
				undefined,
			)
			expect(drv.controller.beginInclusion).toHaveBeenCalledTimes(1)

			await coordinator.stopInclusion()
			expect(drv.controller.stopInclusion).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(60_000)
			expect(drv.controller.stopInclusion).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})

		it('stopExclusion clears coordinator timeout without duplicate driver call', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startExclusion({})
			expect(drv.controller.beginExclusion).toHaveBeenCalledTimes(1)

			await coordinator.stopExclusion()
			expect(drv.controller.stopExclusion).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(60_000)
			expect(drv.controller.stopExclusion).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})

		it('timeout fires only if stop is not called manually', async () => {
			vi.useFakeTimers()
			const config = createConfigPort(2)
			const { coordinator, driver } = createCoordinator({ config })
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Default,
				{},
				undefined,
			)

			await vi.advanceTimersByTimeAsync(2_100)

			expect(drv.controller.stopInclusion).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})
	})

	describe('Finding 1: reinstallUserCallbacks after driver replacement', () => {
		it('reinstalls callbacks on new driver when hasUserCallbacks is true', () => {
			const updateOptions1 = vi.fn()
			const updateOptions2 = vi.fn()
			let currentDriver = {
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
				updateOptions: updateOptions1,
			}
			const driverPort: InclusionDriverPort = {
				isDriverReady: () => true,
				getDriver: () => currentDriver,
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			coordinator.setUserCallbacks()
			expect(updateOptions1).toHaveBeenCalledWith(
				expect.objectContaining({
					inclusionUserCallbacks: expect.any(Object),
				}),
			)

			coordinator.reset()
			currentDriver = {
				...currentDriver,
				updateOptions: updateOptions2,
			}

			coordinator.reinstallUserCallbacks()
			expect(updateOptions2).toHaveBeenCalledWith(
				expect.objectContaining({
					inclusionUserCallbacks: expect.any(Object),
				}),
			)
		})

		it('does nothing if callbacks were never installed', () => {
			const updateOptions = vi.fn()
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
					updateOptions,
				}),
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			coordinator.reinstallUserCallbacks()
			expect(updateOptions).not.toHaveBeenCalled()
		})

		it('production flow: install -> hardReset/reset -> driver invokes grant -> promise settles false', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1, 2],
				clientSideAuth: false,
			})

			coordinator.reset()

			const result = await grantPromise
			expect(result).toBe(false)
		})

		it('production flow: install -> reset -> driver invokes DSK -> promise already settled', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')

			coordinator.reset()

			const result = await dskPromise
			expect(result).toBe(false)
		})

		it('old coordinator receives no events after reset: abort is safe noop', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})

			coordinator.reset()
			const result = await grantPromise
			expect(result).toBe(false)

			expect(() => coordinator.abortInclusion()).not.toThrow()
		})
	})

	describe('Finding 3: settle-exactly-once with concurrent operations', () => {
		it('reset settles grant with false exactly once', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const settleCount = { grant: 0 }
			const grantPromise = callbacks
				.grantSecurityClasses({
					securityClasses: [1],
					clientSideAuth: false,
				})
				.then((v) => {
					settleCount.grant++
					return v
				})

			coordinator.reset()
			const result = await grantPromise
			expect(result).toBe(false)
			expect(settleCount.grant).toBe(1)
		})

		it('reset settles both grant and DSK with false exactly once', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})
			const dskPromise = callbacks.validateDSKAndEnterPIN('12345')

			coordinator.reset()

			expect(await grantPromise).toBe(false)
			expect(await dskPromise).toBe(false)
		})

		it('abort followed by reset does not double-settle', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			let settleCount = 0
			const grantPromise = callbacks
				.grantSecurityClasses({
					securityClasses: [1],
					clientSideAuth: false,
				})
				.then((v) => {
					settleCount++
					return v
				})

			coordinator.abortInclusion()
			coordinator.reset()

			const result = await grantPromise
			expect(result).toBe(false)
			expect(settleCount).toBe(1)
		})

		it('reset followed by abort does not double-settle', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			let settleCount = 0
			const dskPromise = callbacks
				.validateDSKAndEnterPIN('12345')
				.then((v) => {
					settleCount++
					return v
				})

			coordinator.reset()
			coordinator.abortInclusion()

			const result = await dskPromise
			expect(result).toBe(false)
			expect(settleCount).toBe(1)
		})

		it('multiple resets do not double-settle', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			let settleCount = 0
			const grantPromise = callbacks
				.grantSecurityClasses({
					securityClasses: [1],
					clientSideAuth: false,
				})
				.then((v) => {
					settleCount++
					return v
				})

			coordinator.reset()
			coordinator.reset()
			coordinator.reset()

			const result = await grantPromise
			expect(result).toBe(false)
			expect(settleCount).toBe(1)
		})

		it('grant/DSK cannot be called after reset (no-op with log)', () => {
			const logger = createLogger()
			const { coordinator } = createCoordinator({ logger })

			coordinator.reset()

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

	describe('Finding 4: shared command timeout across modes', () => {
		it('starting inclusion clears learn mode timeout', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 5, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startLearnMode(0)

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)

			await vi.advanceTimersByTimeAsync(6000)

			expect(drv.controller.stopJoiningNetwork).not.toHaveBeenCalled()
			expect(drv.controller.stopInclusion).toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('starting exclusion clears inclusion timeout', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 5, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)
			await coordinator.startExclusion({ strategy: 0 })

			await vi.advanceTimersByTimeAsync(6000)

			expect(drv.controller.stopInclusion).not.toHaveBeenCalled()
			expect(drv.controller.stopExclusion).toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('starting learn mode clears replace timeout', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 5, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})
			await coordinator.startLearnMode(0)

			await vi.advanceTimersByTimeAsync(6000)

			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('stopLearnMode calls stopJoiningNetwork and clears timeout', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 5, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startLearnMode(0)
			await coordinator.stopLearnMode()

			await vi.advanceTimersByTimeAsync(6000)

			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})
	})

	describe('Service-level: coordinator preserved across reset (direct unit tests)', () => {
		it('captured callbacks resolve through current public API after reset', async () => {
			const { coordinator } = createCoordinator()

			const callbacks = coordinator.getUserCallbacks()
			coordinator.setUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [1, 2],
				clientSideAuth: false,
			})

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

		it('captured DSK callback resolves through validateDSK after reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			const dskPromise = callbacks.validateDSKAndEnterPIN('99999-88888')
			coordinator.validateDSK('99999')

			expect(await dskPromise).toBe('99999')
		})

		it('captured abort callback settles via abortInclusion after reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [0],
				clientSideAuth: false,
			})

			coordinator.abortInclusion()
			expect(await grantPromise).toBe(false)
		})

		it('events fire exactly once through current coordinator after reset', () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			void callbacks.grantSecurityClasses({
				securityClasses: [1],
				clientSideAuth: false,
			})

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)

			coordinator.abortInclusion()
		})

		it('server onHardReset hook: reset + new grant resolves correctly', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()
			coordinator.setUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [2, 3],
				clientSideAuth: false,
			})

			coordinator.grantSecurityClasses({
				securityClasses: [2],
				clientSideAuth: false,
			})

			expect(await grantPromise).toEqual({
				securityClasses: [2],
				clientSideAuth: false,
			})
		})

		it('hasUserCallbacks preserved across reset (UI-installed)', () => {
			const { coordinator } = createCoordinator()
			coordinator.setUserCallbacks()
			expect(coordinator.hasUserCallbacks).toBe(true)

			coordinator.reset()
			expect(coordinator.hasUserCallbacks).toBe(true)
		})

		it('hasUserCallbacks=false preserved across reset (MQTT/server)', () => {
			const { coordinator } = createCoordinator()
			expect(coordinator.hasUserCallbacks).toBe(false)

			coordinator.reset()
			expect(coordinator.hasUserCallbacks).toBe(false)
		})

		it('reinstallUserCallbacks re-registers on new driver after reset', () => {
			const updateOptions = vi.fn()
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
					updateOptions,
				}),
			}
			const { coordinator } = createCoordinator({ driver: driverPort })

			coordinator.setUserCallbacks()
			updateOptions.mockClear()

			coordinator.reset()

			coordinator.reinstallUserCallbacks()
			expect(updateOptions).toHaveBeenCalledWith(
				expect.objectContaining({
					inclusionUserCallbacks: expect.any(Object),
				}),
			)
		})
	})

	describe('Service-level: takeTmpNode atomic consume (direct unit tests)', () => {
		it('first included node gets metadata, coordinator tmp is cleared', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Sensor', location: 'Kitchen' },
				undefined,
			)

			const tmp = coordinator.takeTmpNode()
			expect(tmp).toEqual({ name: 'Sensor', loc: 'Kitchen' })

			expect(coordinator.tmpNode).toBeUndefined()
			expect(coordinator.takeTmpNode()).toBeUndefined()
		})

		it('later node or replacement cannot inherit stale metadata', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Light', location: 'Bedroom' },
				undefined,
			)

			coordinator.takeTmpNode()

			expect(coordinator.takeTmpNode()).toBeUndefined()
		})

		it('failure/reset paths remain clear', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Test', location: 'Loc' },
				undefined,
			)

			coordinator.onInclusionFailed(() => {})
			expect(coordinator.takeTmpNode()).toBeUndefined()

			await coordinator.startInclusion(
				STRATEGY_DEFAULT,
				{ name: 'Test2', location: 'Loc2' },
				undefined,
			)
			coordinator.reset()
			expect(coordinator.takeTmpNode()).toBeUndefined()
		})
	})

	describe('inclusion state sole ownership', () => {
		it('reset() clears inclusion state to undefined', () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()
			drv.controller.inclusionState = 1 // Including

			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBe(1)

			coordinator.reset()
			expect(coordinator.inclusionState).toBeUndefined()
		})

		it('syncFromDriver() reads from driver controller', () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()
			drv.controller.inclusionState = 4 // SmartStart

			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBe(4)
		})

		it('onInclusionStateChanged emits only when state differs', () => {
			const { coordinator, socket, driver } = createCoordinator()
			const drv = driver.getDriver()
			drv.controller.inclusionState = 0 // Idle

			coordinator.syncFromDriver()

			coordinator.onInclusionStateChanged(0, 'status', undefined)
			expect(socket.sendToSocket).not.toHaveBeenCalled()

			coordinator.onInclusionStateChanged(1, 'Including', undefined)
			expect(socket.sendToSocket).toHaveBeenCalledWith('CONTROLLER', {
				status: 'Including',
				error: undefined,
				inclusionState: 1,
			})
			expect(coordinator.inclusionState).toBe(1)

			socket.sendToSocket.mockClear()
			coordinator.onInclusionStateChanged(1, 'Including', undefined)
			expect(socket.sendToSocket).not.toHaveBeenCalled()
		})

		it('active state → reset → syncFromDriver reports new state', () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()
			drv.controller.inclusionState = 3 // Busy

			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBe(3)

			coordinator.reset()
			expect(coordinator.inclusionState).toBeUndefined()

			drv.controller.inclusionState = 0
			coordinator.syncFromDriver()
			expect(coordinator.inclusionState).toBe(0)
		})
	})

	describe('_isReplacing cleared at replacement completion', () => {
		it('onReplacementComplete clears _isReplacing', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})
			expect(coordinator.isReplacing).toBe(true)

			coordinator.onNodeAdded(5)
			expect(coordinator.isReplacing).toBe(true)

			coordinator.onReplacementComplete()
			expect(coordinator.isReplacing).toBe(false)
		})

		it('onInclusionStopped clears _isReplacing for flows without node-added', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.replaceFailedNode(5, STRATEGY_INSECURE, {})
			expect(coordinator.isReplacing).toBe(true)

			coordinator.onInclusionStopped()
			expect(coordinator.isReplacing).toBe(false)
		})

		it('full replacement lifecycle: start → removal preserves → onReplacementComplete clears → later removal deletes', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})
			expect(coordinator.isReplacing).toBe(true)

			expect(coordinator.isReplacing).toBe(true)

			coordinator.onNodeAdded(5)
			expect(coordinator.isReplacing).toBe(true)

			coordinator.onReplacementComplete()
			expect(coordinator.isReplacing).toBe(false)

			expect(coordinator.isReplacing).toBe(false)
		})

		it('onInclusionFailed also clears isReplacing (pre-existing behavior)', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.replaceFailedNode(5, STRATEGY_SECURITY_S2, {})
			expect(coordinator.isReplacing).toBe(true)

			coordinator.onInclusionFailed(() => {})
			expect(coordinator.isReplacing).toBe(false)
		})

		it('onInclusionStopped does not interfere with normal inclusion (isReplacing starts false)', async () => {
			const { coordinator } = createCoordinator()

			await coordinator.startInclusion(STRATEGY_DEFAULT, {}, undefined)
			expect(coordinator.isReplacing).toBe(false)

			coordinator.onInclusionStopped()
			expect(coordinator.isReplacing).toBe(false)
		})
	})
})
