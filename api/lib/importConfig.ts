import { isRecord, isValidNodeIdString } from '#api/lib/utils'
type ImportedNodeConfig = Record<string, unknown>

export interface NormalizedImportConfig {
	/** Flat node-id → node config map to apply to the current controller */
	nodes: Record<string, ImportedNodeConfig>
	/**
	 * When the payload was home-id wrapped, the home id whose nodes were
	 * selected for import. Undefined for flat/array payloads, or when a wrapped
	 * payload contained multiple home ids and none matched the controller.
	 */
	selectedHomeId?: string
	/** Home ids present in a wrapped payload that were not imported */
	skippedHomeIds: string[]
}

export interface ImportSelection {
	/** Explicit user-chosen home id to import from a home-id wrapped backup */
	homeId?: string
	/** Merge nodes across all home ids in a wrapped backup (explicit opt-in) */
	mergeAll?: boolean
}

function isHomeIdWrappedConfig(config: ImportedNodeConfig): boolean {
	const entries = Object.entries(config)
	if (entries.length === 0) return false

	// Node-id-looking top-level keys indicate a direct node-id map, not a wrapped map.
	if (entries.some(([key]) => isValidNodeIdString(key))) {
		return false
	}

	return entries.some(([, value]) => {
		if (!isRecord(value)) return false
		return Object.keys(value).some(isValidNodeIdString)
	})
}

function resolveArrayNodeId(
	index: number,
	node: ImportedNodeConfig,
	isLegacyArrayFormat: boolean,
): number {
	const nodeId = node.id
	if (typeof nodeId === 'number' && Number.isInteger(nodeId) && nodeId > 0) {
		return nodeId
	}

	if (isLegacyArrayFormat && index > 0) {
		return index
	}

	return index + 1
}

/** Copy the node entries of a single home-id map into the target map */
function collectNodes(
	source: ImportedNodeConfig,
	into: Record<string, ImportedNodeConfig>,
): void {
	for (const [nodeId, node] of Object.entries(source)) {
		if (!isRecord(node)) continue
		into[nodeId] = node
	}
}

/**
 * Pick which network's nodes to import from a home-id wrapped payload.
 *
 * Node `name`/`loc` are scoped to a single home id, so merging entries across
 * networks would corrupt data (node 3 of network A is unrelated to node 3 of
 * network B). We therefore select a single entry by default:
 *  - the home id the user explicitly chose (`selection.homeId`), when present;
 *  - otherwise the entry matching the current controller's home id;
 *  - otherwise the sole entry, when the backup contains exactly one network;
 *  - otherwise nothing — multiple networks with no match is ambiguous, so the
 *    caller is told which home ids were skipped rather than guessing.
 *
 * Flattening every network into one map is only done when the user explicitly
 * opts in via `selection.mergeAll` (last-write-wins on node-id collisions).
 */
function selectWrappedHomeId(
	config: ImportedNodeConfig,
	homeHex?: string,
	selection?: ImportSelection,
): NormalizedImportConfig {
	const homeIds = Object.keys(config).filter((key) => isRecord(config[key]))

	if (selection?.mergeAll) {
		const nodes: Record<string, ImportedNodeConfig> = {}
		for (const homeId of homeIds) {
			collectNodes(config[homeId] as ImportedNodeConfig, nodes)
		}
		return { nodes, skippedHomeIds: [] }
	}

	let selectedHomeId: string | undefined
	if (selection?.homeId && isRecord(config[selection.homeId])) {
		selectedHomeId = selection.homeId
	} else if (homeHex && isRecord(config[homeHex])) {
		selectedHomeId = homeHex
	} else if (homeIds.length === 1) {
		selectedHomeId = homeIds[0]
	}

	if (!selectedHomeId) {
		return { nodes: {}, skippedHomeIds: homeIds }
	}

	const nodes: Record<string, ImportedNodeConfig> = {}
	collectNodes(config[selectedHomeId] as ImportedNodeConfig, nodes)

	return {
		nodes,
		selectedHomeId,
		skippedHomeIds: homeIds.filter((id) => id !== selectedHomeId),
	}
}

export function normalizeImportedNodesConfig(
	config: unknown,
	homeHex?: string,
	selection?: ImportSelection,
): NormalizedImportConfig {
	if (Array.isArray(config)) {
		const nodes: Record<string, ImportedNodeConfig> = {}
		const isLegacyArrayFormat = config[0] == null && isRecord(config[1])

		for (const [index, node] of config.entries()) {
			if (!isRecord(node)) continue

			const nodeId = resolveArrayNodeId(index, node, isLegacyArrayFormat)
			nodes[nodeId] = node
		}

		return { nodes, skippedHomeIds: [] }
	}

	if (!isRecord(config)) {
		return { nodes: {}, skippedHomeIds: [] }
	}

	if (isHomeIdWrappedConfig(config)) {
		return selectWrappedHomeId(config, homeHex, selection)
	}

	return { nodes: config, skippedHomeIds: [] }
}

export function getImportedNodeLocation(node: ImportedNodeConfig): string {
	const loc = node.loc
	if (typeof loc === 'string') {
		return loc
	}

	const location = node.location
	if (typeof location === 'string') {
		return location
	}

	return ''
}
