export enum socketEvents {
	init = 'INIT', // automatically sent when a new client connects to the socket
	controller = 'CONTROLLER_CMD', // controller status updates
	connected = 'CONNECTED', // socket status
	nodeFound = 'NODE_FOUND',
	nodeAdded = 'NODE_ADDED',
	nodeRemoved = 'NODE_REMOVED',
	nodeUpdated = 'NODE_UPDATED',
	valueUpdated = 'VALUE_UPDATED',
	valueRemoved = 'VALUE_REMOVED',
	metadataUpdated = 'METADATA_UPDATED',
	rebuildRoutesProgress = 'REBUILD_ROUTES_PROGRESS',
	healthCheckProgress = 'HEALTH_CHECK_PROGRESS',
	info = 'INFO',
	api = 'API_RETURN', // api results
	debug = 'DEBUG',
	statistics = 'STATISTICS',
	nodeEvent = 'NODE_EVENT',
	grantSecurityClasses = 'GRANT_SECURITY_CLASSES',
	validateDSK = 'VALIDATE_DSK',
	inclusionAborted = 'INCLUSION_ABORTED',
	znifferFrame = 'ZNIFFER_FRAME',
	znifferState = 'ZNIFFER_STATE',
	linkReliability = 'LINK_RELIABILITY',
	otwFirmwareUpdate = 'OTW_FIRMWARE_UPDATE',
}

// events from client ---> server
export enum inboundEvents {
	init = 'INITED', // get all nodes
	zwave = 'ZWAVE_API', // call a zwave api
	hass = 'HASS_API', // call an hass api
	mqtt = 'MQTT_API', // call an mqtt api
	zniffer = 'ZNIFFER_API', // call a zniffer api
	subscribe = 'SUBSCRIBE',
	unsubscribe = 'UNSUBSCRIBE',
}

/** Channel-to-events mapping for room-based Socket.IO filtering */
export const channelMap: Record<string, socketEvents[]> = {
	controller: [
		socketEvents.controller,
		socketEvents.connected,
		socketEvents.info,
	],
	nodes: [
		socketEvents.nodeFound,
		socketEvents.nodeAdded,
		socketEvents.nodeRemoved,
		socketEvents.nodeUpdated,
		socketEvents.nodeEvent,
		socketEvents.grantSecurityClasses,
		socketEvents.validateDSK,
		socketEvents.inclusionAborted,
	],
	values: [
		socketEvents.valueUpdated,
		socketEvents.valueRemoved,
		socketEvents.metadataUpdated,
	],
	statistics: [socketEvents.statistics],
	firmware: [socketEvents.otwFirmwareUpdate],
	debug: [socketEvents.debug],
	znifferFrames: [socketEvents.znifferFrame],
	znifferState: [socketEvents.znifferState],
	rebuild: [socketEvents.rebuildRoutesProgress],
	diagnostics: [
		socketEvents.healthCheckProgress,
		socketEvents.linkReliability,
	],
}

/** Reverse lookup: event name → channel */
export const eventToChannel: Record<string, string> = {}
for (const [channel, events] of Object.entries(channelMap)) {
	for (const evt of events) {
		eventToChannel[evt] = channel
	}
}

/** All available channel names */
export const ALL_CHANNELS = Object.keys(channelMap)
