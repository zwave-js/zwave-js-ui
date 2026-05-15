import { isPositiveIntegerString, isRecord } from './utils.ts'
type ImportedNodeConfig = Record<string, unknown>

function isHomeIdWrappedConfig(config: ImportedNodeConfig): boolean {
	const entries = Object.entries(config)
	if (entries.length === 0) return false

	// Numeric-looking top-level keys indicate a direct node-id map, not a wrapped map.
	if (entries.some(([key]) => isPositiveIntegerString(key))) {
		return false
	}

	return entries.some(([, value]) => {
		if (!isRecord(value)) return false
		return Object.keys(value).some(isPositiveIntegerString)
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

export function normalizeImportedNodesConfig(
	config: unknown,
): Record<string, ImportedNodeConfig> {
	if (Array.isArray(config)) {
		const parsed: Record<string, ImportedNodeConfig> = {}
		const isLegacyArrayFormat = config[0] == null && isRecord(config[1])

		for (const [index, node] of config.entries()) {
			if (!isRecord(node)) continue

			const nodeId = resolveArrayNodeId(index, node, isLegacyArrayFormat)
			parsed[nodeId] = node
		}

		return parsed
	}

	if (!isRecord(config)) {
		return {}
	}

	if (isHomeIdWrappedConfig(config)) {
		const parsed: Record<string, ImportedNodeConfig> = {}

		for (const value of Object.values(config)) {
			if (!isRecord(value)) continue

			for (const [nodeId, node] of Object.entries(value)) {
				if (!isRecord(node)) continue
				parsed[nodeId] = node
			}
		}

		return parsed
	}

	return config
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
