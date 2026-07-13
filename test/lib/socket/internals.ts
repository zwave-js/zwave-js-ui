// Types ZwaveClient/ZnifferManager's private members that Layer 2 tests drive directly to reach
// real production code paths. Replaces scattered untyped `(x as any).member` casts with one
// narrow, precisely-typed adapter per class.
import type ZWaveClientType from '#api/lib/ZwaveClient.ts'
import type ZnifferManagerType from '#api/lib/ZnifferManager.ts'

export interface ZwaveClientInternals {
	// Tests only ever assign fixture shapes here, never read a property back off it afterwards
	_driver: unknown
	_nodes: ZWaveClientType['_nodes']
	_virtualNodes: ZWaveClientType['_virtualNodes']
	storeNodes: ZWaveClientType['storeNodes']
	driverInfo: ZWaveClientType['driverInfo']
	scenes: ZWaveClientType['scenes']
	groups: ZWaveClientType['groups']
	sendToSocket: ZWaveClientType['sendToSocket']
	sendInitToSockets: ZWaveClientType['sendInitToSockets']
	_refreshBroadcastLRNode: ZWaveClientType['_refreshBroadcastLRNode']
	_updateControllerStatus: ZWaveClientType['_updateControllerStatus']
	_removeNode: ZWaveClientType['_removeNode']
	_onOTWFirmwareUpdateProgress: ZWaveClientType['_onOTWFirmwareUpdateProgress']
	_onOTWFirmwareUpdateFinished: ZWaveClientType['_onOTWFirmwareUpdateFinished']
	_onNodeFound: ZWaveClientType['_onNodeFound']
	_onGrantSecurityClasses: ZWaveClientType['_onGrantSecurityClasses']
	_onValidateDSK: ZWaveClientType['_onValidateDSK']
	_onAbortInclusion: ZWaveClientType['_onAbortInclusion']
	_onNodeEvent: ZWaveClientType['_onNodeEvent']
}

// A class with private members can't cast directly to a plain interface exposing them, so the
// cast goes through `unknown` first
export function internals(zwave: ZWaveClientType): ZwaveClientInternals {
	return zwave as unknown as ZwaveClientInternals
}

export interface ZnifferManagerInternals {
	zniffer: ZnifferManagerType['zniffer']
	onStateChange: ZnifferManagerType['onStateChange']
}

export function znifferManagerInternals(
	manager: ZnifferManagerType,
): ZnifferManagerInternals {
	return manager as unknown as ZnifferManagerInternals
}
