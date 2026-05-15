type ImportedNodeConfig = Record<string, any>

function isRecord(value: unknown): value is ImportedNodeConfig {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPositiveIntegerKey(value: string): boolean {
	if (!/^\d+$/.test(value)) {
		return false
	}

	const number = Number(value)
	return Number.isInteger(number) && number > 0
}

function isHomeIdWrappedConfig(config: ImportedNodeConfig): boolean {
	const entries = Object.entries(config)
	if (entries.length === 0) return false

	if (entries.some(([key]) => isPositiveIntegerKey(key))) {
		return false
	}

	return entries.some(([, value]) => {
		if (!isRecord(value)) return false
		return Object.keys(value).some(isPositiveIntegerKey)
	})
}

export function normalizeImportedNodesConfig(
	config: unknown,
): Record<string, ImportedNodeConfig> {
	if (Array.isArray(config)) {
		const parsed: Record<string, ImportedNodeConfig> = {}
		const useLegacyIndex = config[0] == null && isRecord(config[1])

		for (const [index, node] of config.entries()) {
			if (!isRecord(node)) continue

			let nodeId = index + 1
			if (useLegacyIndex && index > 0) {
				nodeId = index
			}
			if (Number.isInteger(node.id) && node.id > 0) {
				nodeId = node.id
			}
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
	if (typeof node.loc === 'string') {
		return node.loc
	}

	if (typeof node.location === 'string') {
		return node.location
	}

	return ''
}
