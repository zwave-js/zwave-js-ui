import {
	AssociationCheckResult,
	type AssociationAddress,
	type AssociationGroup,
} from 'zwave-js'
import { CommandClasses } from '@zwave-js/core'
import { getEnumMemberName } from 'zwave-js/Utils'
import { getErrorMessage } from '#api/lib/errors'
import type {
	AssociationDriverPort,
	AssociationEntry,
	AssociationLogPort,
	AssociationNodeStorePort,
} from '#api/lib/zwave/ports'

export class AssociationService {
	private readonly _driver: AssociationDriverPort
	private readonly _nodes: AssociationNodeStorePort
	private readonly _log: AssociationLogPort

	constructor(
		driver: AssociationDriverPort,
		nodes: AssociationNodeStorePort,
		log: AssociationLogPort,
	) {
		this._driver = driver
		this._nodes = nodes
		this._log = log
	}

	// Call fresh at every use site, including right after each await, because a restart can swap the driver while suspended and a cached reference would keep hitting the torn-down driver
	private _requireDriver() {
		const driver = this._driver.getDriver()
		if (!driver) {
			throw new Error('Driver not ready')
		}
		return driver
	}

	/**
	 * Populate node `groups`
	 */
	getGroups(nodeId: number, ignoreUpdate = false): void {
		const zwaveNode = this._nodes.getZWaveNode(nodeId)
		const node = this._nodes.getZUINode(nodeId)

		if (node && zwaveNode) {
			let endpointGroups: ReadonlyMap<
				number,
				ReadonlyMap<number, AssociationGroup>
			> = new Map()
			try {
				const driver = this._requireDriver()
				endpointGroups =
					driver.controller.getAllAssociationGroups(nodeId)
			} catch (error) {
				this._log.logNode(
					nodeId,
					'warn',
					`Error while fetching groups associations: ${getErrorMessage(error)}`,
				)
			}
			// Reset even on fetch failure so stale groups from a previous read aren't left in place
			node.groups = []

			for (const [endpoint, groups] of endpointGroups) {
				for (const [groupIndex, group] of groups) {
					// https://zwave-js.github.io/node-zwave-js/#/api/controller?id=associationgroup-interface
					node.groups.push({
						title: group.label,
						endpoint: endpoint,
						value: groupIndex,
						maxNodes: group.maxNodes,
						isLifeline: group.isLifeline,
						multiChannel: group.multiChannel,
					})
				}
			}
		}

		if (node && !ignoreUpdate) {
			this._nodes.emitNodeUpdate(node, { groups: node.groups })
		}
	}

	/**
	 * Get an array of current [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface) of a specific group
	 */
	async getAssociations(
		nodeId: number,
		refresh = false,
	): Promise<AssociationEntry[]> {
		const zwaveNode = this._nodes.getZWaveNode(nodeId)
		const toReturn: AssociationEntry[] = []

		if (zwaveNode) {
			try {
				if (refresh) {
					await zwaveNode.refreshCCValues(CommandClasses.Association)
					await zwaveNode.refreshCCValues(
						CommandClasses['Multi Channel Association'],
					)
				}
				// Resolve after the refresh awaits, not before, so a concurrent restart isn't missed
				const driver = this._requireDriver()
				// https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
				// Keyed by group number, each value the array of {nodeId, endpoint?} associations
				const result = driver.controller.getAllAssociations(nodeId)
				for (const [source, group] of result.entries()) {
					for (const [groupId, associations] of group) {
						for (const a of associations) {
							toReturn.push({
								endpoint: source.endpoint,
								groupId: groupId,
								nodeId: a.nodeId,
								targetEndpoint: a.endpoint,
							})
						}
					}
				}
			} catch (error) {
				this._log.logNode(
					nodeId,
					'warn',
					`Error while fetching groups associations: ${getErrorMessage(error)}`,
				)
				// Node doesn't support groups associations
			}
		} else {
			this._log.logNode(
				nodeId,
				'warn',
				`Error while fetching groups associations, node not found`,
			)
		}

		return toReturn
	}

	checkAssociation(
		source: AssociationAddress,
		groupId: number,
		association: AssociationAddress,
	): AssociationCheckResult {
		const driver = this._requireDriver()
		return driver.controller.checkAssociation(source, groupId, association)
	}

	/**
	 * Add a node to the array of specified [associations](https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface)
	 */
	async addAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[],
		options?: { force?: boolean },
	): Promise<AssociationCheckResult[]> {
		const zwaveNode = this._nodes.getZWaveNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (!zwaveNode) {
			throw new Error(`Node ${source.nodeId} not found`)
		}

		const result: AssociationCheckResult[] = []
		const force = options?.force ?? false

		for (const a of associations) {
			// Resolve every iteration, not once above the loop, so a restart during a prior await is picked up
			const driver = this._requireDriver()
			const checkResult = driver.controller.checkAssociation(
				source,
				groupId,
				a,
			)

			result.push(checkResult)

			if (checkResult === AssociationCheckResult.OK || force) {
				const isForcedAdd =
					force && checkResult !== AssociationCheckResult.OK
				const logLevel = isForcedAdd ? 'warn' : 'info'
				const action = isForcedAdd ? 'Force adding' : 'Adding'
				const bypassInfo = isForcedAdd
					? ` (bypassing check: ${getEnumMemberName(AssociationCheckResult, checkResult)})`
					: ''

				this._log.logNode(
					source.nodeId,
					logLevel,
					`${action} Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}${bypassInfo}`,
				)

				await driver.controller.addAssociations(source, groupId, [a], {
					force,
				})
			} else {
				this._log.logNode(
					source.nodeId,
					'warn',
					`Unable to add Node ${a.nodeId} to Group ${groupId} of ${sourceMsg}: ${getEnumMemberName(AssociationCheckResult, checkResult)}`,
				)
			}
		}

		return result
	}

	async removeAssociations(
		source: AssociationAddress,
		groupId: number,
		associations: AssociationAddress[],
	): Promise<void> {
		const zwaveNode = this._nodes.getZWaveNode(source.nodeId)

		const sourceMsg = `Node ${
			source.nodeId +
			(source.endpoint ? ' Endpoint ' + source.endpoint : '')
		}`

		if (zwaveNode) {
			try {
				this._log.logNode(
					source.nodeId,
					'info',
					`Removing associations from ${sourceMsg} Group ${groupId}: %o`,
					associations,
				)

				const driver = this._requireDriver()
				await driver.controller.removeAssociations(
					source,
					groupId,
					associations,
				)
			} catch (error) {
				this._log.logNode(
					source.nodeId,
					'warn',
					`Error while removing associations from ${sourceMsg}: ${getErrorMessage(error)}`,
				)
			}
		} else {
			this._log.logNode(
				source.nodeId,
				'warn',
				`Error while removing associations from ${sourceMsg}, node not found`,
			)
		}
	}

	async removeAllAssociations(nodeId: number): Promise<void> {
		const zwaveNode = this._nodes.getZWaveNode(nodeId)

		if (zwaveNode) {
			try {
				const driver = this._requireDriver()
				const allAssociations =
					driver.controller.getAllAssociations(nodeId)

				for (const [
					source,
					groupAssociations,
				] of allAssociations.entries()) {
					for (const [groupId, associations] of groupAssociations) {
						if (associations.length > 0) {
							// Resolve every inner-loop iteration, not once outside, so a restart during a prior await is picked up
							const currentDriver = this._requireDriver()
							await currentDriver.controller.removeAssociations(
								source,
								groupId,
								[...associations],
							)
							this._log.logNode(
								nodeId,
								'info',
								`Removed ${
									associations.length
								} associations from Node ${
									source.nodeId +
									(source.endpoint
										? ' Endpoint ' + source.endpoint
										: '')
								} group ${groupId}`,
							)
						}
					}
				}
			} catch (error) {
				this._log.logNode(
					nodeId,
					'warn',
					`Error while removing all associations from ${nodeId}: ${getErrorMessage(error)}`,
				)
			}
		} else {
			this._log.logNode(
				nodeId,
				'warn',
				`Node not found when calling 'removeAllAssociations'`,
			)
		}
	}

	async removeNodeFromAllAssociations(nodeId: number): Promise<void> {
		const zwaveNode = this._nodes.getZWaveNode(nodeId)

		if (zwaveNode) {
			try {
				this._log.logNode(
					nodeId,
					'info',
					`Removing Node ${nodeId} from all associations`,
				)

				const driver = this._requireDriver()
				await driver.controller.removeNodeFromAllAssociations(nodeId)
			} catch (error) {
				this._log.logNode(
					nodeId,
					'warn',
					`Error while removing Node ${nodeId} from all associations: ${getErrorMessage(error)}`,
				)
			}
		} else {
			this._log.logNode(
				nodeId,
				'warn',
				`Node not found when calling 'removeNodeFromAllAssociations'`,
			)
		}
	}
}
