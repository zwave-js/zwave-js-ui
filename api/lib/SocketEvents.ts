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
}

// events from client ---> server
export enum inboundEvents {
	init = 'INITED', // get all nodes
	zwave = 'ZWAVE_API', // call a zwave api
	hass = 'HASS_API', // call an hass api
	mqtt = 'MQTT_API', // call an mqtt api
	zniffer = 'ZNIFFER_API', // call a zniffer api
}
