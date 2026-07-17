import type {
	Route,
	ValueMetadata,
	ValueMetadataNumeric,
	ValueMetadataString,
} from '@zwave-js/core'
import { Duration, SecurityClass } from '@zwave-js/core'
import type {
	Driver,
	TranslatedValueID,
	VirtualValueID,
	ZWaveNode,
} from 'zwave-js'
import { getEnumMemberName } from 'zwave-js/Utils'
import { RFRegion } from 'zwave-js'
import { isUint8Array } from 'node:util/types'

import * as utils from '#api/lib/utils'
import type { ZUINode, ZUIValueId } from '#api/lib/ZwaveClient'

export interface PhysicalNodeProjectionPort {
	getDriver(): NodeProjectionDriver
	getStoredNode(nodeId: number): Partial<ZUINode> | undefined
	ensureStoredNode(nodeId: number): void
	log(node: ZWaveNode, level: 'debug', message: string): void
}

export interface NodeProjectionDriver {
	configManager: Pick<Driver['configManager'], 'lookupManufacturer'>
	controller: Pick<Driver['controller'], 'getSupportedRFRegions'>
}

export class NodeProjector {
	static getValueId(
		value: Pick<
			TranslatedValueID,
			'commandClass' | 'endpoint' | 'property' | 'propertyKey'
		> & { nodeId?: number },
		withNode = false,
	): string {
		return `${withNode ? value.nodeId + '-' : ''}${value.commandClass}-${
			value.endpoint || 0
		}-${value.property}${
			value.propertyKey !== undefined ? '-' + value.propertyKey : ''
		}`
	}

	static newVirtualNode(
		id: number,
		name: string,
		kind: NonNullable<ZUINode['kind']>,
	): ZUINode {
		return {
			id,
			name,
			virtual: true,
			kind,
			ready: true,
			available: true,
			failed: false,
			inited: true,
			values: {},
			eventsQueue: [],
		}
	}

	static createPhysicalNode(
		nodeId: number,
		storedNode: Partial<ZUINode> | undefined,
		prioritySUCReturnRoute: Route | undefined,
		customSUCReturnRoutes: Route[] | undefined,
	): ZUINode {
		return {
			id: nodeId,
			name: storedNode?.name || '',
			loc: storedNode?.loc || '',
			values: {},
			groups: [],
			neighbors: [],
			ready: false,
			available: false,
			hassDevices: {},
			failed: false,
			inited: false,
			eventsQueue: [],
			status: 'Unknown',
			interviewStage: 'None',
			priorityReturnRoute: {},
			customReturnRoute: {},
			prioritySUCReturnRoute,
			customSUCReturnRoutes,
			applicationRoute: null,
			availableFirmwareUpdates:
				storedNode?.availableFirmwareUpdates || [],
			firmwareUpdatesDismissed:
				storedNode?.firmwareUpdatesDismissed || {},
			lastFirmwareUpdateCheck: storedNode?.lastFirmwareUpdateCheck || 0,
			appliedTemplateContentHashes:
				storedNode?.appliedTemplateContentHashes || [],
		}
	}

	static applyValueMetadata(valueId: ZUIValueId, meta: ValueMetadata): void {
		if (meta.type === 'number') {
			const numMeta = meta as ValueMetadataNumeric
			valueId.min = numMeta.min
			valueId.max = numMeta.max
			valueId.step = numMeta.steps
			valueId.allowed = numMeta.allowed
			valueId.unit = numMeta.unit

			if (numMeta.states && Object.keys(numMeta.states).length > 0) {
				valueId.list = true
				// Ranged states need manual entry because zwave-js 15.21+ exposes ranges alongside labels
				valueId.allowManualEntry = numMeta.allowManualEntry
				if (
					valueId.allowManualEntry === undefined &&
					numMeta.allowed?.some(
						(entry) => 'from' in entry && 'to' in entry,
					)
				) {
					valueId.allowManualEntry = true
				}
				valueId.states = []
				for (const key in numMeta.states) {
					valueId.states.push({
						text: numMeta.states[key],
						value: Number.parseInt(key),
					})
				}
			} else {
				valueId.list = false
			}

			if ('destructive' in numMeta && numMeta.destructive) {
				valueId.destructive = true
			}
		} else if (meta.type === 'string' || meta.type === 'color') {
			const stringMeta = meta as ValueMetadataString
			valueId.minLength = stringMeta.minLength
			valueId.maxLength = stringMeta.maxLength
			valueId.list = false
		} else if (meta.type === 'boolean') {
			const states =
				'states' in meta &&
				typeof meta.states === 'object' &&
				meta.states !== null
					? meta.states
					: undefined
			if (states && Object.keys(states).length > 0) {
				valueId.list = true
				valueId.states = []
				for (const [key, text] of Object.entries(states)) {
					if (text === undefined) continue
					valueId.states.push({
						text,
						value: key === 'true',
					})
				}
			} else {
				valueId.list = false
			}
		} else {
			valueId.list = false
		}
	}

	static buildVirtualValue(
		nodeId: number,
		zwaveValue: VirtualValueID,
		value: unknown,
		existing?: ZUIValueId,
		now = Date.now(),
	): ZUIValueId | null {
		const meta = zwaveValue.metadata
		if (!meta) return null

		// Synthesized Basic CC value IDs may omit ccVersion
		const ccVersion =
			typeof zwaveValue.ccVersion === 'number' && zwaveValue.ccVersion > 0
				? zwaveValue.ccVersion
				: 1
		const withNode = { ...zwaveValue, nodeId }
		const valueId: ZUIValueId = {
			// Preserve user poll settings when rebuilding virtual values
			...(existing || {}),
			id: NodeProjector.getValueId(withNode, true),
			nodeId,
			toUpdate: false,
			commandClass: zwaveValue.commandClass,
			commandClassName: zwaveValue.commandClassName,
			endpoint: zwaveValue.endpoint,
			property: zwaveValue.property,
			propertyName: zwaveValue.propertyName,
			propertyKey: zwaveValue.propertyKey,
			propertyKeyName: zwaveValue.propertyKeyName,
			type: meta.type,
			readable: meta.readable ?? false,
			writeable: meta.writeable ?? true,
			description: meta.description,
			label: meta.label || zwaveValue.propertyName + ' (property)',
			default: meta.default,
			ccSpecific: meta.ccSpecific,
			stateless: false,
			commandClassVersion: ccVersion,
			value,
			lastUpdate: now,
		}

		NodeProjector.applyValueMetadata(valueId, meta)
		return valueId
	}

	static updateValueMetadata(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & {
			nodeId?: number
			stateless?: boolean
			newValue?: unknown
		},
		meta: ValueMetadata,
		existing?: ZUIValueId,
	): ZUIValueId {
		zwaveValue.nodeId = zwaveNode.id
		const valueId: ZUIValueId = {
			...(existing || {}),
			id: NodeProjector.getValueId(zwaveValue, true),
			nodeId: zwaveNode.id,
			toUpdate: false,
			commandClass: zwaveValue.commandClass,
			commandClassName: zwaveValue.commandClassName,
			endpoint: zwaveValue.endpoint,
			property: zwaveValue.property,
			propertyName: zwaveValue.propertyName,
			propertyKey: zwaveValue.propertyKey,
			propertyKeyName: zwaveValue.propertyKeyName,
			type: meta.type,
			readable: meta.readable,
			writeable: meta.writeable,
			description: meta.description,
			label: meta.label || zwaveValue.propertyName + ' (property)',
			default: meta.default,
			ccSpecific: meta.ccSpecific,
			stateless: zwaveValue.stateless || false,
		}

		if (zwaveNode.ready) {
			const endpoint =
				typeof zwaveValue.endpoint === 'number'
					? zwaveNode.getEndpoint(zwaveValue.endpoint)
					: undefined
			valueId.commandClassVersion = (endpoint ?? zwaveNode).getCCVersion(
				zwaveValue.commandClass,
			)
		}

		NodeProjector.applyValueMetadata(valueId, meta)
		return valueId
	}

	static projectValue(
		zwaveNode: ZWaveNode,
		zwaveValue: TranslatedValueID & {
			stateless?: boolean
			newValue?: unknown
		},
		meta: ValueMetadata,
		existing?: ZUIValueId,
		previousValue?: unknown,
	): ZUIValueId {
		const valueId = NodeProjector.updateValueMetadata(
			zwaveNode,
			zwaveValue,
			meta,
			existing,
		)
		valueId.value = zwaveNode.getValue(zwaveValue)
		if (valueId.value === undefined) {
			valueId.value =
				zwaveValue.newValue !== undefined
					? zwaveValue.newValue
					: previousValue
		}
		if (valueId.type === 'duration' && valueId.value === undefined) {
			valueId.value = Reflect.construct(Duration, [undefined, 'seconds'])
		}
		if (NodeProjector.isCurrentValue(valueId)) {
			valueId.isCurrentValue = true
			const targetValue = NodeProjector.findTargetValue(
				valueId,
				zwaveNode.getDefinedValueIDs(),
			)
			if (targetValue) {
				valueId.targetValue = NodeProjector.getValueId(targetValue)
			}
		}
		return valueId
	}

	static isCurrentValue(
		valueId: Pick<TranslatedValueID, 'propertyName'>,
	): boolean {
		return !!valueId.propertyName && /current/i.test(valueId.propertyName)
	}

	static findTargetValue(
		zwaveValue: TranslatedValueID,
		definedValueIds: TranslatedValueID[],
	): TranslatedValueID | undefined {
		return definedValueIds.find(
			(candidate) =>
				candidate.commandClass === zwaveValue.commandClass &&
				candidate.endpoint === zwaveValue.endpoint &&
				candidate.propertyKey === zwaveValue.propertyKey &&
				/target/i.test(candidate.property.toString()),
		)
	}

	static getDeviceId(node: ZUINode | undefined): string {
		if (!node) return ''
		return `${node.manufacturerId}-${node.productId}-${node.productType}`
	}

	static parseNotification(parameters: unknown): unknown {
		if (isUint8Array(parameters)) {
			return Buffer.from(parameters.buffer).toString('hex')
		}
		if (parameters instanceof Duration) {
			return parameters.toMilliseconds()
		}
		return parameters
	}

	static zwaveNodeToJSON(node: ZWaveNode, zuiNode?: ZUINode) {
		return {
			id: node.id,
			inited: zuiNode?.inited,
			name: node.name,
			location: node.location,
			status: node.status,
			isControllerNode: node.isControllerNode,
			interviewStage: node.interviewStage,
			deviceClass: node.deviceClass,
			zwavePlusVersion: node.zwavePlusVersion,
			ready: node.ready,
			zwavePlusRoleType: node.zwavePlusRoleType,
			isListening: node.isListening,
			isFrequentListening: node.isFrequentListening,
			canSleep: node.canSleep,
			isRouting: node.isRouting,
			supportedDataRates: node.supportedDataRates,
			maxDataRate: node.maxDataRate,
			supportsSecurity: node.supportsSecurity,
			isSecure: node.isSecure,
			supportsBeaming: node.supportsBeaming,
			protocolVersion: node.protocolVersion,
			sdkVersion: node.sdkVersion,
			firmwareVersion: node.firmwareVersion,
			manufacturerId: node.manufacturerId,
			manufacturer: zuiNode?.manufacturer,
			productId: node.productId,
			productDescription: zuiNode?.productDescription,
			productType: node.productType,
			productLabel: zuiNode?.productLabel,
			deviceDatabaseUrl: node.deviceDatabaseUrl,
			keepAwake: node.keepAwake,
			protocol: node.protocol,
			supportsLongRange: zuiNode?.supportsLongRange,
		}
	}

	static projectPhysicalNode(
		node: ZUINode,
		zwaveNode: ZWaveNode,
		port: PhysicalNodeProjectionPort,
	): void {
		// Resolve the driver per projection so restarted generations cannot remain captured
		const driver = port.getDriver()
		const toHex = (value: number | undefined): string =>
			value === undefined ? '0xXXXX' : utils.num2hex(value)
		const hexIds = [
			toHex(zwaveNode.manufacturerId),
			toHex(zwaveNode.productId),
			toHex(zwaveNode.productType),
		]
		node.hexId = `${hexIds[0]} ${hexIds[2]}-${hexIds[1]}`
		node.dbLink = `https://devices.zwave-js.io/?jumpTo=${hexIds[0]}:${
			hexIds[2]
		}:${hexIds[1]}:${node.firmwareVersion || '0.0'}`

		const deviceConfig = zwaveNode.deviceConfig || {
			label: `Unknown product ${hexIds[1]}`,
			description: hexIds[2],
			manufacturer:
				(typeof zwaveNode.manufacturerId === 'number'
					? driver.configManager.lookupManufacturer(
							zwaveNode.manufacturerId,
						)
					: undefined) || `Unknown manufacturer ${hexIds[0]}`,
		}

		node.manufacturerId = zwaveNode.manufacturerId
		node.productId = zwaveNode.productId
		node.productType = zwaveNode.productType
		node.deviceConfig = zwaveNode.deviceConfig
		node.productLabel = deviceConfig.label
		node.productDescription = deviceConfig.description
		node.manufacturer = deviceConfig.manufacturer
		node.firmwareVersion = zwaveNode.firmwareVersion
		node.sdkVersion = zwaveNode.sdkVersion
		node.protocolVersion = zwaveNode.protocolVersion
		node.zwavePlusVersion = zwaveNode.zwavePlusVersion
		node.zwavePlusNodeType = zwaveNode.zwavePlusNodeType
		node.zwavePlusRoleType = zwaveNode.zwavePlusRoleType
		node.nodeType = zwaveNode.nodeType
		node.endpointsCount = zwaveNode.getEndpointCount()
		node.endpoints = zwaveNode.getAllEndpoints().map((endpoint) => {
			const defaultLabel =
				endpoint.index === 0
					? 'Root Endpoint'
					: `Endpoint ${endpoint.index}`
			return {
				index: endpoint.index,
				label: endpoint.endpointLabel || defaultLabel,
				deviceClass: {
					basic: endpoint.deviceClass?.basic,
					generic: endpoint.deviceClass?.generic.key,
					specific: endpoint.deviceClass?.specific.key,
				},
			}
		})
		node.isSecure = zwaveNode.isSecure
		const security = zwaveNode.getHighestSecurityClass()
		node.security =
			typeof security === 'number' ? SecurityClass[security] : undefined
		node.supportsSecurity = zwaveNode.supportsSecurity
		node.supportsBeaming = zwaveNode.supportsBeaming
		node.isControllerNode = zwaveNode.isControllerNode
		node.isListening = zwaveNode.isListening
		node.isFrequentListening = zwaveNode.isFrequentListening
		node.isRouting = zwaveNode.isRouting
		node.keepAwake = zwaveNode.keepAwake
		node.maxDataRate = zwaveNode.maxDataRate
		node.deviceClass = {
			basic: zwaveNode.deviceClass?.basic,
			generic: zwaveNode.deviceClass?.generic.key,
			specific: zwaveNode.deviceClass?.specific.key,
		}
		node.lastActive = zwaveNode.lastSeen?.getTime() || null
		node.defaultTransitionDuration = zwaveNode.defaultTransitionDuration
		node.defaultVolume = zwaveNode.defaultVolume
		node.firmwareCapabilities =
			zwaveNode.getFirmwareUpdateCapabilitiesCached()
		node.protocol = zwaveNode.protocol

		const storedNode = port.getStoredNode(node.id)
		if (storedNode) {
			node.loc = storedNode.loc || ''
			node.name = storedNode.name || ''
			if (storedNode.hassDevices) {
				node.hassDevices = utils.copy(storedNode.hassDevices)
			}
			if (node.name && node.name !== zwaveNode.name) {
				port.log(
					zwaveNode,
					'debug',
					`Setting node name to '${node.name}'`,
				)
				zwaveNode.name = node.name
			}
			if (node.loc && node.loc !== zwaveNode.location) {
				port.log(
					zwaveNode,
					'debug',
					`Setting node location to '${node.loc}'`,
				)
				zwaveNode.location = node.loc
			}
		} else {
			port.ensureStoredNode(node.id)
		}

		node.deviceId = NodeProjector.getDeviceId(node)
		node.hasDeviceConfigChanged = zwaveNode.hasDeviceConfigChanged()
		if (node.isControllerNode) {
			node.rfRegions =
				driver.controller
					.getSupportedRFRegions()
					?.map((region) => ({
						value: region,
						title: getEnumMemberName(RFRegion, region),
						disabled:
							region === RFRegion.Unknown ||
							region === RFRegion['Default (EU)'],
					}))
					.sort((a, b) => a.title.localeCompare(b.title)) ?? []
		}
	}
}
