import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleService } from '../../../api/lib/zwave/ScheduleService.ts'
import { SupervisionStatus } from '@zwave-js/core'
import { ScheduleEntryLockScheduleKind, UserIDStatus } from 'zwave-js'
import type {
	ScheduleDriverPort,
	ScheduleNodeStorePort,
	ScheduleUtilsPort,
	ScheduleNodeState,
} from '../../../api/lib/zwave/ports.ts'

// ---------------------------------------------------------------------------
// Helpers: minimal fakes for ports
// ---------------------------------------------------------------------------

function createFakeEndpoint() {
	return { id: 0 }
}

function createFakeZwaveNode(supported = true) {
	return {
		id: 2,
		getEndpoint: vi.fn(() => createFakeEndpoint()),
		commandClasses: {
			'Schedule Entry Lock': {
				isSupported: vi.fn(() => supported),
				getWeekDaySchedule: vi.fn(),
				getYearDaySchedule: vi.fn(),
				getDailyRepeatingSchedule: vi.fn(),
				setWeekDaySchedule: vi.fn(),
				setYearDaySchedule: vi.fn(),
				setDailyRepeatingSchedule: vi.fn(),
				setEnabled: vi.fn(),
			},
		},
	}
}

function createDriverPort(
	zwaveNode?: ReturnType<typeof createFakeZwaveNode>,
): ScheduleDriverPort {
	const node = zwaveNode ?? createFakeZwaveNode()
	return {
		getDriver: () =>
			({
				controller: {
					nodes: {
						get: vi.fn((id: number) =>
							id === node.id ? node : undefined,
						),
					},
				},
			}) as any,
	}
}

function createNodeStorePort(
	initialNode?: ScheduleNodeState,
): ScheduleNodeStorePort & { emitCalls: unknown[][] } {
	const emitCalls: unknown[][] = []
	const node: ScheduleNodeState = initialNode ?? {
		id: 2,
		schedule: undefined,
		userCodes: undefined,
	}
	return {
		getNode: vi.fn((id: number) => (id === node.id ? node : undefined)),
		emitNodeUpdate: vi.fn((...args) => emitCalls.push(args)),
		emitCalls,
	}
}

function createUtilsPort(): ScheduleUtilsPort {
	return {
		deepEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
	}
}

// Stub out the CC statics so we don't need a real driver
async function stubCCStatics(
	overrides: Partial<{
		supportedUsers: number
		numWeekDaySlots: number
		numYearDaySlots: number
		numDailyRepeatingSlots: number
		userIdStatuses: Record<number, number | undefined>
		scheduleEnabled: Record<number, boolean>
		scheduleKind: Record<number, number | undefined>
		cachedSchedules: Record<string, unknown>
	}> = {},
) {
	const {
		supportedUsers = 2,
		numWeekDaySlots = 1,
		numYearDaySlots = 1,
		numDailyRepeatingSlots = 1,
		userIdStatuses = {},
		scheduleEnabled = {},
		scheduleKind = {},
		cachedSchedules = {},
	} = overrides

	// We need to mock static methods on the CC classes
	const { UserCodeCC, ScheduleEntryLockCC } = await import('zwave-js')

	vi.spyOn(UserCodeCC, 'getSupportedUsersCached').mockReturnValue(
		supportedUsers,
	)
	vi.spyOn(UserCodeCC, 'getUserIdStatusCached').mockImplementation(
		(_driver, _ep, userId) =>
			userIdStatuses[userId] ?? UserIDStatus.Available,
	)
	vi.spyOn(ScheduleEntryLockCC, 'getNumWeekDaySlotsCached').mockReturnValue(
		numWeekDaySlots,
	)
	vi.spyOn(ScheduleEntryLockCC, 'getNumYearDaySlotsCached').mockReturnValue(
		numYearDaySlots,
	)
	vi.spyOn(
		ScheduleEntryLockCC,
		'getNumDailyRepeatingSlotsCached',
	).mockReturnValue(numDailyRepeatingSlots)
	vi.spyOn(
		ScheduleEntryLockCC,
		'getUserCodeScheduleEnabledCached',
	).mockImplementation(
		(_driver, _ep, userId) => scheduleEnabled[userId] ?? false,
	)
	vi.spyOn(
		ScheduleEntryLockCC,
		'getUserCodeScheduleKindCached',
	).mockImplementation(
		(_driver, _ep, userId) => scheduleKind[userId] ?? undefined,
	)
	vi.spyOn(ScheduleEntryLockCC, 'getScheduleCached').mockImplementation(
		(_driver, _ep, kind, userId, slotId) =>
			cachedSchedules[`${kind}-${userId}-${slotId}`] ?? undefined,
	)

	return { UserCodeCC, ScheduleEntryLockCC }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScheduleService', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	describe('construction and initial state', () => {
		it('starts with lock=false and cancel=false', () => {
			const svc = new ScheduleService(
				createDriverPort(),
				createNodeStorePort(),
				createUtilsPort(),
			)
			expect(svc.lockGetSchedule).toBe(false)
			expect(svc.cancelGetScheduleFlag).toBe(false)
		})
	})

	describe('cancelGetSchedule', () => {
		it('sets the cancel flag', () => {
			const svc = new ScheduleService(
				createDriverPort(),
				createNodeStorePort(),
				createUtilsPort(),
			)
			svc.cancelGetSchedule()
			expect(svc.cancelGetScheduleFlag).toBe(true)
		})
	})

	describe('getSchedules', () => {
		it('throws if Schedule Entry Lock CC is not supported', async () => {
			const zwaveNode = createFakeZwaveNode(false)
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				createNodeStorePort(),
				createUtilsPort(),
			)
			await expect(svc.getSchedules(2)).rejects.toThrow(
				'Schedule Entry Lock CC not supported on node 2',
			)
		})

		it('throws if another request is in progress', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			// Stub CC statics to return 0 users so the first call resolves quickly
			await stubCCStatics({ supportedUsers: 0 })

			// Start a long request
			const p1 = svc.getSchedules(2)
			// A second one should throw
			await expect(svc.getSchedules(2)).rejects.toThrow(
				'Another request is in progress',
			)
			await p1
		})

		it('returns undefined if node is not in store', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort({
				id: 999,
				schedule: undefined,
				userCodes: undefined,
			})
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)
			await stubCCStatics({ supportedUsers: 0 })

			const result = await svc.getSchedules(2)
			expect(result).toBeUndefined()
		})

		it('builds schedule structure from cached data', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: 1,
				numWeekDaySlots: 1,
				numYearDaySlots: 1,
				numDailyRepeatingSlots: 1,
				userIdStatuses: { 1: 1 /* Enabled */ },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]: {
						dayOfWeek: 1,
						startHour: 8,
						startMinute: 0,
						stopHour: 17,
						stopMinute: 0,
					},
				},
			})

			const result = await svc.getSchedules(2, { fromCache: true })
			expect(result).toBeDefined()
			expect(result?.weekly?.numSlots).toBe(1)
			expect(result?.daily?.numSlots).toBe(1)
			expect(result?.yearly?.numSlots).toBe(1)
			// Verify lock is released
			expect(svc.lockGetSchedule).toBe(false)
		})

		it('releases lock even if promise rejects', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort: ScheduleDriverPort = {
				getDriver: () => null, // will cause NPE inside
			}
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await expect(svc.getSchedules(2)).rejects.toThrow()
			expect(svc.lockGetSchedule).toBe(false)
			expect(svc.cancelGetScheduleFlag).toBe(false)
		})
	})

	describe('setSchedule', () => {
		it('throws for unsupported CC', async () => {
			const zwaveNode = createFakeZwaveNode(false)
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				createNodeStorePort(),
				createUtilsPort(),
			)
			await expect(
				svc.setSchedule(2, 'weekly', {
					userId: 1,
					slotId: 1,
					dayOfWeek: 1,
					startHour: 8,
					startMinute: 0,
					stopHour: 17,
					stopMinute: 0,
				} as any),
			).rejects.toThrow('Schedule Entry Lock CC not supported')
		})

		it('throws for invalid schedule type', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				createNodeStorePort(),
				createUtilsPort(),
			)
			await expect(
				svc.setSchedule(
					2,
					'invalid' as any,
					{
						userId: 1,
						slotId: 1,
					} as any,
				),
			).rejects.toThrow('Invalid schedule type')
		})

		it('sets a weekly schedule and verifies success via readback', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const scheduleData = {
				dayOfWeek: 1,
				startHour: 8,
				startMinute: 0,
				stopHour: 17,
				stopMinute: 0,
			}
			// setWeekDaySchedule returns undefined (no supervision)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule.mockResolvedValue(undefined)
			// readback returns matching data
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].getWeekDaySchedule.mockResolvedValue(scheduleData)

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: { numSlots: 1, slots: [] },
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'weekly', {
				userId: 1,
				slotId: 1,
				...scheduleData,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
			expect(nodeStore.emitCalls.length).toBeGreaterThan(0)
		})

		it('handles delete (empty schedule) via readback', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule.mockResolvedValue(undefined)
			// readback returns undefined (deleted)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].getWeekDaySchedule.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: {
						numSlots: 1,
						slots: [
							{
								userId: 1,
								slotId: 1,
								enabled: true,
								dayOfWeek: 1,
								startHour: 8,
								startMinute: 0,
								stopHour: 17,
								stopMinute: 0,
							} as any,
						],
					},
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [1] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'weekly', {
				userId: 1,
				slotId: 1,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
		})

		it('returns supervision result directly when supervised', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setDailyRepeatingSchedule.mockResolvedValue({
				status: SupervisionStatus.Success,
			})

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 1, slots: [] },
					weekly: { numSlots: 0, slots: [] },
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'daily', {
				userId: 1,
				slotId: 1,
				weekday: 0,
				startHour: 6,
				startMinute: 30,
				durationHour: 2,
				durationMinute: 0,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
		})
	})

	describe('setEnabledSchedule', () => {
		it('throws when node not found', async () => {
			const driverPort: ScheduleDriverPort = {
				getDriver: () =>
					({
						controller: {
							nodes: { get: () => undefined },
						},
					}) as any,
			}
			const svc = new ScheduleService(
				driverPort,
				createNodeStorePort(),
				createUtilsPort(),
			)
			await expect(svc.setEnabledSchedule(99, true, 1)).rejects.toThrow(
				'Node not found',
			)
		})

		it('enables a user and emits update', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setEnabled.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				userCodes: { total: 1, available: [1], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			await svc.setEnabledSchedule(2, true, 1)
			const node = nodeStore.getNode(2)
			expect(node?.userCodes?.enabled).toContain(1)
		})

		it('disables a user and emits update', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setEnabled.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				userCodes: { total: 1, available: [1], enabled: [1] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			await svc.setEnabledSchedule(2, false, 1)
			const node = nodeStore.getNode(2)
			expect(node?.userCodes?.enabled).not.toContain(1)
		})

		it('enables all users when userId is 0', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setEnabled.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				userCodes: { total: 3, available: [1, 2, 3], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			await svc.setEnabledSchedule(2, true, 0)
			const node = nodeStore.getNode(2)
			expect(node?.userCodes?.enabled).toEqual([1, 2, 3])
		})

		it('disables all users when userId is 0', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setEnabled.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				userCodes: {
					total: 3,
					available: [1, 2, 3],
					enabled: [1, 2, 3],
				},
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			await svc.setEnabledSchedule(2, false, 0)
			const node = nodeStore.getNode(2)
			expect(node?.userCodes?.enabled).toEqual([])
		})
	})

	describe('_pushSchedule (static)', () => {
		it('updates an existing slot in place', () => {
			const arr: any[] = [
				{ userId: 1, slotId: 1, dayOfWeek: 1, enabled: false },
			]
			ScheduleService._pushSchedule(
				arr,
				{ userId: 1, slotId: 1 },
				{ dayOfWeek: 2 } as any,
				true,
			)
			expect(arr.length).toBe(1)
			expect(arr[0].dayOfWeek).toBe(2)
			expect(arr[0].enabled).toBe(true)
		})

		it('removes a slot when schedule is undefined and slot exists', () => {
			const arr: any[] = [
				{ userId: 1, slotId: 1, dayOfWeek: 1, enabled: true },
			]
			ScheduleService._pushSchedule(
				arr,
				{ userId: 1, slotId: 1 },
				undefined,
				false,
			)
			expect(arr.length).toBe(0)
		})

		it('does nothing when schedule is undefined and slot does not exist', () => {
			const arr: any[] = []
			ScheduleService._pushSchedule(
				arr,
				{ userId: 1, slotId: 1 },
				undefined,
				false,
			)
			expect(arr.length).toBe(0)
		})
	})

	describe('setSchedule – yearly', () => {
		it('sets a yearly schedule via supervision', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setYearDaySchedule.mockResolvedValue({
				status: SupervisionStatus.Success,
			})

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: { numSlots: 0, slots: [] },
					yearly: { numSlots: 1, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'yearly', {
				userId: 1,
				slotId: 1,
				startYear: 2025,
				startMonth: 6,
				startDay: 15,
				startHour: 9,
				startMinute: 0,
				stopYear: 2025,
				stopMonth: 6,
				stopDay: 15,
				stopHour: 18,
				stopMinute: 0,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
		})
	})

	describe('setSchedule – readback mismatch', () => {
		it('returns Fail when readback does not match', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule.mockResolvedValue(undefined)
			// Readback returns different data
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].getWeekDaySchedule.mockResolvedValue({
				dayOfWeek: 99,
			})

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: { numSlots: 1, slots: [] },
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'weekly', {
				userId: 1,
				slotId: 1,
				dayOfWeek: 1,
				startHour: 8,
				startMinute: 0,
				stopHour: 17,
				stopMinute: 0,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Fail)
		})
	})

	describe('getSchedules – cancellation', () => {
		it('returns undefined when cancelled during iteration', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: 1,
				numWeekDaySlots: 2,
				numYearDaySlots: 0,
				numDailyRepeatingSlots: 0,
				userIdStatuses: { 1: 1 },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
			})

			// Get from device (not cache), mock getWeekDaySchedule to set cancel
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].getWeekDaySchedule.mockImplementation(() => {
				svc.cancelGetSchedule()
				return Promise.resolve({ dayOfWeek: 1 })
			})

			const result = await svc.getSchedules(2, {
				fromCache: false,
			})
			expect(result).toBeUndefined()
			// Lock is released
			expect(svc.lockGetSchedule).toBe(false)
		})
	})

	describe('getSchedules – returns undefined when userCodes is null', () => {
		it('returns undefined when getSupportedUsersCached returns undefined', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			const { UserCodeCC } = await import('zwave-js')
			vi.spyOn(UserCodeCC, 'getSupportedUsersCached').mockReturnValue(
				undefined as any,
			)

			const result = await svc.getSchedules(2)
			expect(result).toBeUndefined()
			expect(svc.lockGetSchedule).toBe(false)
		})
	})

	describe('getSchedules – mode filtering', () => {
		it('only fetches weekly schedules when mode is WEEKLY', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: 1,
				numWeekDaySlots: 1,
				numYearDaySlots: 1,
				numDailyRepeatingSlots: 1,
				userIdStatuses: { 1: 1 },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]: {
						dayOfWeek: 1,
						startHour: 8,
						startMinute: 0,
						stopHour: 17,
						stopMinute: 0,
					},
				},
			})

			const result = await svc.getSchedules(2, {
				fromCache: true,
				mode: 'weekly' as any,
			})
			expect(result).toBeDefined()
			expect(result?.weekly?.slots?.length).toBe(1)
		})
	})

	describe('setSchedule – updates existing slot', () => {
		it('updates an existing slot in the schedule on success', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const scheduleData = {
				dayOfWeek: 3,
				startHour: 10,
				startMinute: 0,
				stopHour: 18,
				stopMinute: 0,
			}
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule.mockResolvedValue({
				status: SupervisionStatus.Success,
			})

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: {
						numSlots: 1,
						slots: [
							{
								userId: 1,
								slotId: 1,
								dayOfWeek: 1,
								startHour: 8,
								startMinute: 0,
								stopHour: 17,
								stopMinute: 0,
								enabled: true,
							} as any,
						],
					},
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: { total: 1, available: [1], enabled: [1] },
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'weekly', {
				userId: 1,
				slotId: 1,
				...scheduleData,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
			// The existing slot should be updated
			const node = nodeStore.getNode(2)
			expect(node?.schedule?.weekly?.slots?.length).toBe(1)
			expect((node?.schedule?.weekly?.slots?.[0] as any)?.dayOfWeek).toBe(
				3,
			)
		})
	})

	describe('setSchedule – no schedule on node', () => {
		it('returns result when node has no schedule object', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule.mockResolvedValue({
				status: SupervisionStatus.Success,
			})

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: undefined,
				userCodes: undefined,
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			const result = await svc.setSchedule(2, 'weekly', {
				userId: 1,
				slotId: 1,
				dayOfWeek: 1,
				startHour: 8,
				startMinute: 0,
				stopHour: 17,
				stopMinute: 0,
			} as any)

			expect(result?.status).toBe(SupervisionStatus.Success)
		})
	})

	describe('setEnabledSchedule – no userCodes', () => {
		it('does not throw when node has no userCodes', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setEnabled.mockResolvedValue(undefined)

			const nodeStore = createNodeStorePort({
				id: 2,
				userCodes: undefined,
			})
			const svc = new ScheduleService(
				createDriverPort(zwaveNode),
				nodeStore,
				createUtilsPort(),
			)

			await svc.setEnabledSchedule(2, true, 1)
			// Should not throw
		})
	})
})
