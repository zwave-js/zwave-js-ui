/* eslint-disable @typescript-eslint/unbound-method */
import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterEach,
	type MockInstance,
} from 'vitest'
import { FirmwareUpdateStatus } from '@zwave-js/cc'
import { OTWFirmwareUpdateStatus } from 'zwave-js'
import {
	FirmwareUpdateService,
	FirmwareLifecycleCancelledError,
} from '#api/lib/zwave/FirmwareUpdateService.ts'
import type {
	FirmwareBackupPort,
	FirmwareConfigPort,
	FirmwareDriverPort,
	FirmwareExtractionPort,
	FirmwareNodeStorePort,
	FirmwareSocketPort,
	FirmwareUpdateInfo,
	FirmwareUpdateResult,
	FirmwareUpdateNodeState,
	OTWFirmwareUpdateResult,
	StagedFirmwareNodeUpdate,
} from '#api/lib/zwave/ports.ts'
import { createDeferred, createServiceLogger } from './serviceTestSupport.ts'

const successfulFirmwareUpdate: FirmwareUpdateResult = {
	success: true,
	status: FirmwareUpdateStatus.OK_RestartPending,
	reInterview: false,
}

const successfulOTWFirmwareUpdate: OTWFirmwareUpdateResult = {
	success: true,
	status: OTWFirmwareUpdateStatus.OK,
}

function makeUpdate(
	overrides: Partial<FirmwareUpdateInfo> = {},
): FirmwareUpdateInfo {
	return {
		version: '2.0.0',
		normalizedVersion: '2.0.0',
		downgrade: false,
		changelog: 'Fixed bugs',
		channel: 'stable',
		device: {
			manufacturerId: 1,
			productType: 1,
			productId: 1,
			firmwareVersion: '1.0.0',
		},
		files: [
			{
				target: 0,
				url: 'https://example.com/fw.bin',
				integrity: 'sha256:abc',
			},
		],
		...overrides,
	}
}

function createDriverPort(
	overrides: Partial<FirmwareDriverPort> = {},
): FirmwareDriverPort {
	return {
		isDriverReady: () => true,
		getDriver: () => ({
			controller: {
				getAvailableFirmwareUpdates: vi.fn().mockResolvedValue([]),
				getAllAvailableFirmwareUpdates: vi
					.fn()
					.mockResolvedValue(new Map()),
				firmwareUpdateOTA: vi
					.fn()
					.mockResolvedValue(successfulFirmwareUpdate),
				nodes: { get: vi.fn() },
			},
			firmwareUpdateOTW: vi
				.fn()
				.mockResolvedValue(successfulOTWFirmwareUpdate),
		}),
		...overrides,
	}
}

function createNodeStorePort(): FirmwareNodeStorePort & {
	_nodes: Map<number, FirmwareUpdateNodeState>
	_store: Map<number, Partial<FirmwareUpdateNodeState>>
	emitNodeUpdate: MockInstance<FirmwareNodeStorePort['emitNodeUpdate']>
	persistStagedNodeUpdates: MockInstance<
		FirmwareNodeStorePort['persistStagedNodeUpdates']
	>
} {
	const nodes = new Map<number, FirmwareUpdateNodeState>()
	const store = new Map<number, Partial<FirmwareUpdateNodeState>>()
	return {
		_nodes: nodes,
		_store: store,
		getNode: (nodeId: number) => nodes.get(nodeId),
		getStoreNode: (nodeId: number) => store.get(nodeId),
		ensureStoreNode: (nodeId: number) => {
			if (!store.has(nodeId)) {
				store.set(nodeId, {})
			}
			return store.get(nodeId)
		},
		updateStoreNodes: vi.fn().mockResolvedValue(undefined),
		persistStagedNodeUpdates: vi
			.fn()
			.mockImplementation(
				(_staged: ReadonlyArray<StagedFirmwareNodeUpdate>) => {
					return Promise.resolve()
				},
			),
		emitNodeUpdate: vi.fn(),
	}
}

function createSocketPort(): FirmwareSocketPort & {
	sendToSocket: MockInstance<FirmwareSocketPort['sendToSocket']>
	throttle: MockInstance<FirmwareSocketPort['throttle']>
	clearThrottle: MockInstance<FirmwareSocketPort['clearThrottle']>
} {
	return {
		sendToSocket: vi.fn(),
		throttle: vi.fn((key: string, fn: () => void) => fn()),
		clearThrottle: vi.fn(),
	}
}

function createConfigPort(disabled = false): FirmwareConfigPort {
	return { disableAutomaticFirmwareUpdateChecks: disabled }
}

function createBackupPort(): FirmwareBackupPort {
	return {
		backupOnEvent: false,
		backupNvm: vi.fn().mockResolvedValue(undefined),
	}
}

function createExtractionPort(): FirmwareExtractionPort {
	return {
		guessFirmwareFileFormat: vi.fn().mockReturnValue('bin'),
		extractFirmware: vi.fn().mockResolvedValue({
			data: new Uint8Array([0x01, 0x02]),
		}),
		tryUnzipFirmwareFile: vi.fn().mockReturnValue(undefined),
		isUint8Array: (v: unknown): v is Uint8Array => v instanceof Uint8Array,
	}
}

function createService(
	overrides: {
		driver?: FirmwareDriverPort
		nodes?: ReturnType<typeof createNodeStorePort>
		socket?: ReturnType<typeof createSocketPort>
		config?: FirmwareConfigPort
		backup?: FirmwareBackupPort
		extraction?: FirmwareExtractionPort
		logger?: ReturnType<typeof createServiceLogger>
	} = {},
) {
	const driver = overrides.driver ?? createDriverPort()
	const nodes = overrides.nodes ?? createNodeStorePort()
	const socket = overrides.socket ?? createSocketPort()
	const config = overrides.config ?? createConfigPort()
	const backup = overrides.backup ?? createBackupPort()
	const extraction = overrides.extraction ?? createExtractionPort()
	const logger = overrides.logger ?? createServiceLogger()

	const service = new FirmwareUpdateService(
		driver,
		nodes,
		socket,
		config,
		backup,
		extraction,
		logger,
	)

	return {
		service,
		driver,
		nodes,
		socket,
		config,
		backup,
		extraction,
		logger,
	}
}

describe('FirmwareUpdateService', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('getAvailableFirmwareUpdates', () => {
		it('returns available updates for a node', async () => {
			const updates = [makeUpdate()]
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(updates),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const result = await service.getAvailableFirmwareUpdates(5)
			expect(result).toEqual(updates)
		})

		it('throws when driver is not ready', async () => {
			const driver = createDriverPort({ isDriverReady: () => false })
			const { service } = createService({ driver })

			await expect(
				service.getAvailableFirmwareUpdates(5),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('getAllAvailableFirmwareUpdates', () => {
		it('returns available updates by node', async () => {
			const map = new Map([[5, [makeUpdate()]]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const result = await service.getAllAvailableFirmwareUpdates()
			expect(result).toEqual(map)
		})
	})

	describe('checkAllNodesFirmwareUpdates', () => {
		it('skips when checks are disabled', async () => {
			const { service, logger } = createService({
				config: createConfigPort(true),
			})

			const result = await service.checkAllNodesFirmwareUpdates()
			expect(result).toBeUndefined()
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('disabled'),
			)
		})

		it('processes results and updates store', async () => {
			const updates = [makeUpdate({ version: '3.0.0' })]
			const map = new Map([[7, updates]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, { id: 7 })
			const { service } = createService({ driver, nodes })

			await service.checkAllNodesFirmwareUpdates()
			expect(nodes.persistStagedNodeUpdates).toHaveBeenCalled()
			expect(nodes.emitNodeUpdate).toHaveBeenCalled()
		})

		it('filters downgrades from results', async () => {
			const updates = [
				makeUpdate({ version: '3.0.0', downgrade: false }),
				makeUpdate({ version: '1.0.0', downgrade: true }),
			]
			const map = new Map([[7, updates]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, { id: 7 })
			const { service } = createService({ driver, nodes })

			await service.checkAllNodesFirmwareUpdates()
			const storeNode = nodes._store.get(7)
			expect(storeNode?.availableFirmwareUpdates).toHaveLength(1)
			expect(storeNode?.availableFirmwareUpdates?.[0].version).toBe(
				'3.0.0',
			)
		})
	})

	describe('dismissFirmwareUpdate', () => {
		it('marks version as dismissed in store and node', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ nodes })

			const result = await service.dismissFirmwareUpdate(5, '2.0.0')
			expect(result).toBe(true)
			expect(nodes._store.get(5)?.firmwareUpdatesDismissed).toEqual({
				'2.0.0': true,
			})
			expect(nodes.emitNodeUpdate).toHaveBeenCalled()
			expect(nodes.updateStoreNodes).toHaveBeenCalled()
		})

		it('works when node is not in memory', async () => {
			const nodes = createNodeStorePort()
			const { service } = createService({ nodes })

			const result = await service.dismissFirmwareUpdate(99, '1.0.0')
			expect(result).toBe(true)
			expect(nodes._store.get(99)?.firmwareUpdatesDismissed).toEqual({
				'1.0.0': true,
			})
		})

		it('persists current dismissals when reset interrupts a write', async () => {
			const persistenceStarted = createDeferred<void>()
			const persistenceBarrier = createDeferred<void>()
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })

			let persistenceCount = 0
			let persisted: Record<string, boolean> = {}
			vi.mocked(nodes.updateStoreNodes).mockImplementation(async () => {
				const snapshot = {
					...nodes._store.get(5)?.firmwareUpdatesDismissed,
				}
				persistenceCount++
				if (persistenceCount === 1) {
					persistenceStarted.resolve()
					await persistenceBarrier.promise
				}
				persisted = snapshot
			})

			const { service } = createService({ nodes })
			const interruptedDismissal = service.dismissFirmwareUpdate(
				5,
				'1.0.0',
			)

			await persistenceStarted.promise
			service.resetGeneration()
			const currentDismissal = service.dismissFirmwareUpdate(5, '2.0.0')
			persistenceBarrier.resolve()

			await expect(interruptedDismissal).rejects.toBeInstanceOf(
				FirmwareLifecycleCancelledError,
			)
			await expect(currentDismissal).resolves.toBe(true)
			expect(persisted).toEqual({
				'1.0.0': true,
				'2.0.0': true,
			})
		})
	})

	describe('getNodeFirmwareUpdates', () => {
		it('returns non-dismissed updates', () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, {
				id: 5,
				availableFirmwareUpdates: [
					makeUpdate({ version: '2.0.0' }),
					makeUpdate({ version: '3.0.0' }),
				],
				firmwareUpdatesDismissed: { '2.0.0': true },
			})
			const { service } = createService({ nodes })

			const result = service.getNodeFirmwareUpdates(5)
			expect(result).toHaveLength(1)
			expect(result[0].version).toBe('3.0.0')
		})

		it('returns empty array for unknown node', () => {
			const { service } = createService()
			expect(service.getNodeFirmwareUpdates(99)).toEqual([])
		})
	})

	describe('firmwareUpdateOTA', () => {
		it('calls driver firmwareUpdateOTA', async () => {
			const mockOTA = vi.fn().mockResolvedValue(successfulFirmwareUpdate)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: mockOTA,
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ driver, nodes })

			const info = makeUpdate()
			await service.firmwareUpdateOTA(5, info)
			expect(mockOTA).toHaveBeenCalledWith(5, info)
		})

		it('throws when firmware update already in progress', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5, firmwareUpdate: { progress: 50 } })
			const { service } = createService({ nodes })

			await expect(
				service.firmwareUpdateOTA(5, makeUpdate()),
			).rejects.toThrow('already in progress')
		})
	})

	describe('firmwareUpdateOTW', () => {
		it('extracts and uploads firmware from file', async () => {
			const mockOTW = vi
				.fn()
				.mockResolvedValue(successfulOTWFirmwareUpdate)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: mockOTW,
				}),
			})
			const extraction = createExtractionPort()
			const { service } = createService({ driver, extraction })

			await service.firmwareUpdateOTW({
				name: 'test.bin',
				data: new Uint8Array([0x01]),
			})

			expect(extraction.guessFirmwareFileFormat).toHaveBeenCalledWith(
				'test.bin',
				expect.any(Uint8Array),
			)
			expect(extraction.extractFirmware).toHaveBeenCalled()
			expect(mockOTW).toHaveBeenCalled()
		})

		it('performs NVM backup when backupOnEvent is true', async () => {
			const backup: FirmwareBackupPort = {
				backupOnEvent: true,
				backupNvm: vi.fn().mockResolvedValue(undefined),
			}
			const { service } = createService({ backup })

			await service.firmwareUpdateOTW({
				name: 'test.bin',
				data: new Uint8Array([0x01]),
			})
			expect(backup.backupNvm).toHaveBeenCalled()
		})

		it('starts an OTW update from available update metadata', async () => {
			const mockOTW = vi
				.fn()
				.mockResolvedValue(successfulOTWFirmwareUpdate)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: mockOTW,
				}),
			})
			const { service } = createService({ driver })

			const updateInfo = makeUpdate()
			await service.firmwareUpdateOTW(updateInfo)
			expect(mockOTW).toHaveBeenCalled()
		})

		it('wraps extraction errors', async () => {
			const extraction = createExtractionPort()
			vi.mocked(extraction.guessFirmwareFileFormat).mockImplementation(
				() => {
					throw new Error('bad format')
				},
			)
			const { service } = createService({ extraction })

			await expect(
				service.firmwareUpdateOTW({
					name: 'bad.bin',
					data: new Uint8Array([0x01]),
				}),
			).rejects.toThrow('Error while updating firmware')
		})

		it('throws when driver is null', async () => {
			const driver = createDriverPort({
				getDriver: () => null,
			})
			const { service } = createService({ driver })

			await expect(
				service.firmwareUpdateOTW({
					name: 'test.bin',
					data: new Uint8Array([0x01]),
				}),
			).rejects.toThrow('Error while updating firmware')
		})
	})

	describe('updateFirmware', () => {
		it('extracts files and calls node updateFirmware', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const extraction = createExtractionPort()
			const { service } = createService({ nodes, extraction })

			const mockNodeUpdate = vi
				.fn()
				.mockResolvedValue(successfulFirmwareUpdate)
			const getNode = () => ({ updateFirmware: mockNodeUpdate })

			await service.updateFirmware(
				5,
				[{ name: 'fw.bin', data: new Uint8Array([0x01]) }],
				getNode,
			)

			expect(extraction.extractFirmware).toHaveBeenCalled()
			expect(mockNodeUpdate).toHaveBeenCalled()
		})

		it('throws when node not found', async () => {
			const { service } = createService()

			await expect(
				service.updateFirmware(
					99,
					[{ name: 'fw.bin', data: new Uint8Array([0x01]) }],
					() => undefined,
				),
			).rejects.toThrow('not found')
		})

		it('throws when firmware update in progress', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5, firmwareUpdate: { progress: 30 } })
			const { service } = createService({ nodes })

			await expect(
				service.updateFirmware(
					5,
					[{ name: 'fw.bin', data: new Uint8Array([0x01]) }],
					() => ({ updateFirmware: vi.fn() }),
				),
			).rejects.toThrow('already in progress')
		})

		it('handles zip files', async () => {
			const extraction = createExtractionPort()
			vi.mocked(extraction.tryUnzipFirmwareFile).mockReturnValue({
				format: 'bin',
				filename: 'extracted.bin',
				rawData: new Uint8Array([0x03]),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ nodes, extraction })

			const mockNodeUpdate = vi
				.fn()
				.mockResolvedValue(successfulFirmwareUpdate)
			await service.updateFirmware(
				5,
				[{ name: 'fw.zip', data: new Uint8Array([0x01]) }],
				() => ({ updateFirmware: mockNodeUpdate }),
			)

			expect(extraction.tryUnzipFirmwareFile).toHaveBeenCalled()
			expect(mockNodeUpdate).toHaveBeenCalled()
		})
	})

	describe('abortFirmwareUpdate', () => {
		it('aborts and resets node state', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5, firmwareUpdate: { progress: 50 } })
			const { service } = createService({ nodes })

			const mockAbort = vi.fn().mockResolvedValue(undefined)
			await service.abortFirmwareUpdate(5, () => ({
				abortFirmwareUpdate: mockAbort,
			}))

			expect(mockAbort).toHaveBeenCalled()
			expect(nodes._nodes.get(5)?.firmwareUpdate).toBeUndefined()
			expect(nodes.emitNodeUpdate).toHaveBeenCalled()
		})
	})

	describe('onNodeFirmwareUpdateProgress', () => {
		it('updates node state and throttles emit', () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			service.onNodeFirmwareUpdateProgress(5, { progress: 42 })
			expect(nodes._nodes.get(5)?.firmwareUpdate).toEqual({
				progress: 42,
			})
			expect(socket.throttle).toHaveBeenCalled()
		})
	})

	describe('onNodeFirmwareUpdateFinished', () => {
		it('clears node state and throttle', () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5, firmwareUpdate: { progress: 100 } })
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			service.onNodeFirmwareUpdateFinished(5)
			expect(nodes._nodes.get(5)?.firmwareUpdate).toBeUndefined()
			expect(socket.clearThrottle).toHaveBeenCalledWith(
				'_onNodeFirmwareUpdateProgress_5',
			)
		})
	})

	describe('onOTWFirmwareUpdateProgress', () => {
		it('throttles socket emission', () => {
			const socket = createSocketPort()
			const { service } = createService({ socket })

			service.onOTWFirmwareUpdateProgress(
				{ sentFragments: 5, totalFragments: 10 },
				'OTW_FIRMWARE_UPDATE',
			)
			expect(socket.throttle).toHaveBeenCalled()
		})
	})

	describe('onOTWFirmwareUpdateFinished', () => {
		it('sends result and clears throttle', () => {
			const socket = createSocketPort()
			const logger = createServiceLogger()
			const { service } = createService({ socket, logger })

			service.onOTWFirmwareUpdateFinished(
				{
					success: true,
					status: OTWFirmwareUpdateStatus.OK,
				},
				'OK',
				'OTW_FIRMWARE_UPDATE',
			)
			expect(socket.clearThrottle).toHaveBeenCalledWith(
				'_onOTWFirmwareUpdateProgress',
			)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'OTW_FIRMWARE_UPDATE',
				expect.objectContaining({
					result: { success: true, status: 'OK' },
				}),
			)
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('successfully'),
			)
		})
	})

	describe('scheduledFirmwareUpdateCheck', () => {
		beforeEach(() => {
			vi.useFakeTimers()
		})
		afterEach(() => {
			vi.useRealTimers()
		})

		it('skips when disabled', async () => {
			const { service, logger } = createService({
				config: createConfigPort(true),
			})

			await service.scheduledFirmwareUpdateCheck()
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('disabled'),
			)
		})

		it('calls checkAllNodesFirmwareUpdates', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(new Map()),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service, logger } = createService({ driver })

			await service.scheduledFirmwareUpdateCheck()
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Starting bulk'),
			)
		})

		it('runs the next scheduled firmware check', async () => {
			const getAllAvailableFirmwareUpdates = vi
				.fn()
				.mockResolvedValue(new Map())
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates,
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			await service.scheduledFirmwareUpdateCheck()
			expect(getAllAvailableFirmwareUpdates).toHaveBeenCalledOnce()

			await vi.runOnlyPendingTimersAsync()
			expect(getAllAvailableFirmwareUpdates).toHaveBeenCalledTimes(2)

			service.clearScheduledCheck()
		})
	})

	describe('checkNodeFirmwareUpdates', () => {
		it('updates node when checks are enabled', async () => {
			const updates = [makeUpdate()]
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(updates),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ driver, nodes })

			await service.checkNodeFirmwareUpdates(5)
			expect(nodes.persistStagedNodeUpdates).toHaveBeenCalled()
		})

		it('skips when disabled', async () => {
			const { service, logger } = createService({
				config: createConfigPort(true),
			})

			await service.checkNodeFirmwareUpdates(5)
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('disabled'),
			)
		})
	})

	describe('firmware targets', () => {
		it('preserves target on firmware', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const extraction = createExtractionPort()
			const { service } = createService({ nodes, extraction })

			const mockNodeUpdate = vi
				.fn()
				.mockResolvedValue(successfulFirmwareUpdate)
			await service.updateFirmware(
				5,
				[{ name: 'fw.bin', data: new Uint8Array([0x01]), target: 2 }],
				() => ({ updateFirmware: mockNodeUpdate }),
			)

			expect(mockNodeUpdate).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ firmwareTarget: 2 }),
				]),
			)
		})
	})

	describe('failed firmware archive extraction', () => {
		it('throws when zip extraction fails', async () => {
			const extraction: FirmwareExtractionPort = {
				guessFirmwareFileFormat: vi.fn(),
				extractFirmware: vi.fn(),
				tryUnzipFirmwareFile: vi.fn().mockReturnValue(undefined),
				isUint8Array: (v: unknown): v is Uint8Array =>
					v instanceof Uint8Array,
			}
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ nodes, extraction })

			await expect(
				service.updateFirmware(
					5,
					[{ name: 'fw.zip', data: new Uint8Array([0x01]) }],
					() => ({ updateFirmware: vi.fn() }),
				),
			).rejects.toThrow('Unable to extract firmware from zip')
		})
	})

	describe('progress for unknown nodes', () => {
		it('does nothing for unknown node', () => {
			const nodes = createNodeStorePort()
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			service.onNodeFirmwareUpdateProgress(99, { progress: 42 })
			expect(socket.throttle).not.toHaveBeenCalled()
		})
	})

	describe('completion for unknown nodes', () => {
		it('does nothing for unknown node', () => {
			const nodes = createNodeStorePort()
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			service.onNodeFirmwareUpdateFinished(99)
			expect(socket.clearThrottle).not.toHaveBeenCalled()
		})
	})

	describe('node checks without a ready driver', () => {
		it('returns early when driver not ready', async () => {
			const driver = createDriverPort({
				isDriverReady: () => false,
			})
			const { service, logger } = createService({ driver })

			await service.checkNodeFirmwareUpdates(5)
			expect(logger.info).not.toHaveBeenCalled()
		})
	})

	describe('failed node update checks', () => {
		it('logs error and continues', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockRejectedValue(new Error('network error')),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const logger = createServiceLogger()
			const { service } = createService({ driver, logger })

			await service.checkNodeFirmwareUpdates(5)
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to check firmware'),
			)
		})
	})

	describe('node checks during driver shutdown', () => {
		it('returns early when getDriver returns null', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => true,
				getDriver: () => null,
			}
			const logger = createServiceLogger()
			const { service } = createService({ driver, logger })

			await service.checkNodeFirmwareUpdates(5)
			expect(logger.error).not.toHaveBeenCalled()
		})
	})

	describe('failed network update checks', () => {
		it('logs error and rethrows', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockRejectedValue(new Error('bulk error')),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const logger = createServiceLogger()
			const { service } = createService({ driver, logger })

			await expect(
				service.checkAllNodesFirmwareUpdates(),
			).rejects.toThrow('bulk error')
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Error during bulk'),
				expect.any(String),
			)
		})
	})

	describe('empty network update responses', () => {
		it('handles null result from getAllAvailable', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(null),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const result = await service.checkAllNodesFirmwareUpdates()
			expect(result).toBeNull()
		})
	})

	describe('failed OTW updates', () => {
		it('logs error status on failure', () => {
			const socket = createSocketPort()
			const logger = createServiceLogger()
			const { service } = createService({ socket, logger })

			service.onOTWFirmwareUpdateFinished(
				{
					success: false,
					status: OTWFirmwareUpdateStatus.Error_RetryLimitReached,
				},
				'Error_Timeout',
				'OTW_FIRMWARE_UPDATE',
			)

			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('with error'),
			)
			expect(socket.sendToSocket).toHaveBeenCalledWith(
				'OTW_FIRMWARE_UPDATE',
				expect.objectContaining({
					result: { success: false, status: 'Error_Timeout' },
				}),
			)
		})
	})

	describe('scheduled check failures', () => {
		it('catches error and schedules next check', async () => {
			vi.useFakeTimers()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockRejectedValue(new Error('bulk fail')),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const logger = createServiceLogger()
			const { service } = createService({ driver, logger })

			await service.scheduledFirmwareUpdateCheck()
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('has failed'),
			)
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Next firmware update check'),
			)
			service.clearScheduledCheck()
			vi.useRealTimers()
		})
	})

	describe('getAllAvailableFirmwareUpdates', () => {
		it('throws when driver not ready', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { service } = createService({ driver })

			await expect(
				service.getAllAvailableFirmwareUpdates(),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('OTA updates without a ready driver', () => {
		it('throws when driver not ready', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { service } = createService({ driver })

			await expect(
				service.firmwareUpdateOTA(5, makeUpdate()),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('firmware aborts without a ready driver', () => {
		it('throws when driver not ready', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { service } = createService({ driver })

			await expect(
				service.abortFirmwareUpdate(5, () => ({
					abortFirmwareUpdate: vi.fn(),
				})),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('firmware aborts for unknown nodes', () => {
		it('throws when getZwaveNode returns undefined', async () => {
			const { service } = createService()

			await expect(
				service.abortFirmwareUpdate(99, () => undefined),
			).rejects.toThrow('not found')
		})
	})

	describe('OTW backup events', () => {
		it('calls nvmEventSetter before backup', async () => {
			const backup: FirmwareBackupPort = {
				backupOnEvent: true,
				backupNvm: vi.fn().mockResolvedValue(undefined),
			}
			const nvmSetter = vi.fn()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi
						.fn()
						.mockResolvedValue(successfulOTWFirmwareUpdate),
				}),
			})
			const extraction = createExtractionPort()

			const service = new FirmwareUpdateService(
				driver,
				createNodeStorePort(),
				createSocketPort(),
				createConfigPort(),
				backup,
				extraction,
				createServiceLogger(),
				nvmSetter,
			)

			await service.firmwareUpdateOTW({
				name: 'test.bin',
				data: new Uint8Array([0x01]),
			})

			expect(nvmSetter).toHaveBeenCalledWith(
				'before_controller_fw_update_otw',
			)
			expect(backup.backupNvm).toHaveBeenCalled()
		})
	})

	describe('node updates without a ready driver', () => {
		it('throws when driver not ready', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { service } = createService({ driver })

			await expect(
				service.updateFirmware(
					5,
					[{ name: 'fw.bin', data: new Uint8Array([0x01]) }],
					() => ({ updateFirmware: vi.fn() }),
				),
			).rejects.toThrow('Driver is not ready')
		})
	})

	describe('dismissed update cleanup', () => {
		it('cleans dismissed updates that no longer exist', async () => {
			const updates = [makeUpdate({ version: '3.0.0' })]
			const map = new Map([[7, updates]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, {
				id: 7,
				firmwareUpdatesDismissed: { '2.0.0': true, '3.0.0': true },
			})
			nodes._store.set(7, {
				firmwareUpdatesDismissed: { '2.0.0': true, '3.0.0': true },
			})
			const { service } = createService({ driver, nodes })

			await service.checkAllNodesFirmwareUpdates()

			const storeNode = nodes._store.get(7)
			expect(storeNode?.firmwareUpdatesDismissed).toEqual({
				'3.0.0': true,
			})
		})
	})

	describe('disposed firmware services', () => {
		it('does not reschedule checks after disposal', async () => {
			vi.useFakeTimers()
			const { service } = createService()

			const checkPromise = service.scheduledFirmwareUpdateCheck()

			service.dispose()

			await checkPromise

			await vi.advanceTimersByTimeAsync(100 * 60 * 60 * 1000)

			vi.useRealTimers()
		})

		it('does not reschedule an interrupted check', async () => {
			vi.useFakeTimers()
			const updates = new Map([[7, [makeUpdate()]]])
			const check = createDeferred<void>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise.then(() => updates)),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, { id: 7 })
			const { service } = createService({ driver, nodes })

			const schedulePromise = service.scheduledFirmwareUpdateCheck()

			service.resetGeneration()

			check.resolve()
			await schedulePromise

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('does not publish node checks completed after disposal', async () => {
			const check = createDeferred<unknown[]>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ driver, nodes })

			const checkPromise = service.checkNodeFirmwareUpdates(5)

			service.dispose()

			check.resolve([makeUpdate()])
			await checkPromise

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()
		})

		it('does not start scheduled checks after disposal', async () => {
			const { service, logger } = createService()
			service.dispose()

			await service.scheduledFirmwareUpdateCheck()

			expect(logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining('Starting bulk'),
			)
		})
	})

	describe('firmware checks interrupted by reset', () => {
		it('does not persist an interrupted scheduled check', async () => {
			vi.useFakeTimers()
			const check = createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(1, { id: 1 })
			const { service } = createService({ driver, nodes })

			const schedulePromise = service.scheduledFirmwareUpdateCheck()

			service.resetGeneration()

			check.resolve(new Map([[1, [makeUpdate({ version: '3.0.0' })]]]))
			await schedulePromise

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('does not persist an interrupted network check', async () => {
			const check = createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(2, { id: 2 })
			const { service } = createService({ driver, nodes })

			const checkPromise = service.checkAllNodesFirmwareUpdates()

			service.resetGeneration()

			check.resolve(new Map([[2, [makeUpdate({ version: '4.0.0' })]]]))
			await expect(checkPromise).rejects.toBeInstanceOf(
				FirmwareLifecycleCancelledError,
			)

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()
		})

		it('does not persist an interrupted node check', async () => {
			const check = createDeferred<FirmwareUpdateInfo[]>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(3, { id: 3 })
			const { service } = createService({ driver, nodes })

			const checkPromise = service.checkNodeFirmwareUpdates(3)

			service.resetGeneration()

			check.resolve([makeUpdate({ version: '5.0.0' })])
			await checkPromise

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()
		})

		it('handles a late scheduled-check failure', async () => {
			const check = createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockReturnValue(check.promise),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			const { service } = createService({ driver, nodes })

			const schedulePromise = service.scheduledFirmwareUpdateCheck()
			service.resetGeneration()

			check.reject(new Error('network error'))
			await schedulePromise

			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()
		})

		it('schedules one timer after reset', async () => {
			vi.useFakeTimers()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(new Map()),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			await service.scheduledFirmwareUpdateCheck()

			expect(vi.getTimerCount()).toBe(1)

			service.resetGeneration()
			expect(vi.getTimerCount()).toBe(0)

			await service.scheduledFirmwareUpdateCheck()
			expect(vi.getTimerCount()).toBe(1)

			vi.useRealTimers()
		})
	})

	describe('overlapping scheduled firmware checks', () => {
		it('publishes only the newest completed check', async () => {
			vi.useFakeTimers()
			const firstCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const secondCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const getAllAvailableFirmwareUpdates = vi
				.fn()
				.mockReturnValueOnce(firstCheck.promise)
				.mockReturnValueOnce(secondCheck.promise)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates,
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			const nodeId = 7
			nodes._nodes.set(nodeId, { id: nodeId })
			const { service } = createService({ driver, nodes })
			const olderUpdate = makeUpdate({
				version: '2.1.0',
				normalizedVersion: '2.1.0',
			})
			const newerUpdate = makeUpdate({
				version: '2.2.0',
				normalizedVersion: '2.2.0',
			})

			try {
				const firstRun = service.scheduledFirmwareUpdateCheck()
				const secondRun = service.scheduledFirmwareUpdateCheck()

				secondCheck.resolve(new Map([[nodeId, [newerUpdate]]]))
				await secondRun

				firstCheck.resolve(new Map([[nodeId, [olderUpdate]]]))
				await firstRun

				expect(
					nodes._store.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([newerUpdate])
				expect(
					nodes._nodes.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([newerUpdate])
				expect(nodes.persistStagedNodeUpdates).toHaveBeenCalledTimes(1)
				expect(nodes.emitNodeUpdate).toHaveBeenCalledTimes(1)
			} finally {
				service.resetGeneration()
				vi.useRealTimers()
			}
		})

		it('restores current state when superseded during persistence', async () => {
			vi.useFakeTimers()
			const firstCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const secondCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const firstPersistence = createDeferred<void>()
			const getAllAvailableFirmwareUpdates = vi
				.fn()
				.mockReturnValueOnce(firstCheck.promise)
				.mockReturnValueOnce(secondCheck.promise)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates,
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes.persistStagedNodeUpdates
				.mockImplementationOnce(() => firstPersistence.promise)
				.mockResolvedValueOnce(undefined)
			const nodeId = 8
			nodes._nodes.set(nodeId, { id: nodeId })
			const { service } = createService({ driver, nodes })
			const olderUpdate = makeUpdate({
				version: '3.1.0',
				normalizedVersion: '3.1.0',
			})
			const newerUpdate = makeUpdate({
				version: '3.2.0',
				normalizedVersion: '3.2.0',
			})

			try {
				const firstRun = service.scheduledFirmwareUpdateCheck()
				firstCheck.resolve(new Map([[nodeId, [olderUpdate]]]))
				await vi.waitFor(() => {
					expect(
						nodes.persistStagedNodeUpdates,
					).toHaveBeenCalledTimes(1)
				})

				const secondRun = service.scheduledFirmwareUpdateCheck()
				secondCheck.resolve(new Map([[nodeId, [newerUpdate]]]))
				firstPersistence.resolve()

				await Promise.all([firstRun, secondRun])

				expect(nodes.updateStoreNodes).toHaveBeenCalledTimes(1)
				expect(nodes.persistStagedNodeUpdates).toHaveBeenCalledTimes(2)
				expect(
					nodes._store.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([newerUpdate])
				expect(
					nodes._nodes.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([newerUpdate])
				expect(nodes.emitNodeUpdate).toHaveBeenCalledTimes(1)
			} finally {
				service.resetGeneration()
				vi.useRealTimers()
			}
		})

		it('keeps a newer manual result when a scheduled check finishes later', async () => {
			vi.useFakeTimers()
			const scheduledCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const manualCheck =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const getAllAvailableFirmwareUpdates = vi
				.fn()
				.mockReturnValueOnce(scheduledCheck.promise)
				.mockReturnValueOnce(manualCheck.promise)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates,
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			const nodeId = 9
			nodes._nodes.set(nodeId, { id: nodeId })
			const { service } = createService({ driver, nodes })
			const scheduledUpdate = makeUpdate({
				version: '4.1.0',
				normalizedVersion: '4.1.0',
			})
			const manualUpdate = makeUpdate({
				version: '4.2.0',
				normalizedVersion: '4.2.0',
			})

			try {
				const scheduledRun = service.scheduledFirmwareUpdateCheck()
				const manualRun = service.checkAllNodesFirmwareUpdates()

				manualCheck.resolve(new Map([[nodeId, [manualUpdate]]]))
				await manualRun

				scheduledCheck.resolve(new Map([[nodeId, [scheduledUpdate]]]))
				await scheduledRun

				expect(
					nodes._store.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([manualUpdate])
				expect(
					nodes._nodes.get(nodeId)?.availableFirmwareUpdates,
				).toEqual([manualUpdate])
				expect(nodes.persistStagedNodeUpdates).toHaveBeenCalledTimes(1)
				expect(nodes.emitNodeUpdate).toHaveBeenCalledTimes(1)
			} finally {
				service.resetGeneration()
				vi.useRealTimers()
			}
		})
	})

	describe('firmware operations interrupted by reset', () => {
		it('does not start OTW updates after reset during backup', async () => {
			const backupBarrier = createDeferred<void>()
			const backup: FirmwareBackupPort = {
				backupOnEvent: true,
				backupNvm: vi.fn(() => backupBarrier.promise),
			}
			const firmwareUpdateOTW = vi
				.fn()
				.mockResolvedValue(successfulOTWFirmwareUpdate)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW,
				}),
			})
			const { service } = createService({ driver, backup })

			const otwPromise = service.firmwareUpdateOTW({
				name: 'fw.bin',
				data: new Uint8Array([1, 2, 3]),
			})

			service.resetGeneration()

			backupBarrier.resolve()

			await expect(otwPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)

			expect(firmwareUpdateOTW).not.toHaveBeenCalled()
		})

		it('does not start OTW updates after reset during extraction', async () => {
			const firmwareUpdateOTW = vi
				.fn()
				.mockResolvedValue(successfulOTWFirmwareUpdate)
			const extractionBarrier =
				createDeferred<
					Awaited<
						ReturnType<FirmwareExtractionPort['extractFirmware']>
					>
				>()
			const extraction: FirmwareExtractionPort = {
				guessFirmwareFileFormat: vi.fn().mockReturnValue('bin'),
				extractFirmware: vi.fn<
					FirmwareExtractionPort['extractFirmware']
				>(() => extractionBarrier.promise),
				tryUnzipFirmwareFile: vi.fn(),
				isUint8Array: (v: unknown): v is Uint8Array =>
					v instanceof Uint8Array,
			}
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW,
				}),
			})
			const backup: FirmwareBackupPort = {
				backupOnEvent: false,
				backupNvm: vi.fn(),
			}
			const { service } = createService({ driver, backup, extraction })

			const otwPromise = service.firmwareUpdateOTW({
				name: 'fw.bin',
				data: new Uint8Array([1, 2, 3]),
			})

			service.resetGeneration()

			extractionBarrier.resolve({ data: new Uint8Array([4, 5]) })

			await expect(otwPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)

			expect(firmwareUpdateOTW).not.toHaveBeenCalled()
		})

		it('cancels OTA updates completed after reset', async () => {
			type FirmwareController = NonNullable<
				ReturnType<FirmwareDriverPort['getDriver']>
			>['controller']
			const otaBarrier =
				createDeferred<
					Awaited<ReturnType<FirmwareController['firmwareUpdateOTA']>>
				>()
			const firmwareUpdateOTA = vi.fn<
				FirmwareController['firmwareUpdateOTA']
			>(() => otaBarrier.promise)
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA,
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const otaPromise = service.firmwareUpdateOTA(5, makeUpdate())

			service.resetGeneration()

			otaBarrier.resolve({
				success: true,
				status: FirmwareUpdateStatus.OK_RestartPending,
				reInterview: false,
			})

			await expect(otaPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)
		})

		it('does not publish firmware aborts completed after reset', async () => {
			const abortBarrier = createDeferred<void>()
			const abortFirmwareUpdate = vi.fn(() => abortBarrier.promise)
			const nodes = createNodeStorePort()
			nodes._nodes.set(3, { id: 3, firmwareUpdate: { progress: 50 } })
			const driver = createDriverPort()
			const { service } = createService({ driver, nodes })

			const getZwaveNode = () => ({ abortFirmwareUpdate })
			const abortPromise = service.abortFirmwareUpdate(3, getZwaveNode)

			service.resetGeneration()

			abortBarrier.resolve()

			await expect(abortPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)

			expect(nodes._nodes.get(3)?.firmwareUpdate).toEqual({
				progress: 50,
			})
			expect(nodes.emitNodeUpdate).not.toHaveBeenCalled()
		})

		it('does not start node updates after reset during extraction', async () => {
			const extractionBarrier =
				createDeferred<
					Awaited<
						ReturnType<FirmwareExtractionPort['extractFirmware']>
					>
				>()
			const extraction: FirmwareExtractionPort = {
				guessFirmwareFileFormat: vi.fn().mockReturnValue('bin'),
				extractFirmware: vi.fn<
					FirmwareExtractionPort['extractFirmware']
				>(() => extractionBarrier.promise),
				tryUnzipFirmwareFile: vi.fn(),
				isUint8Array: (v: unknown): v is Uint8Array =>
					v instanceof Uint8Array,
			}
			const updateFirmware = vi
				.fn()
				.mockResolvedValue(successfulFirmwareUpdate)
			const getZwaveNode = () => ({ updateFirmware })
			const { service } = createService({ extraction })

			const updatePromise = service.updateFirmware(
				5,
				[{ name: 'fw.bin', data: new Uint8Array([1]) }],
				getZwaveNode,
			)

			service.resetGeneration()

			extractionBarrier.resolve({ data: new Uint8Array([2]) })

			await expect(updatePromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)

			expect(updateFirmware).not.toHaveBeenCalled()
		})

		it('cancels node update lookups completed after reset', async () => {
			const updateBarrier = createDeferred<FirmwareUpdateInfo[]>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(
							() => updateBarrier.promise,
						),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const getPromise = service.getAvailableFirmwareUpdates(7)

			service.resetGeneration()

			updateBarrier.resolve([makeUpdate()])

			await expect(getPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)
		})

		it('cancels network update lookups completed after reset', async () => {
			const updateBarrier =
				createDeferred<Map<number, FirmwareUpdateInfo[]>>()
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(
							() => updateBarrier.promise,
						),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const getAllPromise = service.getAllAvailableFirmwareUpdates()

			service.resetGeneration()

			updateBarrier.resolve(new Map())

			await expect(getAllPromise).rejects.toThrow(
				FirmwareLifecycleCancelledError,
			)
		})

		it('returns successful OTA results', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn().mockResolvedValue({
							success: true,
							status: FirmwareUpdateStatus.OK_RestartPending,
						}),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			const result = await service.firmwareUpdateOTA(1, makeUpdate())
			expect(result).toEqual({
				success: true,
				status: FirmwareUpdateStatus.OK_RestartPending,
			})
		})

		it('propagates OTA failures', async () => {
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi
							.fn()
							.mockRejectedValue(new Error('Network timeout')),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const { service } = createService({ driver })

			await expect(
				service.firmwareUpdateOTA(1, makeUpdate()),
			).rejects.toThrow('Network timeout')
		})
	})

	describe('firmware persistence interrupted by reset', () => {
		it('does not publish interrupted network persistence', async () => {
			const persistenceBarrier = createDeferred<void>()
			const persistenceStarted = createDeferred<void>()

			const updates = [makeUpdate({ version: '3.0.0' })]
			const map = new Map([[7, updates]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, {
				id: 7,
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})
			nodes._store.set(7, {
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			let persisted = nodes._store.get(7)
			const restorePersistence = vi.fn(() => {
				persisted = nodes._store.get(7)
				return Promise.resolve()
			})
			nodes.persistStagedNodeUpdates.mockImplementation(
				async (staged) => {
					persisted = staged[0]
					persistenceStarted.resolve()
					await persistenceBarrier.promise
					return restorePersistence
				},
			)

			const { service } = createService({ driver, nodes })

			const checkPromise = service.checkAllNodesFirmwareUpdates()

			await persistenceStarted.promise
			service.resetGeneration()
			persistenceBarrier.resolve()

			await expect(checkPromise).rejects.toBeInstanceOf(
				FirmwareLifecycleCancelledError,
			)

			const liveNode = nodes._nodes.get(7)
			expect(liveNode.availableFirmwareUpdates).toEqual([])
			expect(liveNode.lastFirmwareUpdateCheck).toBe(0)
			expect(persisted?.availableFirmwareUpdates).toEqual([])
			expect(persisted?.lastFirmwareUpdateCheck).toBe(0)

			expect(restorePersistence).toHaveBeenCalledOnce()
			expect(nodes.emitNodeUpdate).not.toHaveBeenCalled()
		})

		it('does not publish interrupted node persistence', async () => {
			const persistenceBarrier = createDeferred<void>()
			const persistenceStarted = createDeferred<void>()

			const updates = [makeUpdate({ version: '4.0.0' })]
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(updates),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, {
				id: 5,
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})
			nodes._store.set(5, {
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			let persisted = nodes._store.get(5)
			nodes.persistStagedNodeUpdates.mockImplementation(
				async (staged) => {
					persisted = staged[0]
					persistenceStarted.resolve()
					await persistenceBarrier.promise
				},
			)
			vi.mocked(nodes.updateStoreNodes).mockImplementation(() => {
				persisted = nodes._store.get(5)
				return Promise.resolve()
			})

			const { service } = createService({ driver, nodes })

			const checkPromise = service.checkNodeFirmwareUpdates(5)

			await persistenceStarted.promise
			service.resetGeneration()
			persistenceBarrier.resolve()

			await checkPromise

			const liveNode = nodes._nodes.get(5)
			expect(liveNode.availableFirmwareUpdates).toEqual([])
			expect(liveNode.lastFirmwareUpdateCheck).toBe(0)
			expect(persisted?.availableFirmwareUpdates).toEqual([])
			expect(persisted?.lastFirmwareUpdateCheck).toBe(0)

			expect(nodes.emitNodeUpdate).not.toHaveBeenCalled()
		})

		it('persists only the current generation when checks overlap', async () => {
			const persistenceBarrier = createDeferred<void>()
			const persistenceStarted = createDeferred<void>()
			const oldUpdates = [makeUpdate({ version: '3.0.0' })]
			const currentUpdates = [makeUpdate({ version: '4.0.0' })]
			const getAllAvailableFirmwareUpdates = vi
				.fn()
				.mockResolvedValueOnce(new Map([[7, oldUpdates]]))
				.mockResolvedValueOnce(new Map([[7, currentUpdates]]))
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates,
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, {
				id: 7,
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})
			nodes._store.set(7, {
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			let persistenceCount = 0
			let persisted = nodes._store.get(7)
			nodes.persistStagedNodeUpdates.mockImplementation(
				async (staged) => {
					persisted = staged[0]
					persistenceCount++
					if (persistenceCount === 1) {
						persistenceStarted.resolve()
						await persistenceBarrier.promise
					}
				},
			)
			vi.mocked(nodes.updateStoreNodes).mockImplementation(() => {
				persisted = nodes._store.get(7)
				return Promise.resolve()
			})

			const { service } = createService({ driver, nodes })
			const interruptedCheck = service.checkAllNodesFirmwareUpdates()

			await persistenceStarted.promise
			service.resetGeneration()
			const currentCheck = service.checkAllNodesFirmwareUpdates()
			persistenceBarrier.resolve()

			await expect(interruptedCheck).rejects.toBeInstanceOf(
				FirmwareLifecycleCancelledError,
			)
			await currentCheck

			expect(persisted?.availableFirmwareUpdates).toEqual(currentUpdates)
			expect(nodes._nodes.get(7)?.availableFirmwareUpdates).toEqual(
				currentUpdates,
			)
			expect(nodes.emitNodeUpdate).toHaveBeenCalledTimes(1)
		})

		it('preserves a dismissal completed during a firmware check', async () => {
			const persistenceStarted = createDeferred<void>()
			const persistenceBarrier = createDeferred<void>()
			const existingUpdate = makeUpdate({ version: '4.0.0' })
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(new Map([[7, []]])),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(7, {
				id: 7,
				availableFirmwareUpdates: [existingUpdate],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})
			nodes._store.set(7, {
				availableFirmwareUpdates: [existingUpdate],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})
			nodes.persistStagedNodeUpdates.mockImplementation(async () => {
				persistenceStarted.resolve()
				await persistenceBarrier.promise
			})
			let persistedDismissals: Record<string, boolean> | undefined
			vi.mocked(nodes.updateStoreNodes).mockImplementation(() => {
				persistedDismissals = {
					...nodes._store.get(7)?.firmwareUpdatesDismissed,
				}
				return Promise.resolve()
			})
			const { service } = createService({ driver, nodes })

			const check = service.checkAllNodesFirmwareUpdates()
			await persistenceStarted.promise
			const dismissal = service.dismissFirmwareUpdate(7, '4.0.0')
			persistenceBarrier.resolve()

			await check
			await dismissal

			expect(nodes._nodes.get(7)?.firmwareUpdatesDismissed).toStrictEqual(
				{ '4.0.0': true },
			)
			expect(nodes._store.get(7)?.firmwareUpdatesDismissed).toStrictEqual(
				{ '4.0.0': true },
			)
			expect(persistedDismissals).toStrictEqual({ '4.0.0': true })
		})

		it('persists network updates before publishing them', async () => {
			const checkTime = 1_700_000_000_000
			vi.spyOn(Date, 'now').mockReturnValue(checkTime)
			const updates = [makeUpdate({ version: '2.0.0' })]
			const map = new Map([[3, updates]])
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(map),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(3, {
				id: 3,
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			const { service } = createService({ driver, nodes })

			await service.checkAllNodesFirmwareUpdates()

			expect(nodes.persistStagedNodeUpdates).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						nodeId: 3,
						availableFirmwareUpdates: updates,
					}),
				]),
			)

			const liveNode = nodes._nodes.get(3)
			expect(liveNode.availableFirmwareUpdates).toEqual(updates)
			expect(liveNode.lastFirmwareUpdateCheck).toBe(checkTime)

			expect(nodes.emitNodeUpdate).toHaveBeenCalledWith(
				liveNode,
				expect.objectContaining({
					availableFirmwareUpdates: updates,
				}),
			)
		})

		it('persists node updates before publishing them', async () => {
			const updates = [makeUpdate({ version: '5.0.0' })]
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi
							.fn()
							.mockResolvedValue(updates),
						getAllAvailableFirmwareUpdates: vi.fn(),
						firmwareUpdateOTA: vi.fn(),
						nodes: { get: vi.fn() },
					},
					firmwareUpdateOTW: vi.fn(),
				}),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(9, {
				id: 9,
				availableFirmwareUpdates: [],
				lastFirmwareUpdateCheck: 0,
				firmwareUpdatesDismissed: {},
			})

			const { service } = createService({ driver, nodes })

			await service.checkNodeFirmwareUpdates(9)

			expect(nodes.persistStagedNodeUpdates).toHaveBeenCalled()

			const liveNode = nodes._nodes.get(9)
			expect(liveNode.availableFirmwareUpdates).toEqual(updates)

			expect(nodes.emitNodeUpdate).toHaveBeenCalledWith(
				liveNode,
				expect.objectContaining({
					availableFirmwareUpdates: updates,
				}),
			)
		})
	})
})
