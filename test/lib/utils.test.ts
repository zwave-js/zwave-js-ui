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

	describe('#isRecord()', () => {
		let utils: any

		before(async () => {
			utils = await esmock('../../api/lib/utils.ts')
		})

		it('returns true for plain objects', () => {
			expect(utils.isRecord({ key: 'value' })).to.equal(true)
		})

		it('returns false for arrays and null', () => {
			expect(utils.isRecord([])).to.equal(false)
			expect(utils.isRecord(null)).to.equal(false)
		})

		it('returns false for non-object primitives', () => {
			expect(utils.isRecord(undefined)).to.equal(false)
			expect(utils.isRecord('value')).to.equal(false)
			expect(utils.isRecord(1)).to.equal(false)
			expect(utils.isRecord(true)).to.equal(false)
		})
	})

	describe('#isPositiveIntegerString()', () => {
		let utils: any

		before(async () => {
			utils = await esmock('../../api/lib/utils.ts')
		})

		it('returns true for base-10 positive integer strings', () => {
			expect(utils.isPositiveIntegerString('1')).to.equal(true)
			expect(utils.isPositiveIntegerString('42')).to.equal(true)
			expect(utils.isPositiveIntegerString('9007199254740991')).to.equal(
				true,
			)
		})

		it('returns false for non-decimal or non-positive values', () => {
			expect(utils.isPositiveIntegerString('0')).to.equal(false)
			expect(utils.isPositiveIntegerString('-1')).to.equal(false)
			expect(utils.isPositiveIntegerString('0xd6aa1f93')).to.equal(false)
			expect(utils.isPositiveIntegerString('2.5')).to.equal(false)
		})

		it('returns false for empty or whitespace values', () => {
			expect(utils.isPositiveIntegerString('')).to.equal(false)
			expect(utils.isPositiveIntegerString(' ')).to.equal(false)
		})

		it('returns false for numeric precision edge values', () => {
			expect(utils.isPositiveIntegerString('9007199254740993')).to.equal(
				false,
			)
		})

		it('returns false for non-string values', () => {
			expect(utils.isPositiveIntegerString(undefined)).to.equal(false)
			expect(utils.isPositiveIntegerString(null)).to.equal(false)
			expect(utils.isPositiveIntegerString(1)).to.equal(false)
		})
	})
})
