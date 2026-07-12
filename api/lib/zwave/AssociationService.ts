/**
 * AssociationService – owns all association read/check/add/remove flows:
 * populating a node's discovered association groups, reading current
 * associations, checking whether a candidate association is allowed, and
 * adding/removing associations (including bulk "remove all" and "remove
 * this node from every other node's associations" flows used on node
 * removal).
 *
 * Extracted from ZwaveClient to keep the monolith slim. The service is
 * strict-clean (no `any` casts, no non-null assertions, no ts-ignore) and
 * fully stateless — every call resolves the current driver/controller/node
 * state through its ports, so a driver restart is honoured transparently.
 *
 * Ports:
 *   driver – resolves the current driver (and its controller) lazily
 *   nodes  – physical ZWaveNode + ZUINode registry access, socket emission
 *   log    – node-scoped logging (mirrors ZwaveClient's `logNode`)
 */

import {
	AssociationCheckResult,
	type AssociationAddress,
	type AssociationGroup,
} from 'zwave-js'
import { CommandClasses } from '@zwave-js/core'
import { getEnumMemberName } from 'zwave-js/Utils'
import { getErrorMessage } from '../errors.ts'
import type {
	AssociationDriverPort,
	AssociationEntry,
	AssociationLogPort,
	AssociationNodeStorePort,
} from './ports.ts'

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

	// ---------------------------------------------------------------
	// Public API – exact signatures preserved from ZwaveClient
	// ---------------------------------------------------------------

	/**
	 * Resolves the current driver, throwing if it is not (yet/anymore)
	 * available.
	 *
	 * This is intentionally called fresh at every point in this file where
	 * the pre-extraction `ZwaveClient` re-read `this._driver` directly
	 * (rather than once at the top of a method), including immediately
	 * after `await` boundaries such as CC-value refreshes or a preceding
	 * add/remove call. A driver can be torn down and replaced by a
	 * restart while one of these methods is suspended on an `await`, so
	 * every access must observe the *current* driver instead of a value
	 * captured before the suspension — caching it into a local once and
	 * reusing that reference across an `await` would silently keep
	 * operating against a stale/destroyed driver.
	 */
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
			// Matches original behavior: groups are reset unconditionally
			// once a node/ZUI-node pair is found, even if the controller
			// call above failed or the driver was unavailable.
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
				// Re-resolved here (after the refresh awaits above), not
				// cached before them, so a driver restart that races with
				// the CC refresh is observed instead of operating on a
				// torn-down driver.
				const driver = this._requireDriver()
				// https://zwave-js.github.io/node-zwave-js/#/api/controller?id=association-interface
				// the result is a map where the key is the group number and the value is the array of associations {nodeId, endpoint?}
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
				// node doesn't support groups associations
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

	/**
	 * Check if a given association is allowed
	 */
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
			// Re-resolved on every iteration (not once before the loop) so
			// that a driver restart occurring during a previous
			// iteration's awaited `addAssociations` call is observed by
			// the next iteration instead of continuing to use the old
			// driver.
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

	/**
	 * Remove a node from an association group
	 */
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

	/**
	 * Remove all associations
	 */
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
							// Re-resolved on every inner-loop iteration (not
							// cached from the `getAllAssociations` call
							// above) so a driver restart racing with a
							// previous iteration's await is observed
							// instead of continuing against a stale driver.
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

	/**
	 * Remove node from all associations
	 */
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
