import chai, { expect } from 'chai'
import proxyquire from 'proxyquire'
import sinon, { SinonStub } from 'sinon'

import sinonChai from 'sinon-chai'

chai.use(sinonChai)

declare let process: NodeJS.Process & {
	pkg?: boolean
}
const snapshotPath = '/snapshot/zui'

describe('#utils', () => {
	describe('#getPath()', () => {
		const utils = proxyquire('../../api/lib/utils', {
			path: {
				resolve: () => snapshotPath,
			},
		})

		it('write && process.pkg', () => {
			process.pkg = true
			expect(utils.getPath(true)).to.equal(process.cwd())
		})
		it('write && !process.pkg', () => {
			delete process.pkg
			expect(utils.getPath(true)).to.equal(snapshotPath)
		})
		it('!write && process.pkg', () => {
			process.pkg = true
			expect(utils.getPath(false)).to.equal(snapshotPath)
		})
		it('!write && !process.pkg', () => {
			delete process.pkg
			expect(utils.getPath(false)).to.equal(snapshotPath)
		})
	})

	describe('#joinPath()', () => {
		let path: { join: SinonStub; resolve: () => string }
		let utils

		before(() => {
			path = { join: sinon.stub(), resolve: () => snapshotPath }
			utils = proxyquire('../../api/lib/utils', {
				path: path,
			})
		})

		it('zero length', () => {
			utils.joinPath()
			return expect(path.join.callCount).to.equal(1)
		})
		it('1 length', () => {
			utils.joinPath('foo')
			return expect(path.join).to.have.been.calledWith('foo')
		})
		it('first arg bool gets new path 0', () => {
			utils.joinPath(true, 'bar')
			return expect(path.join).to.have.been.calledWithExactly(
				snapshotPath,
				'bar',
			)
		})
	})
})
