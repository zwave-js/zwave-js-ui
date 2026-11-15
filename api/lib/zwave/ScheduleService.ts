import type {
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	ZWaveNode,
} from 'zwave-js'
import {
	ScheduleEntryLockCC,
	ScheduleEntryLockScheduleKind,
	UserCodeCC,
	UserIDStatus,
	type Driver,
} from 'zwave-js'
import { isUnsupervisedOrSucceeded, SupervisionStatus } from '@zwave-js/core'
import type { SupervisionResult } from '@zwave-js/core'

import {
	ZUIScheduleEntryLockMode,
	type ZUIScheduleEntryLockMode as ZUIScheduleEntryLockModeType,
	type ZUISchedule,
	type ZUISlot,
	type ScheduleDriverPort,
	type ScheduleNodeStorePort,
	type ScheduleUtilsPort,
	type ScheduleNodeState,
} from './ports.ts'

type AnySchedule =
	| ScheduleEntryLockDailyRepeatingSchedule
	| ScheduleEntryLockWeekDaySchedule
	| ScheduleEntryLockYearDaySchedule

export class ScheduleService {
	private _lockGetSchedule = false
	private _cancelGetSchedule = false

	private readonly _driver: ScheduleDriverPort
	private readonly _nodes: ScheduleNodeStorePort
	private readonly _utils: ScheduleUtilsPort

	constructor(
		driver: ScheduleDriverPort,
		nodes: ScheduleNodeStorePort,
		utils: ScheduleUtilsPort,
	) {
		this._driver = driver
		this._nodes = nodes
		this._utils = utils
	}

	private _getZwaveNode(nodeId: number): ZWaveNode | undefined {
		return this._driver.getDriver()?.controller.nodes.get(nodeId)
	}

	private _requireScheduleCC(nodeId: number): ZWaveNode {
		const zwaveNode = this._getZwaveNode(nodeId)
		if (!zwaveNode?.commandClasses['Schedule Entry Lock'].isSupported()) {
			throw new Error(
				'Schedule Entry Lock CC not supported on node ' + nodeId,
			)
		}
		return zwaveNode
	}

	private static _pushSchedule(
		arr: ZUISlot<AnySchedule>[],
		slot: ScheduleEntryLockSlotId,
		schedule: AnySchedule | undefined,
		enabled: boolean,
	): void {
		const index = arr.findIndex(
			(s) => s.userId === slot.userId && s.slotId === slot.slotId,
		)
		if (schedule) {
			const newSlot: ZUISlot<AnySchedule> = {
				...slot,
				...schedule,
				enabled,
			} as ZUISlot<AnySchedule>
			if (index === -1) {
				arr.push(newSlot)
			} else {
				arr[index] = newSlot
			}
		} else if (index !== -1) {
			arr.splice(index, 1)
		}
	}

	async getSchedules(
		nodeId: number,
		opts: { mode?: ZUIScheduleEntryLockModeType; fromCache: boolean } = {
			fromCache: true,
		},
	): Promise<ZUISchedule | undefined> {
		const zwaveNode = this._requireScheduleCC(nodeId)

		if (this._lockGetSchedule) {
			throw new Error(
				'Another request is in progress, cancel it or wait...',
			)
		}

		const promise = async (): Promise<ZUISchedule | undefined> => {
			this._cancelGetSchedule = false
			this._lockGetSchedule = true
			const { mode, fromCache } = opts
			const endpointIndex = 0
			const endpoint = zwaveNode.getEndpoint(endpointIndex)

			const driver = this._driver.getDriver()
			if (!driver) return undefined

			const userCodes =
				UserCodeCC.getSupportedUsersCached(driver, endpoint) ?? 0

			const numSlots = {
				numWeekDaySlots: ScheduleEntryLockCC.getNumWeekDaySlotsCached(
					driver,
					endpoint,
				),
				numYearDaySlots: ScheduleEntryLockCC.getNumYearDaySlotsCached(
					driver,
					endpoint,
				),
				numDailyRepeatingSlots:
					ScheduleEntryLockCC.getNumDailyRepeatingSlotsCached(
						driver,
						endpoint,
					),
			}

			const node = this._nodes.getNode(nodeId)
			if (!node) return undefined

			const weeklySchedules: ZUISlot<ScheduleEntryLockWeekDaySchedule>[] =
				node.schedule?.weekly?.slots ?? []
			const yearlySchedules: ZUISlot<ScheduleEntryLockYearDaySchedule>[] =
				node.schedule?.yearly?.slots ?? []
			const dailySchedules: ZUISlot<ScheduleEntryLockDailyRepeatingSchedule>[] =
				node.schedule?.daily?.slots ?? []

			node.schedule = {
				daily: {
					numSlots: numSlots.numDailyRepeatingSlots,
					slots: dailySchedules,
				},
				weekly: {
					numSlots: numSlots.numWeekDaySlots,
					slots: weeklySchedules,
				},
				yearly: {
					numSlots: numSlots.numYearDaySlots,
					slots: yearlySchedules,
				},
			}

			node.userCodes = {
				total: userCodes,
				available: [],
				enabled: [],
			}

			for (let i = 1; i <= userCodes; i++) {
				const status = UserCodeCC.getUserIdStatusCached(
					driver,
					endpoint,
					i,
				)

				if (
					status === undefined ||
					status === UserIDStatus.Available ||
					status === UserIDStatus.StatusNotAvailable
				) {
					continue
				}

				node.userCodes.available.push(i)

				const enabledUserId =
					ScheduleEntryLockCC.getUserCodeScheduleEnabledCached(
						driver,
						endpoint,
						i,
					)

				if (enabledUserId) {
					node.userCodes.enabled.push(i)
				}

				const enabledType =
					ScheduleEntryLockCC.getUserCodeScheduleKindCached(
						driver,
						endpoint,
						i,
					)

				const getCached = (
					kind: ScheduleEntryLockScheduleKind,
					slotId: number,
				) =>
					ScheduleEntryLockCC.getScheduleCached(
						driver,
						endpoint,
						kind,
						i,
						slotId,
					)

				if (!mode || mode === ZUIScheduleEntryLockMode.WEEKLY) {
					const enabled =
						enabledType === ScheduleEntryLockScheduleKind.WeekDay

					for (let s = 1; s <= numSlots.numWeekDaySlots; s++) {
						if (this._cancelGetSchedule) return undefined

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}

						const schedule = fromCache
							? (getCached(
									ScheduleEntryLockScheduleKind.WeekDay,
									s,
								) as ScheduleEntryLockWeekDaySchedule)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getWeekDaySchedule(slot)

						ScheduleService._pushSchedule(
							weeklySchedules as ZUISlot<AnySchedule>[],
							slot,
							schedule,
							enabled,
						)
					}
				}

				if (!mode || mode === ZUIScheduleEntryLockMode.YEARLY) {
					const enabled =
						enabledType === ScheduleEntryLockScheduleKind.YearDay

					for (let s = 1; s <= numSlots.numYearDaySlots; s++) {
						if (this._cancelGetSchedule) return undefined

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}
						const schedule = fromCache
							? (getCached(
									ScheduleEntryLockScheduleKind.YearDay,
									s,
								) as ScheduleEntryLockYearDaySchedule)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getYearDaySchedule(slot)

						ScheduleService._pushSchedule(
							yearlySchedules as ZUISlot<AnySchedule>[],
							slot,
							schedule,
							enabled,
						)
					}
				}

				if (!mode || mode === ZUIScheduleEntryLockMode.DAILY) {
					const enabled =
						enabledType ===
						ScheduleEntryLockScheduleKind.DailyRepeating

					for (let s = 1; s <= numSlots.numDailyRepeatingSlots; s++) {
						if (this._cancelGetSchedule) return undefined

						const slot: ScheduleEntryLockSlotId = {
							userId: i,
							slotId: s,
						}
						const schedule = fromCache
							? (getCached(
									ScheduleEntryLockScheduleKind.DailyRepeating,
									s,
								) as ScheduleEntryLockDailyRepeatingSchedule)
							: await zwaveNode.commandClasses[
									'Schedule Entry Lock'
								].getDailyRepeatingSchedule(slot)

						ScheduleService._pushSchedule(
							dailySchedules as ZUISlot<AnySchedule>[],
							slot,
							schedule,
							enabled,
						)
					}
				}
			}

			this._nodes.emitNodeUpdate(node, {
				schedule: node.schedule,
				userCodes: node.userCodes,
			})

			return node.schedule
		}

		return promise().finally(() => {
			this._lockGetSchedule = false
			this._cancelGetSchedule = false
		})
	}

	cancelGetSchedule(): void {
		this._cancelGetSchedule = true
	}

	async setSchedule(
		nodeId: number,
		type: 'daily' | 'weekly' | 'yearly',
		schedule: ScheduleEntryLockSlotId &
			(
				| ScheduleEntryLockDailyRepeatingSchedule
				| ScheduleEntryLockWeekDaySchedule
				| ScheduleEntryLockYearDaySchedule
			),
	): Promise<SupervisionResult | undefined> {
		const zwaveNode = this._requireScheduleCC(nodeId)

		const slot: ScheduleEntryLockSlotId = {
			userId: schedule.userId,
			slotId: schedule.slotId,
		}

		// Strip slot/enabled keys so an empty remainder signals a delete
		delete (
			schedule as Partial<ScheduleEntryLockSlotId & { enabled: unknown }>
		).userId
		delete (
			schedule as Partial<ScheduleEntryLockSlotId & { enabled: unknown }>
		).slotId
		delete (
			schedule as Partial<ScheduleEntryLockSlotId & { enabled: unknown }>
		)['enabled']

		const isDelete = Object.keys(schedule).length === 0

		let scheduleData: AnySchedule | undefined
		if (isDelete) {
			scheduleData = undefined
		} else {
			scheduleData = schedule as AnySchedule
		}

		let result: SupervisionResult | undefined

		if (type === 'daily') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setDailyRepeatingSchedule(
				slot,
				scheduleData as ScheduleEntryLockDailyRepeatingSchedule,
			)
		} else if (type === 'weekly') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setWeekDaySchedule(
				slot,
				scheduleData as ScheduleEntryLockWeekDaySchedule,
			)
		} else if (type === 'yearly') {
			result = await zwaveNode.commandClasses[
				'Schedule Entry Lock'
			].setYearDaySchedule(
				slot,
				scheduleData as ScheduleEntryLockYearDaySchedule,
			)
		} else {
			throw new Error('Invalid schedule type')
		}

		// Without supervision confirmation, verify the write via slot readback
		if (!result) {
			const methods = {
				daily: 'getDailyRepeatingSchedule',
				weekly: 'getWeekDaySchedule',
				yearly: 'getYearDaySchedule',
			} as const

			const res =
				await zwaveNode.commandClasses['Schedule Entry Lock'][
					methods[type]
				](slot)

			if (
				(isDelete && !res) ||
				(!isDelete && res && this._utils.deepEqual(res, scheduleData))
			) {
				result = {
					status: SupervisionStatus.Success,
				}
			} else {
				result = {
					status: SupervisionStatus.Fail,
				}
			}
		}

		if (result.status === SupervisionStatus.Success) {
			const node = this._nodes.getNode(nodeId)
			if (!node?.schedule) return result

			// Schedule Entry Lock CC allows only one active mode at a time
			for (const mode in node.schedule) {
				const scheduleMode = node.schedule[mode as keyof ZUISchedule]
				if (scheduleMode) {
					scheduleMode.slots = scheduleMode.slots.map((s) => ({
						...s,
						enabled: mode === type,
					})) as typeof scheduleMode.slots
				}
			}

			const slots = node.schedule[type]?.slots

			if (slots) {
				const slotIndex = slots.findIndex(
					(s) => s.userId === slot.userId && s.slotId === slot.slotId,
				)

				if (isDelete) {
					if (slotIndex !== -1) {
						slots.splice(slotIndex, 1)
					}
				} else if (slotIndex !== -1) {
					;(slots as ZUISlot<AnySchedule>[])[slotIndex] = {
						...slot,
						...scheduleData,
						enabled: true,
					} as ZUISlot<AnySchedule>
				} else {
					;(slots as ZUISlot<AnySchedule>[]).push({
						...slot,
						...scheduleData,
						enabled: true,
					} as ZUISlot<AnySchedule>)
				}

				const isEnabledUsercode = node.userCodes?.enabled?.includes(
					slot.userId,
				)

				if (!isDelete && !isEnabledUsercode && node.userCodes) {
					node.userCodes.enabled.push(slot.userId)
				} else if (isDelete && isEnabledUsercode && node.userCodes) {
					const index = node.userCodes.enabled.indexOf(slot.userId)
					if (index >= 0) {
						node.userCodes.enabled.splice(index, 1)
					}
				}

				this._nodes.emitNodeUpdate(node, {
					schedule: node.schedule,
					userCodes: node.userCodes,
				})
			}
		}

		return result
	}

	async setEnabledSchedule(
		nodeId: number,
		enabled: boolean,
		userId: number,
	): Promise<SupervisionResult | undefined> {
		const zwaveNode = this._getZwaveNode(nodeId)

		if (!zwaveNode) {
			throw new Error('Node not found')
		}

		const result = await zwaveNode.commandClasses[
			'Schedule Entry Lock'
		].setEnabled(enabled, userId)

		if (isUnsupervisedOrSucceeded(result)) {
			const node = this._nodes.getNode(nodeId)

			if (node) {
				if (userId) {
					if (enabled) {
						node.userCodes?.enabled.push(userId)
					} else {
						const index = node.userCodes?.enabled.indexOf(userId)
						if (index !== undefined && index >= 0) {
							node.userCodes?.enabled.splice(index, 1)
						}
					}
				} else {
					if (node.userCodes) {
						node.userCodes.enabled = enabled
							? node.userCodes.available.slice()
							: []
					}
				}

				this._nodes.emitNodeUpdate(node, {
					userCodes: node.userCodes,
				})
			}
		}

		return result
	}
}
