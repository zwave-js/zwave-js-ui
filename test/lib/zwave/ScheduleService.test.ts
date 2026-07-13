import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleService } from '../../../api/lib/zwave/ScheduleService.ts'
import { SupervisionStatus } from '@zwave-js/core'
import {
	ScheduleEntryLockScheduleKind,
	ScheduleEntryLockWeekday,
	UserIDStatus,
} from 'zwave-js'
import type {
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	ScheduleEntryLockSlotId,
} from 'zwave-js'
import type {
	ScheduleDriverPort,
	ScheduleNodeStorePort,
	ScheduleUtilsPort,
	ScheduleNodeState,
} from '../../../api/lib/zwave/ports.ts'

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
			}) as ReturnType<ScheduleDriverPort['getDriver']>,
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

async function stubCCStatics(
	overrides: Partial<{
		supportedUsers: number | undefined
		numWeekDaySlots: number
		numYearDaySlots: number
		numDailyRepeatingSlots: number
		userIdStatuses: Record<number, number | undefined>
		scheduleEnabled: Record<number, boolean>
		scheduleKind: Record<number, number | undefined>
		cachedSchedules: Record<string, unknown>
	}> = {},
) {
	const supportedUsers =
		'supportedUsers' in overrides ? overrides.supportedUsers : 2
	const {
		numWeekDaySlots = 1,
		numYearDaySlots = 1,
		numDailyRepeatingSlots = 1,
		userIdStatuses = {},
		scheduleEnabled = {},
		scheduleKind = {},
		cachedSchedules = {},
	} = overrides

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

const weeklyPayload: ScheduleEntryLockWeekDaySchedule = {
	weekday: ScheduleEntryLockWeekday.Monday,
	startHour: 8,
	startMinute: 0,
	stopHour: 17,
	stopMinute: 0,
}

const dailyPayload: ScheduleEntryLockDailyRepeatingSchedule = {
	weekdays: [ScheduleEntryLockWeekday.Sunday],
	startHour: 6,
	startMinute: 30,
	durationHour: 2,
	durationMinute: 0,
}

const yearlyPayload: ScheduleEntryLockYearDaySchedule = {
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
}

describe('ScheduleService', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
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

			await stubCCStatics({ supportedUsers: 0 })

			const p1 = svc.getSchedules(2)

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
				userIdStatuses: { 1: UserIDStatus.Enabled },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]:
						weeklyPayload,
				},
			})

			const result = await svc.getSchedules(2, { fromCache: true })
			expect(result).toBeDefined()
			expect(result?.weekly?.numSlots).toBe(1)
			expect(result?.daily?.numSlots).toBe(1)
			expect(result?.yearly?.numSlots).toBe(1)
		})

		it('allows a subsequent getSchedules call after a rejection', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			const getDriverImpl = driverPort.getDriver.bind(driverPort)
			driverPort.getDriver = () => null

			await stubCCStatics({ supportedUsers: 0 })

			await expect(svc.getSchedules(2)).rejects.toThrow()

			driverPort.getDriver = getDriverImpl
			const result = await svc.getSchedules(2, { fromCache: true })
			expect(result).toBeDefined()
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
					...weeklyPayload,
				} as ScheduleEntryLockSlotId &
					ScheduleEntryLockWeekDaySchedule),
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
					'invalid' as 'daily',
					{
						userId: 1,
						slotId: 1,
					} as ScheduleEntryLockSlotId &
						ScheduleEntryLockDailyRepeatingSchedule,
				),
			).rejects.toThrow('Invalid schedule type')
		})

		it('sets a weekly schedule, calls setWeekDaySchedule, and verifies success via readback', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const cc = zwaveNode.commandClasses['Schedule Entry Lock']
			cc.setWeekDaySchedule.mockResolvedValue(undefined)
			cc.getWeekDaySchedule.mockResolvedValue(weeklyPayload)

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
				...weeklyPayload,
			} as ScheduleEntryLockSlotId & ScheduleEntryLockWeekDaySchedule)

			expect(result?.status).toBe(SupervisionStatus.Success)
			expect(nodeStore.emitCalls.length).toBeGreaterThan(0)

			expect(cc.setWeekDaySchedule).toHaveBeenCalledWith(
				{ userId: 1, slotId: 1 },
				weeklyPayload,
			)
			expect(cc.getWeekDaySchedule).toHaveBeenCalledWith({
				userId: 1,
				slotId: 1,
			})

			expect(cc.setYearDaySchedule).not.toHaveBeenCalled()
			expect(cc.setDailyRepeatingSchedule).not.toHaveBeenCalled()
			expect(cc.getYearDaySchedule).not.toHaveBeenCalled()
			expect(cc.getDailyRepeatingSchedule).not.toHaveBeenCalled()
		})

		it('handles delete (empty schedule) via readback', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const cc = zwaveNode.commandClasses['Schedule Entry Lock']
			cc.setWeekDaySchedule.mockResolvedValue(undefined)
			cc.getWeekDaySchedule.mockResolvedValue(undefined)

			const existingSlot: ScheduleEntryLockSlotId &
				ScheduleEntryLockWeekDaySchedule & { enabled: boolean } = {
				userId: 1,
				slotId: 1,
				enabled: true,
				...weeklyPayload,
			}

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: {
						numSlots: 1,
						slots: [existingSlot],
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
			} as ScheduleEntryLockSlotId & ScheduleEntryLockWeekDaySchedule)

			expect(result?.status).toBe(SupervisionStatus.Success)
		})

		it('returns supervision result directly when supervised (daily)', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const cc = zwaveNode.commandClasses['Schedule Entry Lock']
			cc.setDailyRepeatingSchedule.mockResolvedValue({
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
				...dailyPayload,
			} as ScheduleEntryLockSlotId &
				ScheduleEntryLockDailyRepeatingSchedule)

			expect(result?.status).toBe(SupervisionStatus.Success)

			expect(cc.setDailyRepeatingSchedule).toHaveBeenCalledWith(
				{ userId: 1, slotId: 1 },
				dailyPayload,
			)

			expect(cc.setWeekDaySchedule).not.toHaveBeenCalled()
			expect(cc.setYearDaySchedule).not.toHaveBeenCalled()
			expect(cc.getWeekDaySchedule).not.toHaveBeenCalled()
			expect(cc.getYearDaySchedule).not.toHaveBeenCalled()
			expect(cc.getDailyRepeatingSchedule).not.toHaveBeenCalled()
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
					}) as ReturnType<ScheduleDriverPort['getDriver']>,
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

	describe('getSchedules – slot management via cache', () => {
		it('adds a new cached slot to the returned schedule', async () => {
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
				numYearDaySlots: 0,
				numDailyRepeatingSlots: 0,
				userIdStatuses: { 1: 1 },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]:
						weeklyPayload,
				},
			})

			const result = await svc.getSchedules(2, { fromCache: true })

			expect(result?.weekly?.slots?.length).toBe(1)
			const slot = result?.weekly?.slots?.[0]
			expect(slot?.userId).toBe(1)
			expect(slot?.slotId).toBe(1)
			expect(slot?.weekday).toBe(ScheduleEntryLockWeekday.Monday)
			expect(slot?.startHour).toBe(8)
		})

		it('replaces an existing slot with the same userId/slotId on cache refresh', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)

			const existingSlot = {
				userId: 1,
				slotId: 1,
				weekday: ScheduleEntryLockWeekday.Saturday,
				startHour: 0,
				startMinute: 0,
				stopHour: 1,
				stopMinute: 0,
				enabled: true,
			}
			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: { numSlots: 1, slots: [existingSlot] },
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: undefined,
			})
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: 1,
				numWeekDaySlots: 1,
				numYearDaySlots: 0,
				numDailyRepeatingSlots: 0,
				userIdStatuses: { 1: 1 },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]:
						weeklyPayload,
				},
			})

			const result = await svc.getSchedules(2, { fromCache: true })

			expect(result?.weekly?.slots?.length).toBe(1)
			const slot = result?.weekly?.slots?.[0]
			expect(slot?.weekday).toBe(ScheduleEntryLockWeekday.Monday)
			expect(slot?.startHour).toBe(8)
			expect(slot?.stopHour).toBe(17)
		})

		it('removes an existing slot when cache returns undefined', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)

			const existingSlot = {
				userId: 1,
				slotId: 1,
				weekday: ScheduleEntryLockWeekday.Monday,
				startHour: 8,
				startMinute: 0,
				stopHour: 17,
				stopMinute: 0,
				enabled: true,
			}
			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: { numSlots: 1, slots: [existingSlot] },
					yearly: { numSlots: 0, slots: [] },
				},
				userCodes: undefined,
			})
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: 1,
				numWeekDaySlots: 1,
				numYearDaySlots: 0,
				numDailyRepeatingSlots: 0,
				userIdStatuses: { 1: 1 },
				scheduleEnabled: { 1: true },
				scheduleKind: {
					1: ScheduleEntryLockScheduleKind.WeekDay,
				},
				cachedSchedules: {},
			})

			const result = await svc.getSchedules(2, { fromCache: true })

			expect(result?.weekly?.slots?.length).toBe(0)
		})
	})

	describe('setSchedule – yearly', () => {
		it('sets a yearly schedule via supervision, does not call weekly/daily', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const cc = zwaveNode.commandClasses['Schedule Entry Lock']
			cc.setYearDaySchedule.mockResolvedValue({
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
				...yearlyPayload,
			} as ScheduleEntryLockSlotId & ScheduleEntryLockYearDaySchedule)

			expect(result?.status).toBe(SupervisionStatus.Success)

			expect(cc.setYearDaySchedule).toHaveBeenCalledWith(
				{ userId: 1, slotId: 1 },
				yearlyPayload,
			)

			expect(cc.setWeekDaySchedule).not.toHaveBeenCalled()
			expect(cc.setDailyRepeatingSchedule).not.toHaveBeenCalled()
			expect(cc.getWeekDaySchedule).not.toHaveBeenCalled()
			expect(cc.getDailyRepeatingSchedule).not.toHaveBeenCalled()
			expect(cc.getYearDaySchedule).not.toHaveBeenCalled()
		})
	})

	describe('setSchedule – readback mismatch', () => {
		it('returns Fail when readback does not match', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const cc = zwaveNode.commandClasses['Schedule Entry Lock']
			cc.setWeekDaySchedule.mockResolvedValue(undefined)
			cc.getWeekDaySchedule.mockResolvedValue({
				weekday: ScheduleEntryLockWeekday.Saturday,
				startHour: 0,
				startMinute: 0,
				stopHour: 0,
				stopMinute: 0,
			} satisfies ScheduleEntryLockWeekDaySchedule)

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
				...weeklyPayload,
			} as ScheduleEntryLockSlotId & ScheduleEntryLockWeekDaySchedule)

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

			zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].getWeekDaySchedule.mockImplementation(() => {
				svc.cancelGetSchedule()
				return Promise.resolve(weeklyPayload)
			})

			const result = await svc.getSchedules(2, {
				fromCache: false,
			})
			expect(result).toBeUndefined()

			await stubCCStatics({ supportedUsers: 0 })
			const result2 = await svc.getSchedules(2, { fromCache: true })
			expect(result2).toBeDefined()
		})
	})

	describe('getSchedules – unknown userCodes', () => {
		it('populates slot counts and emits node update when userCodes is undefined', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const driverPort = createDriverPort(zwaveNode)
			const nodeStore = createNodeStorePort()
			const svc = new ScheduleService(
				driverPort,
				nodeStore,
				createUtilsPort(),
			)

			await stubCCStatics({
				supportedUsers: undefined,
				numWeekDaySlots: 3,
				numYearDaySlots: 2,
				numDailyRepeatingSlots: 1,
			})

			const result = await svc.getSchedules(2)

			expect(result).toBeDefined()
			expect(result?.weekly?.numSlots).toBe(3)
			expect(result?.yearly?.numSlots).toBe(2)
			expect(result?.daily?.numSlots).toBe(1)
			expect(result?.weekly?.slots).toEqual([])
			expect(result?.yearly?.slots).toEqual([])
			expect(result?.daily?.slots).toEqual([])

			expect(nodeStore.emitCalls.length).toBe(1)
			const [emittedNode, emittedProps] = nodeStore.emitCalls[0] as [
				ScheduleNodeState,
				Record<string, unknown>,
			]
			expect(emittedNode.id).toBe(2)
			expect(emittedProps).toHaveProperty('schedule')
			expect(emittedProps).toHaveProperty('userCodes')

			expect(emittedNode.userCodes?.total).toBe(0)
		})

		it('populates slot counts when userCodes is null (upstream permits)', async () => {
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
				null as unknown as number,
			)
			const { ScheduleEntryLockCC } = await import('zwave-js')
			vi.spyOn(
				ScheduleEntryLockCC,
				'getNumWeekDaySlotsCached',
			).mockReturnValue(2)
			vi.spyOn(
				ScheduleEntryLockCC,
				'getNumYearDaySlotsCached',
			).mockReturnValue(1)
			vi.spyOn(
				ScheduleEntryLockCC,
				'getNumDailyRepeatingSlotsCached',
			).mockReturnValue(0)

			const result = await svc.getSchedules(2)

			expect(result).toBeDefined()
			expect(result?.weekly?.numSlots).toBe(2)
			expect(result?.yearly?.numSlots).toBe(1)
			expect(result?.daily?.numSlots).toBe(0)

			expect(nodeStore.emitCalls.length).toBe(1)
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
					[`${ScheduleEntryLockScheduleKind.WeekDay}-1-1`]:
						weeklyPayload,
				},
			})

			const result = await svc.getSchedules(2, {
				fromCache: true,
				mode: 'weekly',
			})
			expect(result).toBeDefined()
			expect(result?.weekly?.slots?.length).toBe(1)
		})
	})

	describe('setSchedule – updates existing slot', () => {
		it('updates an existing slot in the schedule on success', async () => {
			const zwaveNode = createFakeZwaveNode(true)
			const updatedData: ScheduleEntryLockWeekDaySchedule = {
				weekday: ScheduleEntryLockWeekday.Wednesday,
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

			const existingSlot: ScheduleEntryLockSlotId &
				ScheduleEntryLockWeekDaySchedule & { enabled: boolean } = {
				userId: 1,
				slotId: 1,
				enabled: true,
				...weeklyPayload,
			}

			const nodeStore = createNodeStorePort({
				id: 2,
				schedule: {
					daily: { numSlots: 0, slots: [] },
					weekly: {
						numSlots: 1,
						slots: [existingSlot],
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
				...updatedData,
			} as ScheduleEntryLockSlotId & ScheduleEntryLockWeekDaySchedule)

			expect(result?.status).toBe(SupervisionStatus.Success)
			const node = nodeStore.getNode(2)
			expect(node?.schedule?.weekly?.slots?.length).toBe(1)
			const slot = node?.schedule?.weekly?.slots?.[0]
			expect(slot).toBeDefined()
			expect(slot?.weekday).toBe(ScheduleEntryLockWeekday.Wednesday)
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
				...weeklyPayload,
			} as ScheduleEntryLockSlotId & ScheduleEntryLockWeekDaySchedule)

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
			expect(nodeStore.emitCalls).toEqual([
				[expect.objectContaining({ id: 2 }), { userCodes: undefined }],
			])
		})

		it('emits unchanged state for an all-users update when node has no userCodes', async () => {
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

			await svc.setEnabledSchedule(2, true, 0)
			expect(nodeStore.emitCalls).toEqual([
				[expect.objectContaining({ id: 2 }), { userCodes: undefined }],
			])
		})
	})
})
