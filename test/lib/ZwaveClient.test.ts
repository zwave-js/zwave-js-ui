import chai, { expect } from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import { RFRegion } from '@zwave-js/core'

chai.use(sinonChai)

// Mock ZwaveClient with minimal implementation for testing
class MockZwaveClient {
	private _driver: any
	private cfg: any
	public driverReady: boolean = true
	public updateControllerNodeProps: sinon.SinonStub

	constructor() {
		this._driver = {
			controller: {
				setRFRegion: sinon.stub().resolves(true),
			},
		}
		this.cfg = {
			rf: {
				txPower: { powerlevel: 5.0 },
				maxLongRangePowerlevel: 14,
			},
		}
		this.updateControllerNodeProps = sinon.stub().resolves()
	}

	async setRFRegion(region: RFRegion): Promise<boolean> {
		if (this.driverReady) {
			const result = await this._driver.controller.setRFRegion(region)

			// Determine which properties need updating
			const propsToUpdate: Array<
				'powerlevel' | 'RFRegion' | 'maxLongRangePowerlevel'
			> = ['RFRegion', 'powerlevel']

			// If LR powerlevel is in auto mode, refresh it after region change
			if (this.cfg.rf?.maxLongRangePowerlevel === 'auto') {
				propsToUpdate.push('maxLongRangePowerlevel')
			}

			await this.updateControllerNodeProps(null, propsToUpdate)
			return result
		}

		throw new Error('Driver not ready')
	}
}

describe('#ZwaveClient', () => {
	describe('#setRFRegion()', () => {
		let client: MockZwaveClient

		beforeEach(() => {
			client = new MockZwaveClient()
		})

		afterEach(() => {
			sinon.restore()
		})

		it('should always update normal powerlevel when region changes', async () => {
			// Set powerlevel to a specific value (not auto)
			client.cfg.rf.txPower.powerlevel = 5.0

			await client.setRFRegion(RFRegion.Europe)

			// Verify that updateControllerNodeProps was called with both RFRegion and powerlevel
			expect(client.updateControllerNodeProps).to.have.been.calledWith(
				null,
				['RFRegion', 'powerlevel'],
			)
		})

		it('should update LR powerlevel only when in auto mode', async () => {
			// Set LR powerlevel to auto mode
			client.cfg.rf.maxLongRangePowerlevel = 'auto'

			await client.setRFRegion(RFRegion.USA)

			// Verify that updateControllerNodeProps was called with all three properties
			expect(client.updateControllerNodeProps).to.have.been.calledWith(
				null,
				['RFRegion', 'powerlevel', 'maxLongRangePowerlevel'],
			)
		})

		it('should not update LR powerlevel when not in auto mode', async () => {
			// Set LR powerlevel to specific value (not auto)
			client.cfg.rf.maxLongRangePowerlevel = 14

			await client.setRFRegion(RFRegion.Europe)

			// Verify that updateControllerNodeProps was called with only RFRegion and powerlevel
			expect(client.updateControllerNodeProps).to.have.been.calledWith(
				null,
				['RFRegion', 'powerlevel'],
			)
		})

		it('should throw error when driver is not ready', async () => {
			client.driverReady = false

			try {
				await client.setRFRegion(RFRegion.Europe)
				expect.fail('Should have thrown an error')
			} catch (error) {
				expect(error.message).to.equal('Driver not ready')
			}
		})
	})
})
