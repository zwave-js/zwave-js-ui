function isRecord(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object'
}

function isPositiveIntegerKey(value: string): boolean {
	if (!/^\d+$/.test(value)) {
		return false
	}

	const number = Number(value)
	return Number.isInteger(number) && number > 0
}

function isHomeIdWrappedConfig(config: Record<string, any>): boolean {
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
): Record<string, any> {
	if (Array.isArray(config)) {
		const parsed: Record<string, any> = {}

		for (const [index, node] of config.entries()) {
			if (!isRecord(node)) continue

			const nodeId =
				Number.isInteger(node.id) && node.id > 0 ? node.id : index
			if (nodeId > 0) {
				parsed[nodeId] = node
			}
		}

		return parsed
	}

	if (!isRecord(config)) {
		return {}
	}

	if (isHomeIdWrappedConfig(config)) {
		const parsed: Record<string, any> = {}

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

export function getImportedNodeLocation(node: Record<string, any>): string {
	if (typeof node.loc === 'string') {
		return node.loc
	}

	if (typeof node.location === 'string') {
		return node.location
	}

	return ''
}
