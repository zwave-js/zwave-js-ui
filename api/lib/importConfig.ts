import * as utils from './utils.ts'
type ImportedNodeConfig = Record<string, any>

function isHomeIdWrappedConfig(config: ImportedNodeConfig): boolean {
	const entries = Object.entries(config)
	if (entries.length === 0) return false

	if (entries.some(([key]) => utils.isPositiveIntegerString(key))) {
		return false
	}

	return entries.some(([, value]) => {
		if (!utils.isRecord(value)) return false
		return Object.keys(value).some(utils.isPositiveIntegerString)
	})
}

function resolveArrayNodeId(
	index: number,
	node: ImportedNodeConfig,
	isLegacyArrayFormat: boolean,
): number {
	if (Number.isInteger(node.id) && node.id > 0) {
		return node.id
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
		const isLegacyArrayFormat =
			config[0] == null && utils.isRecord(config[1])

		for (const [index, node] of config.entries()) {
			if (!utils.isRecord(node)) continue

			const nodeId = resolveArrayNodeId(index, node, isLegacyArrayFormat)
			parsed[nodeId] = node
		}

		return parsed
	}

	if (!utils.isRecord(config)) {
		return {}
	}

	if (isHomeIdWrappedConfig(config)) {
		const parsed: Record<string, ImportedNodeConfig> = {}

		for (const value of Object.values(config)) {
			if (!utils.isRecord(value)) continue

			for (const [nodeId, node] of Object.entries(value)) {
				if (!utils.isRecord(node)) continue
				parsed[nodeId] = node
			}
		}

		return parsed
	}

	return config
}

export function getImportedNodeLocation(node: ImportedNodeConfig): string {
	if (typeof node.loc === 'string') {
		return node.loc
	}

	if (typeof node.location === 'string') {
		return node.location
	}

	return ''
}
