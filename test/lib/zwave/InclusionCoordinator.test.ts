/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, afterEach, type MockInstance } from 'vitest'
import { SecurityClass } from '@zwave-js/core'
import {
	ExclusionStrategy,
	InclusionState,
	InclusionStrategy,
	JoinNetworkStrategy,
	QRCodeVersion,
} from 'zwave-js'
import {
	InclusionCoordinator,
	InclusionLifecycleCancelledError,
} from '../../../api/lib/zwave/InclusionCoordinator.ts'
import { socketEvents } from '../../../api/lib/SocketEvents.ts'
import type {
	InclusionBackupPort,
	InclusionConfigPort,
	InclusionControllerEventPort,
	InclusionDriverPort,
	InclusionGrant,
	InclusionQRPort,
	InclusionServerManagerPort,
	InclusionSocketPort,
} from '../../../api/lib/zwave/ports.ts'
import { createDeferred, createServiceLogger } from './serviceTestSupport.ts'

function createDriverPort(
	overrides: Partial<
		NonNullable<ReturnType<InclusionDriverPort['getDriver']>>['controller']
	> = {},
): InclusionDriverPort {
	const controller = {
		inclusionState: undefined,
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
		}),
	}
}

function createSocketPort(): InclusionSocketPort & {
	sendToSocket: MockInstance<InclusionSocketPort['sendToSocket']>
} {
	return {
		sendToSocket: vi.fn(),
	}
}

function createBackupPort(): InclusionBackupPort & {
	backupNvm: MockInstance<InclusionBackupPort['backupNvm']>
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
	parsedResult?: Awaited<ReturnType<InclusionQRPort['parseQRCodeString']>>,
): InclusionQRPort {
	return {
		parseQRCodeString: vi.fn().mockResolvedValue(parsedResult),
	}
}

function createControllerEventPort(): InclusionControllerEventPort & {
	emitControllerEvent: MockInstance<
		InclusionControllerEventPort['emitControllerEvent']
	>
} {
	return {
		emitControllerEvent: vi.fn(),
	}
}

function createCoordinator(
	overrides: {
		driver?: InclusionDriverPort
		socket?: ReturnType<typeof createSocketPort>
		controllerEvent?: ReturnType<typeof createControllerEventPort>
		backup?: ReturnType<typeof createBackupPort>
		config?: InclusionConfigPort
		qr?: InclusionQRPort
		logger?: ReturnType<typeof createServiceLogger>
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
	const logger = overrides.logger ?? createServiceLogger()
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
		socketEvents,
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
				InclusionStrategy.Default,
				{},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith(
				expect.objectContaining({
					strategy: InclusionStrategy.Default,
				}),
			)
		})

		it('throws for SmartStart strategy', async () => {
			const { coordinator } = createCoordinator()

			await expect(
				coordinator.startInclusion(
					InclusionStrategy.SmartStart,
					{},
					undefined,
				),
			).rejects.toThrow('Smart Start')
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
				InclusionStrategy.Default,
				{},
				undefined,
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
					InclusionStrategy.Default,
					{},
					undefined,
				),
			).rejects.toThrow('Driver is not ready')
		})

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Insecure,
				{},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: InclusionStrategy.Insecure,
			})
		})

		it('handles Security_S0 strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Security_S0,
				{},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: InclusionStrategy.Security_S0,
			})
		})

		it('handles Security_S2 with provisioning', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Security_S2,
				{
					provisioning: {
						dsk: '12345-67890-12345-67890-12345-67890-12345-67890',
						securityClasses: [SecurityClass.S2_Authenticated],
					},
					dsk: '12345',
				},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith(
				expect.objectContaining({
					strategy: InclusionStrategy.Security_S2,
					provisioning: expect.objectContaining({
						securityClasses: [SecurityClass.S2_Authenticated],
					}),
				}),
			)
		})

		it('handles Security_S2 with qrString (S2 QR code)', async () => {
			const qr = createQRPort({ version: QRCodeVersion.S2, dsk: '12345' })
			const { coordinator, driver } = createCoordinator({ qr })
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Security_S2,
				{ qrString: 'some-qr' },
				undefined,
				InclusionStrategy.SmartStart,
				InclusionStrategy.Security_S2,
				InclusionStrategy.Default,
				InclusionStrategy.Insecure,
				InclusionStrategy.Security_S0,
				QRCodeVersion.SmartStart,
				QRCodeVersion.S2,
			)

			expect(qr.parseQRCodeString).toHaveBeenCalledWith('some-qr')
			expect(drv.controller.beginInclusion).toHaveBeenCalled()
		})

		it('handles Security_S2 with qrString (SmartStart QR code)', async () => {
			const qr = createQRPort({ version: QRCodeVersion.SmartStart })
			const provisionFn = vi.fn().mockResolvedValue(undefined)
			const { coordinator } = createCoordinator({ qr })

			const result = await coordinator.startInclusion(
				InclusionStrategy.Security_S2,
				{ qrString: 'smart-qr' },
				provisionFn,
				InclusionStrategy.SmartStart,
				InclusionStrategy.Security_S2,
				InclusionStrategy.Default,
				InclusionStrategy.Insecure,
				InclusionStrategy.Security_S0,
				QRCodeVersion.SmartStart,
				QRCodeVersion.S2,
			)

			expect(result).toBe(true)
			expect(provisionFn).toHaveBeenCalled()
		})

		it('throws for invalid QR code string', async () => {
			const qr = createQRPort(undefined)
			const { coordinator } = createCoordinator({ qr })

			await expect(
				coordinator.startInclusion(
					InclusionStrategy.Security_S2,
					{ qrString: 'invalid' },
					undefined,
				),
			).rejects.toThrow('Invalid QR code string')
		})
	})

	describe('startExclusion', () => {
		it('calls beginExclusion', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startExclusion({
				strategy: ExclusionStrategy.ExcludeOnly,
			})
			expect(drv.controller.beginExclusion).toHaveBeenCalledWith({
				strategy: ExclusionStrategy.ExcludeOnly,
			})
		})

		it('performs NVM backup when backupOnEvent is true', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true
			const { coordinator } = createCoordinator({ backup })

			await coordinator.startExclusion({
				strategy: ExclusionStrategy.ExcludeOnly,
			})
			expect(backup.backupNvm).toHaveBeenCalled()
		})

		it('throws when driver not ready', async () => {
			const driver: InclusionDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { coordinator } = createCoordinator({ driver })

			await expect(
				coordinator.startExclusion({
					strategy: ExclusionStrategy.ExcludeOnly,
				}),
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
				InclusionStrategy.Security_S2,
				{},
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(
				5,
				expect.objectContaining({
					strategy: InclusionStrategy.Security_S2,
				}),
			)
		})

		it('propagates replacement errors', async () => {
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
					InclusionStrategy.Security_S2,
					{},
				),
			).rejects.toThrow('failed')
		})

		it('handles Insecure strategy', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				InclusionStrategy.Insecure,
				{},
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: InclusionStrategy.Insecure,
			})
		})

		it('handles S2 with QR code provisioning', async () => {
			const qr = createQRPort({ version: QRCodeVersion.S2, dsk: '12345' })
			const { coordinator, driver } = createCoordinator({ qr })
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				InclusionStrategy.Security_S2,
				{
					qrString: 'some-qr',
				},
			)

			expect(qr.parseQRCodeString).toHaveBeenCalledWith('some-qr')
			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(
				5,
				expect.objectContaining({
					strategy: InclusionStrategy.Security_S2,
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
					InclusionStrategy.Security_S2,
					{
						qrString: 'invalid',
					},
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
				InclusionStrategy.Security_S2,
				{},
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
					InclusionStrategy.Security_S2,
					{},
				),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('startLearnMode / stopLearnMode', () => {
		it('calls beginJoiningNetwork', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startLearnMode(JoinNetworkStrategy.Default)
			expect(drv.controller.beginJoiningNetwork).toHaveBeenCalledWith(
				expect.objectContaining({
					strategy: ExclusionStrategy.ExcludeOnly,
				}),
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

			await expect(
				coordinator.startLearnMode(JoinNetworkStrategy.Default),
			).rejects.toThrow('Driver is not ready')
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
				securityClasses: [
					SecurityClass.S2_Authenticated,
					SecurityClass.S2_AccessControl,
				],
				clientSideAuth: false,
			})

			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.grantSecurityClasses,
				expect.objectContaining({
					securityClasses: [
						SecurityClass.S2_Authenticated,
						SecurityClass.S2_AccessControl,
					],
				}),
			)

			coordinator.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: false,
			})

			const result = await grantPromise
			expect(result).toEqual({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: false,
			})
		})

		it('resolves DSK promise when validateDSK called', async () => {
			const { coordinator, socket } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.validateDSK,
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
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: false,
			})
			const dskPromise = callbacks.validateDSKAndEnterPIN('12345')

			coordinator.abortInclusion()

			expect(await grantPromise).toBe(false)
			expect(await dskPromise).toBe(false)
		})

		it('logs error when no inclusion process started', () => {
			const logger = createServiceLogger()
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
		it('installs driver callbacks', () => {
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

			expect(updateOptionsMock).toHaveBeenLastCalledWith({
				inclusionUserCallbacks: undefined,
			})
			expect(serverManager.handInclusionControlBack).toHaveBeenCalled()
		})
	})

	describe('inclusion state events', () => {
		it('publishes changed state', () => {
			const { coordinator, socket } = createCoordinator()

			coordinator.onInclusionStateChanged(
				InclusionState.Including,
				'Active',
				undefined,
			)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.controller,
				expect.objectContaining({
					inclusionState: InclusionState.Including,
				}),
			)
		})

		it('does not emit when state unchanged', () => {
			const { coordinator, socket } = createCoordinator()

			coordinator.onInclusionStateChanged(
				InclusionState.Idle,
				'Ready',
				undefined,
			)
			coordinator.onInclusionStateChanged(
				InclusionState.Idle,
				'Ready',
				undefined,
			)
			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
		})
	})

	describe('onInclusionFailed', () => {
		it('removes pending nodes after inclusion failure', () => {
			const { coordinator } = createCoordinator()
			coordinator.onNodeFound(10)
			coordinator.onNodeFound(11)

			const removed: number[] = []
			coordinator.onInclusionFailed((nodeId) => removed.push(nodeId))

			expect(removed).toContain(10)
			expect(removed).toContain(11)
		})
	})

	describe('inclusion abort callbacks', () => {
		it('publishes the abort event', () => {
			const { coordinator, socket } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			callbacks.abort()
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.inclusionAborted,
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
				InclusionStrategy.Default,
				{},
				undefined,
			)

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopInclusion).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startInclusion timeout logs error when stopInclusion fails', async () => {
			vi.useFakeTimers()
			const logger = createServiceLogger()
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
				InclusionStrategy.Default,
				{},
				undefined,
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

			await coordinator.startExclusion({
				strategy: ExclusionStrategy.ExcludeOnly,
			})

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopExclusion).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startExclusion timeout logs error when stopExclusion fails', async () => {
			vi.useFakeTimers()
			const logger = createServiceLogger()
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

			await coordinator.startExclusion({
				strategy: ExclusionStrategy.ExcludeOnly,
			})

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
				InclusionStrategy.Security_S2,
				{},
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

			await coordinator.startLearnMode(JoinNetworkStrategy.Default)

			await vi.advanceTimersByTimeAsync(1500)

			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalled()
			vi.useRealTimers()
		})

		it('startLearnMode timeout logs error when stopLearnMode fails', async () => {
			vi.useFakeTimers()
			const logger = createServiceLogger()
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

			await coordinator.startLearnMode(JoinNetworkStrategy.Default)

			await vi.advanceTimersByTimeAsync(1500)

			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to stop learn mode'),
			)
			vi.useRealTimers()
		})
	})

	describe('callback installation availability', () => {
		it('skips driver updates when the server is disabled', () => {
			const config: InclusionConfigPort = {
				commandsTimeout: 30,
				serverEnabled: false,
			}
			const { coordinator, driver } = createCoordinator({ config })
			const drv = driver.getDriver()

			coordinator.setUserCallbacks()
			expect(drv.updateOptions).not.toHaveBeenCalled()
		})
	})

	describe('callback removal availability', () => {
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

			expect(updateOptionsMock).toHaveBeenCalledWith({
				inclusionUserCallbacks: undefined,
			})
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
	})

	describe('Security_S2 without dsk or provisioning', () => {
		it('passes strategy only', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.startInclusion(
				InclusionStrategy.Security_S2,
				{},
				undefined,
			)

			expect(drv.controller.beginInclusion).toHaveBeenCalledWith({
				strategy: InclusionStrategy.Security_S2,
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
				InclusionStrategy.Security_S0,
				{},
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: InclusionStrategy.Security_S0,
			})
		})
	})

	describe('replaceFailedNode S2 without QR or provisioning', () => {
		it('passes strategy-only options', async () => {
			const { coordinator, driver } = createCoordinator()
			const drv = driver.getDriver()

			await coordinator.replaceFailedNode(
				5,
				InclusionStrategy.Security_S2,
				{},
			)

			expect(drv.controller.replaceFailedNode).toHaveBeenCalledWith(5, {
				strategy: InclusionStrategy.Security_S2,
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
				InclusionStrategy.Insecure,
				undefined,
				undefined,
				InclusionStrategy.SmartStart,
				InclusionStrategy.Security_S2,
				InclusionStrategy.Default,
				InclusionStrategy.Insecure,
				InclusionStrategy.Security_S0,
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

	describe('inclusion operations interrupted by reset', () => {
		it('startInclusion rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			const backupBarrier = createDeferred<void>()
			backup.backupNvm = vi.fn(() => backupBarrier.promise)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.startInclusion(
				InclusionStrategy.Insecure,
				undefined,
				undefined,
				InclusionStrategy.SmartStart,
				InclusionStrategy.Security_S2,
				InclusionStrategy.Default,
				InclusionStrategy.Insecure,
				InclusionStrategy.Security_S0,
			)

			coordinator.reset()
			backupBarrier.resolve()

			await expect(promise).rejects.toBeInstanceOf(
				InclusionLifecycleCancelledError,
			)
		})

		it('startExclusion rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			const backupBarrier = createDeferred<void>()
			backup.backupNvm = vi.fn(() => backupBarrier.promise)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.startExclusion({})

			coordinator.reset()
			backupBarrier.resolve()

			await expect(promise).rejects.toBeInstanceOf(
				InclusionLifecycleCancelledError,
			)
		})

		it('replaceFailedNode rejects when driver closed during backup', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = true

			const backupBarrier = createDeferred<void>()
			backup.backupNvm = vi.fn(() => backupBarrier.promise)

			const { coordinator } = createCoordinator({ backup })

			const promise = coordinator.replaceFailedNode(
				5,
				InclusionStrategy.Insecure,
				undefined,
			)

			coordinator.reset()
			backupBarrier.resolve()

			await expect(promise).rejects.toBeInstanceOf(
				InclusionLifecycleCancelledError,
			)
		})

		it('startInclusion rejects when driver closed during QR parse', async () => {
			const backup = createBackupPort()
			backup.backupOnEvent = false

			const qrBarrier =
				createDeferred<
					Awaited<ReturnType<InclusionQRPort['parseQRCodeString']>>
				>()
			const qr: InclusionQRPort = {
				parseQRCodeString: vi.fn(() => qrBarrier.promise),
			}

			const { coordinator } = createCoordinator({ backup, qr })

			const promise = coordinator.startInclusion(
				InclusionStrategy.Security_S2,
				{ qrString: 'test-qr' },
				undefined,
			)

			coordinator.reset()
			qrBarrier.resolve({
				version: QRCodeVersion.S2,
				securityClasses: [],
				dsk: '00000',
			})

			await expect(promise).rejects.toBeInstanceOf(
				InclusionLifecycleCancelledError,
			)
		})
	})

	describe('security callback responses', () => {
		it('resolves a pending security grant', async () => {
			const { coordinator, socket } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [
					SecurityClass.S2_Authenticated,
					SecurityClass.S2_AccessControl,
				],
				clientSideAuth: false,
			})

			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.grantSecurityClasses,
				{
					securityClasses: [
						SecurityClass.S2_Authenticated,
						SecurityClass.S2_AccessControl,
					],
					clientSideAuth: false,
				},
			)

			coordinator.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: true,
			})

			const result = await grantPromise
			expect(result).toEqual({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: true,
			})
		})

		it('resolves pending DSK validation', async () => {
			const { coordinator, socket } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')

			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.validateDSK,
				'12345-67890',
			)

			coordinator.validateDSK('12345')

			const result = await dskPromise
			expect(result).toBe('12345')
		})

		it('aborts pending security prompts', async () => {
			const { coordinator } = createCoordinator()
			coordinator.setUserCallbacks()

			const callbacks = coordinator.getUserCallbacks()
			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: false,
			})
			const dskPromise = callbacks.validateDSKAndEnterPIN('dsk-value')

			coordinator.abortInclusion()

			expect(await grantPromise).toBe(false)
			expect(await dskPromise).toBe(false)
		})

		it('skips driver callbacks when the server is disabled', () => {
			const config = createConfigPort()
			config.serverEnabled = false
			const { coordinator, driver } = createCoordinator({ config })

			coordinator.setUserCallbacks()

			const drv = driver.getDriver()
			expect(drv.updateOptions).not.toHaveBeenCalled()
		})

		it('hands inclusion control back to the server', () => {
			const serverManager: InclusionServerManagerPort = {
				handInclusionControlBack: vi.fn(),
			}
			const { coordinator } = createCoordinator({ serverManager })

			coordinator.setUserCallbacks()
			coordinator.removeUserCallbacks()

			expect(serverManager.handInclusionControlBack).toHaveBeenCalled()
		})
	})

	describe('security prompt events', () => {
		it('publishes security grants before controller events', async () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const requested: InclusionGrant = {
				securityClasses: [
					SecurityClass.S2_Unauthenticated,
					SecurityClass.S2_Authenticated,
					SecurityClass.S2_AccessControl,
				],
				clientSideAuth: true,
			}

			const grantPromise = callbacks.grantSecurityClasses(requested)

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.grantSecurityClasses,
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

		it('publishes DSK validation before controller events', async () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dsk = '12345-67890-11111-22222'
			const dskPromise = callbacks.validateDSKAndEnterPIN(dsk)

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.validateDSK,
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

		it('publishes inclusion aborts before controller events', () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			callbacks.abort()

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				socketEvents.inclusionAborted,
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
				securityClasses: [SecurityClass.S2_Authenticated],
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
				socketEvents.inclusionAborted,
				true,
			)
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

	describe('security callbacks after reset', () => {
		it('settles a pending security grant', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [
					SecurityClass.S2_Authenticated,
					SecurityClass.S2_AccessControl,
				],
				clientSideAuth: false,
			})

			coordinator.reset()

			const result = await grantPromise
			expect(result).toBe(false)
		})

		it('settles pending DSK validation', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const dskPromise = callbacks.validateDSKAndEnterPIN('12345-67890')

			coordinator.reset()

			const result = await dskPromise
			expect(result).toBe(false)
		})
	})

	describe('pending callback cancellation', () => {
		it('settles a pending grant once on reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const settleCount = { grant: 0 }
			const grantPromise = callbacks
				.grantSecurityClasses({
					securityClasses: [SecurityClass.S2_Authenticated],
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

		it('settles pending grant and DSK prompts once on reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
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
					securityClasses: [SecurityClass.S2_Authenticated],
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
					securityClasses: [SecurityClass.S2_Authenticated],
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
	})

	describe('command timeouts across inclusion modes', () => {
		it('starting inclusion clears learn mode timeout', async () => {
			vi.useFakeTimers()
			const { coordinator, driver } = createCoordinator({
				config: { commandsTimeout: 5, serverEnabled: true },
			})
			const drv = driver.getDriver()

			await coordinator.startLearnMode(JoinNetworkStrategy.Default)

			await coordinator.startInclusion(
				InclusionStrategy.Default,
				{},
				undefined,
			)

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

			await coordinator.startInclusion(
				InclusionStrategy.Default,
				{},
				undefined,
			)
			await coordinator.startExclusion({
				strategy: ExclusionStrategy.ExcludeOnly,
			})

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

			await coordinator.replaceFailedNode(
				5,
				InclusionStrategy.Security_S2,
				{},
			)
			await coordinator.startLearnMode(JoinNetworkStrategy.Default)

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

			await coordinator.startLearnMode(JoinNetworkStrategy.Default)
			await coordinator.stopLearnMode()

			await vi.advanceTimersByTimeAsync(6000)

			expect(drv.controller.stopJoiningNetwork).toHaveBeenCalledTimes(1)

			vi.useRealTimers()
		})
	})

	describe('security callbacks remain usable after reset', () => {
		it('resolves security grants started after reset', async () => {
			const { coordinator } = createCoordinator()

			const callbacks = coordinator.getUserCallbacks()
			coordinator.setUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [
					SecurityClass.S2_Authenticated,
					SecurityClass.S2_AccessControl,
				],
				clientSideAuth: false,
			})

			coordinator.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: true,
			})

			const result = await grantPromise
			expect(result).toEqual({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: true,
			})
		})

		it('resolves DSK validation started after reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			const dskPromise = callbacks.validateDSKAndEnterPIN('99999-88888')
			coordinator.validateDSK('99999')

			expect(await dskPromise).toBe('99999')
		})

		it('aborts security grants started after reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Unauthenticated],
				clientSideAuth: false,
			})

			coordinator.abortInclusion()
			expect(await grantPromise).toBe(false)
		})

		it('publishes each security prompt once after reset', () => {
			const { coordinator, socket, controllerEvent } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()

			coordinator.reset()

			void callbacks.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_Authenticated],
				clientSideAuth: false,
			})

			expect(socket.sendToSocket).toHaveBeenCalledTimes(1)
			expect(controllerEvent.emitControllerEvent).toHaveBeenCalledTimes(1)

			coordinator.abortInclusion()
		})

		it('resolves access-control grants after reset', async () => {
			const { coordinator } = createCoordinator()
			const callbacks = coordinator.getUserCallbacks()
			coordinator.setUserCallbacks()

			coordinator.reset()

			const grantPromise = callbacks.grantSecurityClasses({
				securityClasses: [
					SecurityClass.S2_AccessControl,
					SecurityClass.S0_Legacy,
				],
				clientSideAuth: false,
			})

			coordinator.grantSecurityClasses({
				securityClasses: [SecurityClass.S2_AccessControl],
				clientSideAuth: false,
			})

			expect(await grantPromise).toEqual({
				securityClasses: [SecurityClass.S2_AccessControl],
				clientSideAuth: false,
			})
		})
	})
})
