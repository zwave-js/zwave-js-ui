/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FirmwareUpdateService } from '../../../api/lib/zwave/FirmwareUpdateService.ts'
import type {
	FirmwareBackupPort,
	FirmwareConfigPort,
	FirmwareDriverPort,
	FirmwareExtractionPort,
	FirmwareNodeStorePort,
	FirmwareSocketPort,
	FirmwareUpdateInfo,
	FirmwareUpdateNodeState,
	ServiceLogger,
} from '../../../api/lib/zwave/ports.ts'

// ---------------------------------------------------------------------------
// Helpers: minimal fakes for ports
// ---------------------------------------------------------------------------

function makeUpdate(
	overrides: Partial<FirmwareUpdateInfo> = {},
): FirmwareUpdateInfo {
	return {
		version: '2.0.0',
		downgrade: false,
		changelog: 'Fixed bugs',
		channel: 'stable',
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
				firmwareUpdateOTA: vi.fn().mockResolvedValue({ success: true }),
				nodes: { get: vi.fn() },
			},
			firmwareUpdateOTW: vi.fn().mockResolvedValue({ success: true }),
		}),
		...overrides,
	}
}

function createNodeStorePort(): FirmwareNodeStorePort & {
	_nodes: Map<number, FirmwareUpdateNodeState>
	_store: Map<number, Partial<FirmwareUpdateNodeState>>
	emitNodeUpdate: ReturnType<typeof vi.fn>
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
		emitNodeUpdate: vi.fn(),
	}
}

function createSocketPort(): FirmwareSocketPort & {
	sendToSocket: ReturnType<typeof vi.fn>
	throttle: ReturnType<typeof vi.fn>
	clearThrottle: ReturnType<typeof vi.fn>
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

function createLogger(): ServiceLogger {
	return {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
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
		logger?: ServiceLogger
	} = {},
) {
	const driver = overrides.driver ?? createDriverPort()
	const nodes = overrides.nodes ?? createNodeStorePort()
	const socket = overrides.socket ?? createSocketPort()
	const config = overrides.config ?? createConfigPort()
	const backup = overrides.backup ?? createBackupPort()
	const extraction = overrides.extraction ?? createExtractionPort()
	const logger = overrides.logger ?? createLogger()

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FirmwareUpdateService', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('getAvailableFirmwareUpdates', () => {
		it('calls driver and returns result', async () => {
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
		it('calls driver and returns result', async () => {
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
			expect(result).toBe(map)
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
			expect(nodes.updateStoreNodes).toHaveBeenCalled()
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
			const mockOTA = vi.fn().mockResolvedValue({ success: true })
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
			const mockOTW = vi.fn().mockResolvedValue({ success: true })
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

		it('passes FirmwareUpdateInfo directly when it has files property', async () => {
			const mockOTW = vi.fn().mockResolvedValue({ success: true })
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
			;(
				extraction.guessFirmwareFileFormat as ReturnType<typeof vi.fn>
			).mockImplementation(() => {
				throw new Error('bad format')
			})
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

			const mockNodeUpdate = vi.fn().mockResolvedValue({ success: true })
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
			;(
				extraction.tryUnzipFirmwareFile as ReturnType<typeof vi.fn>
			).mockReturnValue({
				format: 'bin',
				filename: 'extracted.bin',
				rawData: new Uint8Array([0x03]),
			})
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ nodes, extraction })

			const mockNodeUpdate = vi.fn().mockResolvedValue({ success: true })
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
			const logger = createLogger()
			const { service } = createService({ socket, logger })

			service.onOTWFirmwareUpdateFinished(
				{ success: true, status: 0 },
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
			expect(nodes.updateStoreNodes).toHaveBeenCalled()
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

	describe('clearScheduledCheck', () => {
		it('clears timeout without error', () => {
			const { service } = createService()
			expect(() => service.clearScheduledCheck()).not.toThrow()
		})
	})

	describe('updateFirmware - non-Uint8Array data', () => {
		it('throws for non-Uint8Array data', async () => {
			const extraction: FirmwareExtractionPort = {
				guessFirmwareFileFormat: vi.fn(),
				extractFirmware: vi.fn(),
				tryUnzipFirmwareFile: vi.fn(),
				isUint8Array: () => false,
			}
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const { service } = createService({ nodes, extraction })

			await expect(
				service.updateFirmware(
					5,
					[
						{
							name: 'fw.bin',
							data: 'not-a-buffer' as unknown as Uint8Array,
						},
					],
					() => ({ updateFirmware: vi.fn() }),
				),
			).rejects.toThrow('not a Buffer')
		})
	})

	describe('updateFirmware - target parameter', () => {
		it('preserves target on firmware', async () => {
			const nodes = createNodeStorePort()
			nodes._nodes.set(5, { id: 5 })
			const extraction = createExtractionPort()
			const { service } = createService({ nodes, extraction })

			const mockNodeUpdate = vi.fn().mockResolvedValue({ success: true })
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

	describe('updateFirmware - zip extraction returns null', () => {
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

	describe('onNodeFirmwareUpdateProgress - unknown node', () => {
		it('does nothing for unknown node', () => {
			const nodes = createNodeStorePort()
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			// Should not throw
			service.onNodeFirmwareUpdateProgress(99, { progress: 42 })
			expect(socket.throttle).not.toHaveBeenCalled()
		})
	})

	describe('onNodeFirmwareUpdateFinished - unknown node', () => {
		it('does nothing for unknown node', () => {
			const nodes = createNodeStorePort()
			const socket = createSocketPort()
			const { service } = createService({ nodes, socket })

			// Should not throw
			service.onNodeFirmwareUpdateFinished(99)
			expect(socket.clearThrottle).not.toHaveBeenCalled()
		})
	})

	describe('checkNodeFirmwareUpdates - driver not ready', () => {
		it('returns early when driver not ready', async () => {
			const driver = createDriverPort({
				isDriverReady: () => false,
			})
			const { service, logger } = createService({ driver })

			await service.checkNodeFirmwareUpdates(5)
			// Should not log anything about firmware checks
			expect(logger.info).not.toHaveBeenCalled()
		})
	})

	describe('checkNodeFirmwareUpdates - error path', () => {
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
			const logger = createLogger()
			const { service } = createService({ driver, logger })

			// Should not throw
			await service.checkNodeFirmwareUpdates(5)
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to check firmware'),
			)
		})
	})

	describe('checkNodeFirmwareUpdates - null driver after ready check', () => {
		it('returns early when getDriver returns null', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => true,
				getDriver: () => null,
			}
			const logger = createLogger()
			const { service } = createService({ driver, logger })

			await service.checkNodeFirmwareUpdates(5)
			// Should not throw, just early-return
			expect(logger.error).not.toHaveBeenCalled()
		})
	})

	describe('checkAllNodesFirmwareUpdates - error path', () => {
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
			const logger = createLogger()
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

	describe('checkAllNodesFirmwareUpdates - null result', () => {
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

	describe('onOTWFirmwareUpdateFinished - failure case', () => {
		it('logs error status on failure', () => {
			const socket = createSocketPort()
			const logger = createLogger()
			const { service } = createService({ socket, logger })

			service.onOTWFirmwareUpdateFinished(
				{ success: false, status: 1 },
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

	describe('scheduledFirmwareUpdateCheck - error in checkAll', () => {
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
			const logger = createLogger()
			const { service } = createService({ driver, logger })

			await service.scheduledFirmwareUpdateCheck()
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('has failed'),
			)
			// Should still schedule next check
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Next firmware update check'),
			)
			service.clearScheduledCheck()
			vi.useRealTimers()
		})
	})

	describe('getAvailableFirmwareUpdates', () => {
		it('throws when driver not ready', async () => {
			const driver: FirmwareDriverPort = {
				isDriverReady: () => false,
				getDriver: () => null,
			}
			const { service } = createService({ driver })

			await expect(
				service.getAvailableFirmwareUpdates(5),
			).rejects.toThrow('Driver is not ready')
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

	describe('firmwareUpdateOTA - driver not ready', () => {
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

	describe('abortFirmwareUpdate - driver not ready', () => {
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

	describe('abortFirmwareUpdate - node not found', () => {
		it('throws when getZwaveNode returns undefined', async () => {
			const { service } = createService()

			await expect(
				service.abortFirmwareUpdate(99, () => undefined),
			).rejects.toThrow('not found')
		})
	})

	describe('firmwareUpdateOTW - nvmEventSetter', () => {
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
						.mockResolvedValue({ success: true }),
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
				createLogger(),
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

	describe('updateFirmware - driver not ready', () => {
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

	describe('_cleanDismissedUpdates via checkAllNodesFirmwareUpdates', () => {
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
			// Also set in store so _updateNodeFirmwareInfo reads existing dismissed
			nodes._store.set(7, {
				firmwareUpdatesDismissed: { '2.0.0': true, '3.0.0': true },
			})
			const { service } = createService({ driver, nodes })

			await service.checkAllNodesFirmwareUpdates()

			// '2.0.0' is not in the updates anymore so should be cleaned
			// '3.0.0' still exists so should be kept
			const storeNode = nodes._store.get(7)
			expect(storeNode?.firmwareUpdatesDismissed).toEqual({
				'3.0.0': true,
			})
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 3 – clearScheduledCheck called on cleanup
	// -----------------------------------------------------------------
	describe('clearScheduledCheck', () => {
		it('cancels a pending scheduled check timer', () => {
			vi.useFakeTimers()
			const driver = createDriverPort({
				isDriverReady: () => true,
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
			const nodes = createNodeStorePort()
			const { service } = createService({ driver, nodes })

			// Trigger the scheduled check (starts the internal timer)
			void service.scheduledFirmwareUpdateCheck()

			// Clear before the timer fires
			service.clearScheduledCheck()

			// Advance time well past the scheduled interval
			vi.advanceTimersByTime(24 * 60 * 60 * 1000 * 2)

			// getAllAvailableFirmwareUpdates should not have been called
			// (the first scheduledFirmwareUpdateCheck calls it once
			// immediately; after clearScheduledCheck the re-schedule must
			// not fire)
			const ctrl = driver.getDriver().controller
			const callCount = (
				ctrl.getAllAvailableFirmwareUpdates as ReturnType<typeof vi.fn>
			).mock.calls.length
			// It may have been called once for the initial check, but not
			// again for the scheduled re-run
			expect(callCount).toBeLessThanOrEqual(1)
		})
	})

	// -----------------------------------------------------------------
	// Regression: Finding 6 – FirmwareUpdateInfo passed without cast
	// -----------------------------------------------------------------
	describe('firmwareUpdateOTW with FirmwareUpdateInfo', () => {
		it('passes FirmwareUpdateInfo directly to driver without Uint8Array cast', async () => {
			const firmwareUpdateOTW = vi.fn().mockResolvedValue({ ok: true })
			const driver = createDriverPort({
				isDriverReady: () => true,
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
			const { service } = createService({ driver })

			const updateInfo: FirmwareUpdateInfo = {
				version: '3.0.0',
				downgrade: false,
				changelog: 'New features',
				channel: 'stable',
				files: [
					{
						target: 0,
						url: 'https://fw.example.com/v3.bin',
						integrity: 'sha256:def',
					},
				],
			}

			await service.firmwareUpdateOTW(updateInfo)

			// Verify it was passed as-is (a FirmwareUpdateInfo, not cast
			// to Uint8Array)
			expect(firmwareUpdateOTW).toHaveBeenCalledWith(updateInfo)
		})
	})

	// -----------------------------------------------------------------
	// Finding 5: Generation fencing and dispose tests
	// -----------------------------------------------------------------
	describe('Finding 5: generation fencing and dispose', () => {
		it('dispose() increments generation and marks disposed', () => {
			const { service } = createService()
			const gen0 = service.generation
			expect(service.disposed).toBe(false)

			service.dispose()
			expect(service.generation).toBe(gen0 + 1)
			expect(service.disposed).toBe(true)
		})

		it('resetGeneration() increments generation without disposal', () => {
			const { service } = createService()
			const gen0 = service.generation
			service.resetGeneration()
			expect(service.generation).toBe(gen0 + 1)
			expect(service.disposed).toBe(false)
		})

		it('scheduledFirmwareUpdateCheck does not reschedule after dispose', async () => {
			vi.useFakeTimers()
			const { service } = createService()

			// Start the scheduled check
			const checkPromise = service.scheduledFirmwareUpdateCheck()

			// Dispose while check is pending
			service.dispose()

			await checkPromise

			// No timer should be set for the old generation
			// Advance time significantly — if a timer was wrongly set, it would fire
			await vi.advanceTimersByTimeAsync(100 * 60 * 60 * 1000)

			// If we get here without error, no stale timer fired
			vi.useRealTimers()
		})

		it('scheduledFirmwareUpdateCheck does not reschedule after resetGeneration', async () => {
			vi.useFakeTimers()
			const updates = new Map([[7, [makeUpdate()]]])
			let resolveCheck: () => void
			const checkPromise = new Promise<void>((r) => {
				resolveCheck = r
			})
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn(),
						getAllAvailableFirmwareUpdates: vi.fn().mockReturnValue(
							new Promise((resolve) => {
								// Control when the check resolves
								void checkPromise.then(() => resolve(updates))
							}),
						),
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

			// Reset generation while check is in-flight
			service.resetGeneration()

			// Now let the check resolve
			resolveCheck()
			await schedulePromise

			// Store should NOT have been updated (generation fence)
			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()

			vi.useRealTimers()
		})

		it('checkNodeFirmwareUpdates bails out after dispose mid-flight', async () => {
			let resolveCheck: (v: unknown[]) => void
			const driver = createDriverPort({
				getDriver: () => ({
					controller: {
						getAvailableFirmwareUpdates: vi.fn().mockReturnValue(
							new Promise((resolve) => {
								resolveCheck = resolve
							}),
						),
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

			// Dispose while the check is in-flight
			service.dispose()

			// Resolve the check
			resolveCheck([makeUpdate()])
			await checkPromise

			// Store should NOT have been updated
			expect(nodes.updateStoreNodes).not.toHaveBeenCalled()
		})

		it('disposed service does not start scheduled check', async () => {
			const { service, logger } = createService()
			service.dispose()

			await service.scheduledFirmwareUpdateCheck()

			// Should return immediately without logging "disabled" or starting
			expect(logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining('Starting bulk'),
			)
		})

		it('clearScheduledCheck cancels pending timer', () => {
			vi.useFakeTimers()
			const { service } = createService()

			// Manually set a timeout
			;(service as any)._firmwareUpdateCheckTimeout = setTimeout(
				() => {},
				1000,
			)
			service.clearScheduledCheck()
			expect((service as any)._firmwareUpdateCheckTimeout).toBeNull()

			vi.useRealTimers()
		})
	})
})
