// Projects a ZUINode into the Device shape the dashboard renders from.

import { CommandClasses, type ValueID } from '@zwave-js/core'
import { DoorLockMode } from '@zwave-js/cc'
import type { ZUINode, ZUIValueId } from '../../api/lib/ZwaveClient.ts'
import { inferArchetype } from './archetypes.ts'
import { relativeTime } from './time.ts'
import type {
	Activity,
	Device,
	DeviceStatus,
	FirmwareUpdateInfo,
	PowerInfo,
	PrimaryValue,
	SecurityKey,
} from './dashboard-types.ts'

export interface ProjectOptions {
	now?: number
	activitiesByNode?: Map<number, Activity[]>
}

// SecurityClass member names, low → high.
const SECURITY_KEYS: readonly SecurityKey[] = [
	'S0_Legacy',
	'S2_Unauthenticated',
	'S2_Authenticated',
	'S2_AccessControl',
]

function findValue(
	node: ZUINode,
	cc: CommandClasses,
	predicate: (v: ZUIValueId) => boolean,
): ZUIValueId | undefined {
	if (!node.values) return undefined
	for (const v of Object.values(node.values)) {
		if (v?.commandClass !== (cc as number)) continue
		if (predicate(v)) return v
	}
	return undefined
}

function valueId(v: ZUIValueId, overrideProperty?: string): ValueID {
	const id: ValueID = {
		commandClass: v.commandClass,
		endpoint: v.endpoint ?? 0,
		property: overrideProperty ?? v.property,
	}
	if (overrideProperty === undefined && v.propertyKey !== undefined) {
		id.propertyKey = v.propertyKey
	}
	return id
}

function batteryLevel(node: ZUINode): number | null {
	const v = findValue(
		node,
		CommandClasses.Battery,
		(x) => x.property === 'level',
	)
	if (typeof v?.value === 'number') return v.value
	if (typeof node.minBatteryLevel === 'number') return node.minBatteryLevel
	return null
}

function projectPower(node: ZUINode): PowerInfo {
	const battery = batteryLevel(node)
	if (battery !== null) return { type: 'battery', battery }
	return { type: 'mains' }
}

function projectStatus(node: ZUINode): DeviceStatus {
	const s = (node.status ?? 'Alive').toString().toLowerCase()
	if (s === 'dead' || s === 'asleep' || s === 'awake') return s
	return 'alive'
}

function projectSecurityKeys(node: ZUINode): SecurityKey[] {
	const sc = (
		node as unknown as { securityClasses?: Record<string, boolean> }
	).securityClasses
	if (sc) return SECURITY_KEYS.filter((k) => sc[k])
	// Fall back to the highest-class `security` member-name string.
	const highest = SECURITY_KEYS.find((k) => k === node.security)
	return highest ? [highest] : []
}

function projectInterview(node: ZUINode): 'complete' | 'interview' {
	const stage = node.interviewStage
	if (!stage || stage === 'Complete') return 'complete'
	return 'interview'
}

function projectProtocol(node: ZUINode): string {
	if ((node as unknown as { isLongRange?: boolean }).isLongRange)
		return 'Z-Wave Long Range'
	if (node.protocol === 1) return 'Z-Wave Long Range'
	if (node.zwavePlusVersion) return 'Z-Wave Plus v2'
	return 'Z-Wave'
}

function projectPrimaryValue(
	node: ZUINode,
	archetypeKind: string,
): PrimaryValue | null {
	if (node.isControllerNode) return null

	if (archetypeKind === 'light' || archetypeKind === 'shade') {
		const lvl = findValue(
			node,
			CommandClasses['Multilevel Switch'],
			(v) =>
				v.property === 'currentValue' || v.property === 'targetValue',
		)
		if (typeof lvl?.value === 'number')
			return {
				type: 'dim',
				level: clampLevel(lvl.value),
				target: valueId(lvl, 'targetValue'),
			}
		// Light may instead be binary.
		const on = findValue(
			node,
			CommandClasses['Binary Switch'],
			(v) => v.property === 'currentValue',
		)
		if (typeof on?.value === 'boolean')
			return {
				type: 'toggle',
				on: on.value,
				watts: meterWatts(node),
				target: valueId(on, 'targetValue'),
			}
		return null
	}

	if (archetypeKind === 'outlet' || archetypeKind === 'switch') {
		// Prefer currentValue, fall back to targetValue.
		const on =
			findValue(
				node,
				CommandClasses['Binary Switch'],
				(v) => v.property === 'currentValue',
			) ??
			findValue(
				node,
				CommandClasses['Binary Switch'],
				(v) => v.property === 'targetValue',
			)
		return {
			type: 'toggle',
			on: typeof on?.value === 'boolean' ? on.value : false,
			watts: meterWatts(node),
			// Root-endpoint fallback until a Binary Switch value surfaces.
			target: on
				? valueId(on, 'targetValue')
				: {
						commandClass: CommandClasses['Binary Switch'],
						endpoint: 0,
						property: 'targetValue',
					},
		}
	}

	if (archetypeKind === 'lock') {
		const locked = findValue(
			node,
			CommandClasses['Door Lock'],
			(v) => v.property === 'currentMode' || v.property === 'targetMode',
		)
		if (locked?.value !== undefined) {
			const isLocked =
				locked.value === DoorLockMode.Secured ||
				locked.value === 'Secured' ||
				locked.value === true
			return {
				type: 'lock',
				locked: isLocked,
				target: valueId(locked, 'targetMode'),
			}
		}
		return null
	}

	if (archetypeKind === 'climate') {
		const setpointVal = findValue(
			node,
			CommandClasses['Thermostat Setpoint'],
			(v) => typeof v.value === 'number',
		)
		const modeVal = findValue(
			node,
			CommandClasses['Thermostat Mode'],
			(v) => v.property === 'mode',
		)
		const tempVal = findValue(
			node,
			CommandClasses['Multilevel Sensor'],
			(v) =>
				typeof v.propertyName === 'string' &&
				/air\s*temperature/i.test(v.propertyName),
		)
		return {
			type: 'thermostat',
			value:
				typeof tempVal?.value === 'number'
					? tempVal.value
					: typeof setpointVal?.value === 'number'
						? setpointVal.value
						: 0,
			unit: tempVal?.unit ?? setpointVal?.unit ?? '°C',
			setpoint:
				typeof setpointVal?.value === 'number' ? setpointVal.value : 0,
			mode: stateLabel(modeVal) ?? 'Off',
			setpointTarget: setpointVal ? valueId(setpointVal) : undefined,
			modeTarget: modeVal ? valueId(modeVal) : undefined,
		}
	}

	if (archetypeKind === 'sensor') {
		const reading = findValue(
			node,
			CommandClasses['Multilevel Sensor'],
			() => true,
		)
		if (reading && reading.value !== undefined) {
			return {
				type: 'reading',
				value: reading.value as number | string,
				unit: reading.unit ?? '',
			}
		}
		return null
	}

	if (
		archetypeKind === 'motion' ||
		archetypeKind === 'contact' ||
		archetypeKind === 'water' ||
		archetypeKind === 'smoke'
	) {
		// Try Notification first, then Binary Sensor.
		const notif = findValue(
			node,
			CommandClasses.Notification,
			(v) => typeof v.value === 'number' || typeof v.value === 'boolean',
		)
		const bin = findValue(
			node,
			CommandClasses['Binary Sensor'],
			(v) => typeof v.value === 'boolean',
		)
		const labels = labelsFor(archetypeKind)
		const idx = (() => {
			if (notif && typeof notif.value === 'number')
				return notif.value > 0 ? 1 : 0
			if (notif && typeof notif.value === 'boolean')
				return notif.value ? 1 : 0
			if (bin && typeof bin.value === 'boolean') return bin.value ? 1 : 0
			return 0
		})()
		return {
			type: 'state',
			value: labels.states[idx],
			stateIdx: idx,
			states: labels.states,
			colors: labels.colors,
		}
	}

	return null
}

function clampLevel(n: number): number {
	if (n <= 0) return 0
	if (n >= 99) return 100
	return Math.round(n)
}

function meterWatts(node: ZUINode): number | null {
	// Match on unit (propertyName is localized and unreliable).
	const v = findValue(
		node,
		CommandClasses.Meter,
		(x) =>
			typeof x.value === 'number' && (x.unit === 'W' || x.unit === 'kW'),
	)
	if (typeof v?.value !== 'number') return null
	return v.unit === 'kW' ? Math.round(v.value * 1000) : v.value
}

function stateLabel(v?: ZUIValueId): string | null {
	if (!v) return null
	if (typeof v.value !== 'number') return null
	const opt = v.states?.find((s) => s.value === v.value)
	return opt?.text ?? null
}

interface StateLabels {
	states: string[]
	colors: string[]
}

function labelsFor(kind: string): StateLabels {
	switch (kind) {
		case 'motion':
			return { states: ['Clear', 'Motion'], colors: ['neutral', 'amber'] }
		case 'contact':
			return { states: ['Closed', 'Open'], colors: ['neutral', 'amber'] }
		case 'water':
			return { states: ['Dry', 'Wet'], colors: ['neutral', 'red'] }
		case 'smoke':
			return { states: ['Clear', 'Smoke'], colors: ['neutral', 'red'] }
		default:
			return { states: ['Off', 'On'], colors: ['neutral', 'green'] }
	}
}

function projectActivities(
	node: ZUINode,
	override?: Map<number, Activity[]>,
): Activity[] {
	const out: Activity[] = []

	const fw = (node as unknown as { firmwareUpdate?: unknown }).firmwareUpdate
	if (fw && typeof fw === 'object') {
		const f = fw as {
			currentFile?: number
			totalFiles?: number
			sentFragments?: number
			totalFragments?: number
		}
		const cur = f.currentFile ?? 1
		const total = f.totalFiles ?? 1
		const frag = f.sentFragments ?? 0
		const tFrag = f.totalFragments ?? 1
		const sent = (cur - 1) * tFrag + frag
		const totalFrag = total * tFrag
		const progress =
			totalFrag > 0 ? Math.round((sent / totalFrag) * 100) : undefined
		out.push({ type: 'ota', label: 'Updating firmware', progress })
	}

	const rebuild = node.rebuildRoutesProgress
	if (rebuild) {
		// Status enum, not a percentage — treat any non-terminal state as in-flight.
		const done =
			(typeof rebuild === 'string' &&
				(rebuild === 'done' || rebuild === 'failed')) ||
			false
		if (!done) {
			out.push({
				type: 'rebuild',
				label: 'Rebuilding routes',
				progress: typeof rebuild === 'number' ? rebuild : undefined,
			})
		}
	}

	// Dead/Asleep nodes can't progress — skip to avoid stale indicators.
	if (
		node.interviewStage &&
		node.interviewStage !== 'Complete' &&
		node.status !== 'Dead' &&
		node.status !== 'Asleep'
	) {
		out.push({
			type: 'interview',
			label: 'Interviewing',
			progress: node.interviewProgress ?? 0,
		})
	}

	const extra = override?.get(node.id)
	if (extra && extra.length) out.push(...extra)

	return out
}

export function projectDevice(
	node: ZUINode,
	opts: ProjectOptions = {},
): Device {
	const now = opts.now ?? Date.now()
	const archetype = inferArchetype(node)
	const power = projectPower(node)
	const securityKeys = projectSecurityKeys(node)
	const rawUpdates = Array.isArray(node.availableFirmwareUpdates)
		? node.availableFirmwareUpdates
		: []
	const hasUpdate = rawUpdates.length > 0
	const availableFirmwareUpdates: FirmwareUpdateInfo[] = rawUpdates.map(
		(u: Record<string, unknown>) => ({
			version: typeof u.version === 'string' ? u.version : '',
			channel:
				u.channel === 'beta'
					? ('prerelease' as const)
					: ('stable' as const),
			changelog: typeof u.changelog === 'string' ? u.changelog : '',
			date: typeof u.date === 'string' ? u.date : undefined,
			downgrade: !!u.downgrade,
			normalizedVersion:
				typeof u.normalizedVersion === 'string'
					? u.normalizedVersion
					: undefined,
			files: Array.isArray(u.files) ? u.files : undefined,
			device:
				u.device && typeof u.device === 'object'
					? (u.device as Record<string, unknown>)
					: undefined,
		}),
	)

	const activity = projectActivities(node, opts.activitiesByNode)

	return {
		nodeId: node.id,
		isController: !!node.isControllerNode,
		name: node.name || node.productLabel || `Node ${node.id}`,
		location: node.loc ?? '',
		manufacturer: node.manufacturer,
		product: node.productLabel,
		productCode: node.productDescription,
		archetype,
		power,
		status: projectStatus(node),
		interviewState: projectInterview(node),
		// Highest granted class is last (keys are low → high).
		security: securityKeys.at(-1) ?? 'none',
		securityKeys,
		firmware: {
			node: node.firmwareVersion,
			sdk: node.sdkVersion,
		},
		protocol: projectProtocol(node),
		lastSeen: relativeTime(node.lastActive, now),
		lastSeenTs: node.lastActive,
		primaryValue: projectPrimaryValue(node, archetype.kind),
		activity,
		health: 'ok',
		hasUpdate,
		availableFirmwareUpdates: hasUpdate
			? availableFirmwareUpdates
			: undefined,
		txPower:
			typeof (node as unknown as { txPower?: number }).txPower ===
			'number'
				? (node as unknown as { txPower: number }).txPower
				: undefined,
	}
}

export function projectDevices(
	nodes: ZUINode[],
	opts: ProjectOptions = {},
): Device[] {
	const now = opts.now ?? Date.now()
	return nodes.map((n) => projectDevice(n, { ...opts, now }))
}
