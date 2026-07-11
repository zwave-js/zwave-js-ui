/**
 * Narrow access ports for extracted Z-Wave services.
 *
 * Each port interface defines the minimum surface a service needs to
 * interact with the driver, node store, or ZwaveClient – so the services
 * never import the monolithic ZwaveClient directly and stay independently
 * testable. Every accessor resolves the CURRENT value, so a driver swap
 * on restart is honoured without capturing state at construction time.
 */

import type {
	ScheduleEntryLockDailyRepeatingSchedule,
	ScheduleEntryLockSlotId,
	ScheduleEntryLockWeekDaySchedule,
	ScheduleEntryLockYearDaySchedule,
	SetValueResult,
	ZWaveNode,
	Driver,
} from 'zwave-js'
import type { SupervisionResult } from '@zwave-js/core'
import type { DeepPartial } from '../utils.ts'

// ---------------------------------------------------------------------------
// Schedule types re-exported so services don't import ZwaveClient
// ---------------------------------------------------------------------------

export const ZUIScheduleEntryLockMode = {
	DAILY: 'daily',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const

export type ZUIScheduleEntryLockMode =
	(typeof ZUIScheduleEntryLockMode)[keyof typeof ZUIScheduleEntryLockMode]

export type ZUISlot<T> = T & { enabled: boolean } & ScheduleEntryLockSlotId

export interface ZUIScheduleConfig<T> {
	numSlots: number
	slots: ZUISlot<T>[]
}

export interface ZUISchedule {
	[ZUIScheduleEntryLockMode.DAILY]: ZUIScheduleConfig<ScheduleEntryLockDailyRepeatingSchedule>
	[ZUIScheduleEntryLockMode.WEEKLY]: ZUIScheduleConfig<ScheduleEntryLockWeekDaySchedule>
	[ZUIScheduleEntryLockMode.YEARLY]: ZUIScheduleConfig<ScheduleEntryLockYearDaySchedule>
}

// ---------------------------------------------------------------------------
// Configuration template types
// ---------------------------------------------------------------------------

export interface ZUIConfigurationTemplateValue {
	property: number
	propertyKey?: number | null
	endpoint: number
	value: unknown
	label?: string
	description?: string
}

export interface ZUIConfigurationTemplate {
	id: string
	name: string
	deviceId: string
	manufacturerId?: number
	productId?: number
	productType?: number
	manufacturer?: string
	productLabel?: string
	firmwareRange?: { min?: string; max?: string }
	values: ZUIConfigurationTemplateValue[]
	autoApply: boolean
	contentHash: string
	createdAt: string
	updatedAt: string
}

// ---------------------------------------------------------------------------
// Minimal node shape the services need
// ---------------------------------------------------------------------------

export interface ScheduleNodeState {
	id: number
	schedule?: ZUISchedule
	userCodes?: {
		total: number
		available: number[]
		enabled: number[]
	}
}

export interface TemplateNodeState {
	id: number
	ready: boolean
	deviceId?: string
	manufacturerId?: number
	productId?: number
	productType?: number
	manufacturer?: string
	productLabel?: string
	firmwareVersion?: string
	values?: Record<
		string,
		{
			commandClass: number
			writeable: boolean
			property: string | number
			propertyKey?: string | number | null
			endpoint?: number
			value?: unknown
			label?: string
			description?: string
		}
	>
	appliedTemplateContentHashes?: string[]
	status?: string
}

// ---------------------------------------------------------------------------
// Port: driver + node access for ScheduleService
// ---------------------------------------------------------------------------

export interface ScheduleDriverPort {
	getDriver(): Driver | null
}

// ---------------------------------------------------------------------------
// Port: node store access for ScheduleService
// ---------------------------------------------------------------------------

export interface ScheduleNodeStorePort {
	getNode(nodeId: number): ScheduleNodeState | undefined
	emitNodeUpdate(
		node: ScheduleNodeState,
		changedProps: DeepPartial<ScheduleNodeState>,
	): void
}

// ---------------------------------------------------------------------------
// Port: deep-equal utility for ScheduleService
// ---------------------------------------------------------------------------

export interface ScheduleUtilsPort {
	deepEqual(a: unknown, b: unknown): boolean
}

// ---------------------------------------------------------------------------
// Port: driver + node access for ConfigurationTemplateService
// ---------------------------------------------------------------------------

export interface TemplateDriverPort {
	getDriver(): {
		controller: {
			nodes: { get(nodeId: number): ZWaveNode | undefined }
		}
	} | null
}

// ---------------------------------------------------------------------------
// Port: node store for templates
// ---------------------------------------------------------------------------

export interface TemplateNodeStorePort {
	getNode(nodeId: number): TemplateNodeState | undefined
	getNodes(): Iterable<readonly [number, TemplateNodeState]>
	getStoreNode(nodeId: number): Partial<TemplateNodeState> | undefined
	setStoreNode(nodeId: number, data: Partial<TemplateNodeState>): void
	updateStoreNodes(rebuildRoutes?: boolean): Promise<void>
	emitNodeUpdate(
		node: TemplateNodeState,
		changedProps: DeepPartial<TemplateNodeState>,
	): void
	writeValue(
		valueId: {
			nodeId: number
			commandClass: number
			endpoint: number
			property: number
			propertyKey?: number | null
		},
		value: unknown,
	): Promise<SetValueResult>
	logNode(zwaveNode: ZWaveNode, level: string, message: string): void
	throttle(key: string, fn: () => void, wait: number): void
}

// ---------------------------------------------------------------------------
// Port: persistence (jsonStore) for templates
// ---------------------------------------------------------------------------

export interface TemplatePersistencePort {
	get(): ZUIConfigurationTemplate[]
	put(data: ZUIConfigurationTemplate[]): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Port: logger
// ---------------------------------------------------------------------------

export interface ServiceLogger {
	info(message: string, ...meta: unknown[]): void
	warn(message: string, ...meta: unknown[]): void
	error(message: string, ...meta: unknown[]): void
}

// ---------------------------------------------------------------------------
// Port: ID generation + hashing
// ---------------------------------------------------------------------------

export interface TemplateUtilsPort {
	generateId(): string
}
