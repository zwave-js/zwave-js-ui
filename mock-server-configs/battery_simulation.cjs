// @ts-check
const { CommandClasses } = require('@zwave-js/core')
const { createMockZWaveRequestFrame } = require('@zwave-js/testing')
const {
	BatteryCCReport,
	BatteryCCGet,
	BatteryChargingStatus,
	BatteryReplacementStatus,
} = require('zwave-js')

let sentSoonReport = false
let sentNowReport = false
let level = 100

/** @type {import("zwave-js/Testing").MockServerOptions["config"]} */
module.exports.default = {
	nodes: [
		{
			id: 2,
			capabilities: {
				isListening: false,
				isFrequentListening: false,
				commandClasses: [
					CommandClasses.Version,
					CommandClasses.Battery,
				],
			},
			behaviors: [
				{
					async handleCC(controller, self, receivedCC) {
						if (receivedCC instanceof BatteryCCGet) {
							// Start reporting battery level changes
							setInterval(() => {
								if (level === 0) {
									level = 100
									sentNowReport = false
									sentSoonReport = false
									return
								}

								if (level < 10) {
									if (!sentNowReport) {
										const report = new BatteryCCReport({
											nodeId: controller.ownNodeId,
											level: level,
											chargingStatus:
												BatteryChargingStatus.Discharging,
											rechargeable: false,
											backup: false,
											overheating: false,
											lowFluid: false,
											rechargeOrReplace:
												BatteryReplacementStatus.Now,
											disconnected: false,
										})
										sentNowReport = true
										self.sendToController(
											createMockZWaveRequestFrame(
												report,
												{
													ackRequested: false,
												},
											),
										)
									}
								} else if (level < 30) {
									if (!sentSoonReport) {
										const report = new BatteryCCReport({
											nodeId: controller.ownNodeId,
											level: level,
											chargingStatus:
												BatteryChargingStatus.Discharging,
											rechargeable: false,
											backup: false,
											overheating: false,
											lowFluid: false,
											rechargeOrReplace:
												BatteryReplacementStatus.Soon,
											disconnected: false,
										})
										sentSoonReport = true
										self.sendToController(
											createMockZWaveRequestFrame(
												report,
												{
													ackRequested: false,
												},
											),
										)
									}
								} else {
									const report = new BatteryCCReport({
										nodeId: controller.ownNodeId,
										level: level,
										// chargingStatus:
										// 	BatteryChargingStatus.Discharging,
										// rechargeable: false,
										// backup: false,
										// overheating: false,
										// lowFluid: false,
										// rechargeOrReplace:
										// 	BatteryReplacementStatus.No,
										// disconnected: false,
									})
									self.sendToController(
										createMockZWaveRequestFrame(report, {
											ackRequested: false,
										}),
									)
								}
								level -= 2
							}, 1000)
						}

						return undefined
					},
				},
			],
		},
	],
}
