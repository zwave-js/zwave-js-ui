// Projects a raw Z-Wave node (`ZUINode`) into the `Device` shape the
// dashboard renders from. Pure and side-effect-free so callers can
// memoize per node.

import { CommandClasses } from '@zwave-js/core'
import type { ZUINode, ZUIValueId } from '../../api/lib/ZwaveClient.ts'
import { inferArchetype } from './archetypes.ts'
import type {
	Activity,
	Device,
	DeviceStatus,
	PowerInfo,
	PrimaryValue,
	SecurityKey,
} from './dashboard-types.ts'

export interface ProjectOptions {
	now?: number
	activitiesByNode?: Map<number, Activity[]>
}

const SECURITY_CLASS_TO_KEY: Record<string, SecurityKey> = {
	S0_Legacy: 'S0',
	S2_Unauthenticated: 'S2_UA',
	S2_Authenticated: 'S2_A',
	S2_AccessControl: 'S2_AC',
}

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
	const out: SecurityKey[] = []
	const sc =
		(node as unknown as { securityClasses?: Record<string, boolean> })
			.securityClasses ?? null
	if (sc) {
		for (const [k, v] of Object.entries(sc)) {
			const mapped = SECURITY_CLASS_TO_KEY[k]
			if (mapped && v) out.push(mapped)
		}
	}
	// Fall back to legacy `security` string if no `securityClasses` block.
	if (out.length === 0 && typeof node.security === 'string') {
		const sec = node.security
		if (sec.includes('S2_Access')) out.push('S2_AC')
		else if (sec.includes('S2_Authenticated')) out.push('S2_A')
		else if (sec.includes('S2_Unauthenticated')) out.push('S2_UA')
		else if (sec.includes('S0')) out.push('S0')
	}
	return out
}

function projectInterview(node: ZUINode): {
	state: 'complete' | 'interview' | 'failed'
	progress?: number
} {
	const stage = node.interviewStage
	if (!stage || stage === 'Complete') return { state: 'complete' }
	if (node.failed) return { state: 'failed' }
	const progress =
		typeof (node as unknown as { interviewProgress?: number })
			.interviewProgress === 'number'
			? (node as unknown as { interviewProgress: number })
					.interviewProgress
			: undefined
	return { state: 'interview', progress }
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
			return { type: 'dim', level: clampLevel(lvl.value) }
		// Light may instead be binary.
		const on = findValue(
			node,
			CommandClasses['Binary Switch'],
			(v) => v.property === 'currentValue',
		)
		if (typeof on?.value === 'boolean')
			return { type: 'toggle', on: on.value, watts: meterWatts(node) }
		return null
	}

	if (archetypeKind === 'outlet' || archetypeKind === 'switch') {
		const on = findValue(
			node,
			CommandClasses['Binary Switch'],
			(v) => v.property === 'currentValue',
		)
		const onValue = typeof on?.value === 'boolean' ? on.value : false
		return {
			type: 'toggle',
			on: onValue,
			watts: meterWatts(node),
		}
	}

	if (archetypeKind === 'lock') {
		const locked = findValue(
			node,
			CommandClasses['Door Lock'],
			(v) => v.property === 'currentMode' || v.property === 'targetMode',
		)
		if (locked?.value !== undefined) {
			// Door Lock CC: 0 = Unsecured, 255 = Secured.
			const isLocked =
				locked.value === 255 ||
				locked.value === 'Secured' ||
				locked.value === true
			return { type: 'lock', locked: isLocked }
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
	// Match electric-power readings on `unit` (`W`/`kW`); propertyName is
	// localized and unreliable.
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

/**
 * Derive `device.activity[]` from node fields: `firmwareUpdate` → OTA,
 * `rebuildRoutesProgress` → rebuild, incomplete `interviewStage` →
 * interview. Entries from `override`, when given, are appended.
 */
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
		// rebuildRoutesProgress is a status enum, not a percentage; treat
		// any non-terminal state as in-flight.
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

	if (node.interviewStage && node.interviewStage !== 'Complete') {
		out.push({
			type: 'interview',
			label: 'Interviewing',
			progress:
				typeof (node as unknown as { interviewProgress?: number })
					.interviewProgress === 'number'
					? (node as unknown as { interviewProgress: number })
							.interviewProgress
					: 0,
		})
	}

	const extra = override?.get(node.id)
	if (extra && extra.length) out.push(...extra)

	return out
}

function lastSeenLabel(now: number, lastActive?: number): string {
	if (!lastActive) return 'never'
	const secs = Math.max(0, Math.floor((now - lastActive) / 1000))
	if (secs < 60) return `${secs}s ago`
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
	if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
	return `${Math.floor(secs / 86400)}d ago`
}

/**
 * Project one ZUINode → UI Device. Pure; safe to memoize.
 */
export function projectDevice(
	node: ZUINode,
	opts: ProjectOptions = {},
): Device {
	const now = opts.now ?? Date.now()
	const archetype = inferArchetype(node)
	const interview = projectInterview(node)
	const power = projectPower(node)
	const hasUpdate =
		Array.isArray(node.availableFirmwareUpdates) &&
		node.availableFirmwareUpdates.length > 0

	const activity = projectActivities(node, opts.activitiesByNode)

	return {
		id: node.id,
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
		interviewState: interview.state,
		security:
			projectSecurityKeys(node).slice(-1)[0] ??
			(node.security ? 'none' : 'none'),
		securityKeys: projectSecurityKeys(node),
		firmware: {
			node: node.firmwareVersion,
			sdk: node.sdkVersion,
		},
		protocol: projectProtocol(node),
		lastSeen: lastSeenLabel(now, node.lastActive),
		primaryValue: projectPrimaryValue(node, archetype.kind),
		activity,
		health: 'ok',
		hasUpdate,
		txPower:
			typeof (node as unknown as { txPower?: number }).txPower ===
			'number'
				? (node as unknown as { txPower: number }).txPower
				: undefined,
	}
}

/** Project an array of nodes; per-node projection is memoizable upstream. */
export function projectDevices(
	nodes: ZUINode[],
	opts: ProjectOptions = {},
): Device[] {
	const now = opts.now ?? Date.now()
	return nodes.map((n) => projectDevice(n, { ...opts, now }))
}
