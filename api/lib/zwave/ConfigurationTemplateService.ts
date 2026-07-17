import { createHash } from 'node:crypto'
import { CommandClasses } from '@zwave-js/core'
import {
	setValueFailed,
	SetValueStatus,
	type ZWaveNode,
	type SetValueResult,
} from 'zwave-js'
import { getEnumMemberName } from '@zwave-js/shared'
import {
	coerce as semverCoerce,
	gte as semverGte,
	lte as semverLte,
} from 'semver'
import { getErrorMessage } from '#api/lib/errors'

import type {
	ZUIConfigurationTemplate,
	ZUIConfigurationTemplateValue,
	TemplateDriverPort,
	TemplateNodeStorePort,
	TemplatePersistencePort,
	TemplateUtilsPort,
	TemplateNodeState,
	TemplateConfigManagerPort,
	ServiceLogger,
} from '#api/lib/zwave/ports'

export class ConfigurationTemplateService {
	private _templates: ZUIConfigurationTemplate[]

	private readonly _driver: TemplateDriverPort
	private readonly _nodes: TemplateNodeStorePort
	private readonly _persistence: TemplatePersistencePort
	private readonly _utils: TemplateUtilsPort
	private readonly _configManager: TemplateConfigManagerPort
	private readonly _logger: ServiceLogger

	constructor(
		driver: TemplateDriverPort,
		nodes: TemplateNodeStorePort,
		persistence: TemplatePersistencePort,
		utils: TemplateUtilsPort,
		logger: ServiceLogger,
		initialTemplates: ZUIConfigurationTemplate[],
		configManager: TemplateConfigManagerPort,
	) {
		this._driver = driver
		this._nodes = nodes
		this._persistence = persistence
		this._utils = utils
		this._logger = logger
		this._templates = initialTemplates
		this._configManager = configManager
	}

	getConfigurationTemplates(): ZUIConfigurationTemplate[] {
		return this._templates
	}

	async getDeviceConfigurationParams(
		deviceId: string,
	): Promise<Partial<Record<string, unknown>>[]> {
		const parts = deviceId.split('-')
		if (parts.length !== 3) {
			throw new Error(
				'Invalid deviceId format, expected manufacturerId-productId-productType',
			)
		}

		const manufacturerId = parseInt(parts[0], 10)
		const productId = parseInt(parts[1], 10)
		const productType = parseInt(parts[2], 10)

		if (isNaN(manufacturerId) || isNaN(productId) || isNaN(productType)) {
			throw new Error('Invalid deviceId: non-numeric components')
		}

		await this._configManager.loadDeviceIndex()

		const device = await this._configManager.lookupDevice(
			manufacturerId,
			productType,
			productId,
		)

		if (!device?.paramInformation) {
			return []
		}

		const result: Partial<Record<string, unknown>>[] = []

		for (const [key, param] of device.paramInformation.entries()) {
			const propertyKey = key.valueBitMask
			const id = `0-${CommandClasses.Configuration}-0-${key.parameter}${propertyKey != null ? '-' + String(propertyKey) : ''}`

			result.push({
				id,
				commandClass: CommandClasses.Configuration,
				property: key.parameter,
				propertyKey: propertyKey,
				endpoint: 0,
				type: 'number',
				readable: true,
				writeable: !param.readOnly,
				label: param.label,
				description: param.description,
				min: param.minValue,
				max: param.maxValue,
				default: param.defaultValue,
				unit: param.unit,
				list: param.options?.length > 0,
				allowManualEntry: param.allowManualEntry,
				states: param.options?.map((o) => ({
					text: o.label,
					value: o.value,
				})),
				newValue: param.defaultValue,
			})
		}

		return result
	}

	async createConfigurationTemplate(
		nodeId: number,
		name: string,
		autoApply = false,
		values?: ZUIConfigurationTemplateValue[],
		firmwareRange?: { min?: string; max?: string },
	): Promise<ZUIConfigurationTemplate> {
		const node = this._nodes.getNode(nodeId)

		if (!node) {
			throw Error(`Node ${nodeId} not found`)
		}

		if (!node.ready) {
			throw Error(`Node ${nodeId} is not ready`)
		}

		let configValues: ZUIConfigurationTemplateValue[]

		if (values && values.length > 0) {
			configValues = values
		} else {
			configValues = []

			if (node.values) {
				for (const id in node.values) {
					const v = node.values[id]
					if (
						v.commandClass === CommandClasses.Configuration &&
						v.writeable
					) {
						configValues.push({
							property: v.property as number,
							propertyKey:
								v.propertyKey != null
									? (v.propertyKey as number)
									: null,
							endpoint: v.endpoint ?? 0,
							value: v.value,
							label: v.label,
							description: v.description,
						})
					}
				}
			}
		}

		if (configValues.length === 0) {
			throw Error(
				`Node ${nodeId} has no writeable Configuration CC values`,
			)
		}

		const id = this._utils.generateId()
		const now = new Date().toISOString()

		const template: ZUIConfigurationTemplate = {
			id,
			name,
			deviceId: node.deviceId ?? '',
			manufacturerId: node.manufacturerId,
			productId: node.productId,
			productType: node.productType,
			manufacturer: node.manufacturer,
			productLabel: node.productLabel,
			firmwareRange:
				firmwareRange?.min || firmwareRange?.max
					? firmwareRange
					: undefined,
			values: configValues,
			autoApply,
			contentHash: ConfigurationTemplateService._generateContentHash(
				configValues,
				firmwareRange,
			),
			createdAt: now,
			updatedAt: now,
		}

		this._templates.push(template)
		await this._persistence.put(this._templates)

		if (autoApply) {
			this._autoApplyToNodes(template)
		}

		return template
	}

	async updateConfigurationTemplate(
		id: string,
		updates: {
			name?: string
			autoApply?: boolean
			firmwareRange?: { min?: string; max?: string }
			values?: ZUIConfigurationTemplateValue[]
		},
	): Promise<ZUIConfigurationTemplate> {
		const template = this._templates.find((t) => t.id === id)

		if (!template) {
			throw Error(`Template ${id} not found`)
		}

		if (updates.name !== undefined) template.name = updates.name
		if (updates.autoApply !== undefined)
			template.autoApply = updates.autoApply

		const contentChanged =
			updates.firmwareRange !== undefined || updates.values !== undefined

		if (updates.firmwareRange !== undefined)
			template.firmwareRange = updates.firmwareRange
		if (updates.values !== undefined) template.values = updates.values

		if (contentChanged) {
			template.contentHash =
				ConfigurationTemplateService._generateContentHash(
					template.values,
					template.firmwareRange,
				)
		}

		template.updatedAt = new Date().toISOString()

		await this._persistence.put(this._templates)

		if (template.autoApply && contentChanged) {
			this._autoApplyToNodes(template)
		}

		return template
	}

	async deleteConfigurationTemplate(id: string): Promise<boolean> {
		const index = this._templates.findIndex((t) => t.id === id)

		if (index < 0) {
			throw Error(`Template ${id} not found`)
		}

		const deletedHash = this._templates[index].contentHash

		this._templates.splice(index, 1)
		await this._persistence.put(this._templates)

		if (deletedHash) {
			for (const [, node] of this._nodes.getNodes()) {
				const hashes = node.appliedTemplateContentHashes
				if (hashes && hashes.includes(deletedHash)) {
					await this._cleanupAppliedHashes(node)
				}
			}
		}

		return true
	}

	async applyConfigurationTemplate(
		templateId: string,
		nodeId: number,
		force = false,
	): Promise<{
		success: number
		failed: number
		errors: string[]
		reason?: string
	}> {
		const template = this._templates.find((t) => t.id === templateId)

		if (!template) {
			throw Error(`Template ${templateId} not found`)
		}

		const node = this._nodes.getNode(nodeId)

		if (!node) {
			throw Error(`Node ${nodeId} not found`)
		}

		if (!node.ready) {
			throw Error(`Node ${nodeId} is not ready`)
		}

		if (
			!force &&
			template.deviceId &&
			node.deviceId &&
			template.deviceId !== node.deviceId
		) {
			throw Error(
				`Template device type "${template.deviceId}" does not match node device type "${node.deviceId}". Use force to override.`,
			)
		}

		const results: {
			success: number
			failed: number
			errors: string[]
			reason?: string
		} = { success: 0, failed: 0, errors: [] }

		for (const tv of template.values) {
			try {
				if (tv.value === undefined) {
					results.success++
					continue
				}

				const result: SetValueResult = await this._nodes.writeValue(
					{
						nodeId,
						commandClass: CommandClasses.Configuration,
						endpoint: tv.endpoint,
						property: tv.property,
						propertyKey: tv.propertyKey,
					},
					tv.value,
				)

				if (setValueFailed(result)) {
					results.failed++
					results.errors.push(
						`Parameter ${tv.property}: ${result.message ?? getEnumMemberName(SetValueStatus, result.status)}`,
					)

					if (
						result.status === SetValueStatus.Fail &&
						node.status === 'Dead'
					) {
						const remaining =
							template.values.length -
							results.success -
							results.failed
						if (remaining > 0) {
							results.failed += remaining
						}
						results.reason = 'Node is dead'
						break
					}
				} else {
					results.success++
				}
			} catch (error: unknown) {
				results.failed++
				const msg = getErrorMessage(error)
				results.errors.push(`Parameter ${tv.property}: ${msg}`)
			}
		}

		this._logger.info(
			`Applied template "${template.name}" to node ${nodeId}: ${results.success} OK, ${results.failed} failed`,
		)

		if (results.success > 0 && template.contentHash) {
			if (!node.appliedTemplateContentHashes) {
				node.appliedTemplateContentHashes = []
			}

			if (
				!node.appliedTemplateContentHashes.includes(
					template.contentHash,
				)
			) {
				node.appliedTemplateContentHashes.push(template.contentHash)

				const storeNode = this._nodes.getStoreNode(nodeId)
				if (!storeNode) {
					this._nodes.setStoreNode(
						nodeId,
						{} as Partial<TemplateNodeState>,
					)
				}
				this._nodes.setStoreNode(nodeId, {
					appliedTemplateContentHashes:
						node.appliedTemplateContentHashes,
				})

				this._nodes.throttle(
					'applyTemplate_storeNodes',
					() => {
						// eslint-disable-next-line @typescript-eslint/no-floating-promises
						this._nodes.updateStoreNodes(false)
					},
					1000,
				)
			}
		}

		return results
	}

	async importConfigurationTemplates(
		templates: ZUIConfigurationTemplate[],
	): Promise<ZUIConfigurationTemplate[]> {
		for (const t of templates) {
			if (
				'minFirmwareVersion' in t &&
				typeof t.minFirmwareVersion === 'string' &&
				!t.firmwareRange
			) {
				t.firmwareRange = {
					min: t.minFirmwareVersion,
				}
				delete t.minFirmwareVersion
			}
			t.id = this._utils.generateId()
			if (!t.contentHash) {
				t.contentHash =
					ConfigurationTemplateService._generateContentHash(
						t.values,
						t.firmwareRange,
					)
			}
			this._templates.push(t)
		}

		await this._persistence.put(this._templates)

		return this._templates
	}

	checkConfigurationTemplates(
		node: TemplateNodeState,
		zwaveNode: ZWaveNode,
	): void {
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		this._cleanupAppliedHashes(node)

		const matching = this._getMatchingTemplates(node)

		if (matching.length === 0) {
			return
		}

		const appliedHashes = node.appliedTemplateContentHashes ?? []

		const autoApplyTemplates = matching.filter(
			(t) =>
				t.autoApply &&
				t.contentHash &&
				!appliedHashes.includes(t.contentHash),
		)

		for (const template of autoApplyTemplates) {
			this._nodes.logNode(
				zwaveNode,
				'info',
				`Auto-applying configuration template "${template.name}"`,
			)
			this.applyConfigurationTemplate(template.id, node.id, true)
				.then((result) => {
					if (result.failed > 0) {
						this._nodes.logNode(
							zwaveNode,
							'warn',
							`Template "${template.name}" partially applied: ${result.success} OK, ${result.failed} failed`,
						)
					}
				})
				.catch((error: unknown) => {
					const msg = getErrorMessage(error)
					this._nodes.logNode(
						zwaveNode,
						'error',
						`Failed to auto-apply template "${template.name}": ${msg}`,
					)
				})
		}
	}

	static _generateContentHash(
		values: ZUIConfigurationTemplateValue[],
		firmwareRange?: { min?: string; max?: string },
	): string {
		const normalized = values.map((v) => ({
			property: v.property,
			propertyKey: v.propertyKey ?? null,
			endpoint: v.endpoint,
			value: v.value,
		}))
		return createHash('sha256')
			.update(JSON.stringify({ values: normalized, firmwareRange }))
			.digest('hex')
			.slice(0, 12)
	}

	private async _cleanupAppliedHashes(
		node: TemplateNodeState,
	): Promise<void> {
		const hashes = node.appliedTemplateContentHashes
		if (!hashes || hashes.length === 0) return

		const validHashes = new Set(this._templates.map((t) => t.contentHash))
		const cleaned = hashes.filter((h) => validHashes.has(h))

		if (cleaned.length !== hashes.length) {
			node.appliedTemplateContentHashes = cleaned

			const storeNode = this._nodes.getStoreNode(node.id)
			if (!storeNode) {
				this._nodes.setStoreNode(
					node.id,
					{} as Partial<TemplateNodeState>,
				)
			}
			this._nodes.setStoreNode(node.id, {
				appliedTemplateContentHashes: cleaned,
			})
			await this._nodes.updateStoreNodes(false)
		}
	}

	private _getMatchingTemplates(
		node: TemplateNodeState,
	): ZUIConfigurationTemplate[] {
		if (!node.deviceId) return []

		return this._templates.filter((t) => {
			if (t.deviceId !== node.deviceId) return false

			if (t.firmwareRange?.min || t.firmwareRange?.max) {
				if (!node.firmwareVersion) {
					return false
				}

				const nodeFw = semverCoerce(node.firmwareVersion)
				if (!nodeFw) return false

				if (t.firmwareRange.min) {
					const minFw = semverCoerce(t.firmwareRange.min)
					if (!minFw || !semverGte(nodeFw, minFw)) {
						return false
					}
				}

				if (t.firmwareRange.max) {
					const maxFw = semverCoerce(t.firmwareRange.max)
					if (!maxFw || !semverLte(nodeFw, maxFw)) {
						return false
					}
				}
			}

			return true
		})
	}

	private _autoApplyToNodes(template: ZUIConfigurationTemplate): void {
		const driver = this._driver.getDriver()
		if (!driver?.controller) return

		for (const [, node] of this._nodes.getNodes()) {
			if (!node.ready || !node.deviceId) continue

			const matching = this._getMatchingTemplates(node)
			if (!matching.some((t) => t.id === template.id)) continue

			const hashes = node.appliedTemplateContentHashes ?? []
			if (hashes.includes(template.contentHash)) continue

			const zwaveNode = driver.controller.nodes.get(node.id)

			if (zwaveNode) {
				this._nodes.logNode(
					zwaveNode,
					'info',
					`Auto-applying configuration template "${template.name}"`,
				)
			}

			this.applyConfigurationTemplate(template.id, node.id, true)
				.then((result) => {
					if (result.failed > 0 && zwaveNode) {
						this._nodes.logNode(
							zwaveNode,
							'warn',
							`Template "${template.name}" partially applied: ${result.success} OK, ${result.failed} failed`,
						)
					}
				})
				.catch((error: unknown) => {
					if (zwaveNode) {
						this._nodes.logNode(
							zwaveNode,
							'error',
							`Failed to auto-apply template "${template.name}": ${getErrorMessage(error)}`,
						)
					}
				})
		}
	}
}
