// @ts-check
// Door locks: a basic lock with User Code, and a keypad lock with full
// User Code v2 + Schedule Entry Lock so the schedule UI has data to render.
const { CommandClasses } = require('@zwave-js/core')
const { ccCaps } = require('@zwave-js/testing')
const {
	DoorLockMode,
	DoorLockOperationType,
	UserIDStatus,
	KeypadMode,
} = require('zwave-js')

/** @type {import('zwave-js/Testing').MockServerOptions['config']} */
module.exports.default = {
	nodes: [
		// Basic door lock
		{
			id: 17,
			capabilities: {
				genericDeviceClass: 0x40,
				specificDeviceClass: 0x01,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Back Door Lock',
						location: 'Back Door',
					}),
					ccCaps({
						ccId: CommandClasses['Door Lock'],
						version: 4,
						supportedOperationTypes: [
							DoorLockOperationType.Constant,
						],
						supportedDoorLockModes: [
							DoorLockMode.Unsecured,
							DoorLockMode.Secured,
						],
						doorSupported: true,
						boltSupported: true,
						latchSupported: false,
					}),
					ccCaps({
						ccId: CommandClasses['User Code'],
						version: 1,
						numUsers: 5,
					}),
					CommandClasses.Battery,
				],
			},
		},
		// Keypad lock with full User Code + Schedule Entry Lock
		{
			id: 18,
			capabilities: {
				genericDeviceClass: 0x40,
				specificDeviceClass: 0x03,
				commandClasses: [
					{ ccId: CommandClasses.Version, version: 3 },
					CommandClasses['Manufacturer Specific'],
					ccCaps({
						ccId: CommandClasses['Node Naming and Location'],
						name: 'Front Door Lock',
						location: 'Entrance',
					}),
					ccCaps({
						ccId: CommandClasses['Door Lock'],
						version: 4,
						supportedOperationTypes: [
							DoorLockOperationType.Constant,
							DoorLockOperationType.Timed,
						],
						supportedDoorLockModes: [
							DoorLockMode.Unsecured,
							DoorLockMode.UnsecuredWithTimeout,
							DoorLockMode.Secured,
						],
						doorSupported: true,
						boltSupported: true,
						latchSupported: true,
						autoRelockSupported: true,
						holdAndReleaseSupported: true,
					}),
					ccCaps({
						ccId: CommandClasses['User Code'],
						version: 2,
						numUsers: 20,
						supportsAdminCode: true,
						supportedASCIIChars: '0123456789',
						supportedUserIDStatuses: [
							UserIDStatus.Available,
							UserIDStatus.Enabled,
							UserIDStatus.Disabled,
						],
						supportedKeypadModes: [
							KeypadMode.Normal,
							KeypadMode.Vacation,
						],
					}),
					ccCaps({
						ccId: CommandClasses['Schedule Entry Lock'],
						version: 3,
						numWeekDaySlots: 7,
						numYearDaySlots: 4,
						numDailyRepeatingSlots: 2,
					}),
					CommandClasses.Battery,
				],
			},
		},
	],
}
