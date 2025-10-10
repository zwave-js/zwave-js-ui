import chai, { expect } from 'chai'
import esmock from 'esmock'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'

import sinonChai from 'sinon-chai'

chai.use(sinonChai)

declare let process: NodeJS.Process & {
	pkg?: boolean
}
const snapshotPath = '/snapshot/zui'

describe('#utils', () => {
	describe('#getPath()', () => {
		let utils: any

		before(async () => {
			utils = await esmock('../../api/lib/utils.ts', {
				path: {
					resolve: () => snapshotPath,
					join: (...args: string[]) => args.join('/'),
				},
			})
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
		let pathMock: { join: SinonStub; resolve: () => string }
		let utils: any

		before(async () => {
			pathMock = {
				join: sinon.stub(),
				resolve: () => snapshotPath,
			}
			utils = await esmock('../../api/lib/utils.ts', {
				path: pathMock,
			})
		})

		it('zero length', () => {
			utils.joinPath()
			return expect(pathMock.join.callCount).to.equal(1)
		})
		it('1 length', () => {
			utils.joinPath('foo')
			return expect(pathMock.join).to.have.been.calledWith('foo')
		})
		it('first arg bool gets new path 0', () => {
			utils.joinPath(true, 'bar')
			return expect(pathMock.join).to.have.been.calledWithExactly(
				snapshotPath,
				'bar',
			)
		})
	})
})
