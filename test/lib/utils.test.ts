import chai, { expect } from 'chai'
import esmock from 'esmock'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'

import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import { assertNoEscapingSymlinks } from '../../api/lib/utils.ts'

chai.use(sinonChai)
chai.use(chaiAsPromised)

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

	describe('#assertNoEscapingSymlinks()', () => {
		let root: string

		beforeEach(async () => {
			root = await mkdtemp(nodePath.join(tmpdir(), 'zui-symlink-test-'))
		})

		afterEach(async () => {
			await rm(root, { recursive: true, force: true })
		})

		it('resolves for a tree of only files and directories', async () => {
			await mkdir(nodePath.join(root, 'sub'))
			await writeFile(nodePath.join(root, 'sub', 'a.json'), '{}')
			await expect(assertNoEscapingSymlinks(root, root)).to.be.fulfilled
		})

		it('allows a relative symlink pointing inside the root', async () => {
			await writeFile(nodePath.join(root, 'zwavejs_2024.log'), 'log')
			await symlink(
				'zwavejs_2024.log',
				nodePath.join(root, 'zwavejs_current.log'),
			)
			await expect(assertNoEscapingSymlinks(root, root)).to.be.fulfilled
		})

		it('allows a relative in-root symlink nested in a subdirectory', async () => {
			await mkdir(nodePath.join(root, 'logs'))
			await writeFile(nodePath.join(root, 'logs', 'a.log'), 'log')
			await symlink('a.log', nodePath.join(root, 'logs', 'current.log'))
			await expect(assertNoEscapingSymlinks(root, root)).to.be.fulfilled
		})

		it('rejects an absolute symlink escaping the root', async () => {
			await symlink('/etc/passwd', nodePath.join(root, 'settings.json'))
			await expect(
				assertNoEscapingSymlinks(root, root),
			).to.be.rejectedWith(/escaping the store/)
		})

		it('rejects a relative symlink escaping the root via ..', async () => {
			await symlink('../../../../etc/passwd', nodePath.join(root, 'evil'))
			await expect(
				assertNoEscapingSymlinks(root, root),
			).to.be.rejectedWith(/escaping the store/)
		})

		it('rejects an escaping symlink nested in a subdirectory', async () => {
			await mkdir(nodePath.join(root, 'nested'))
			await symlink('../../../etc', nodePath.join(root, 'nested', 'out'))
			await expect(
				assertNoEscapingSymlinks(root, root),
			).to.be.rejectedWith(/escaping the store/)
		})
	})
})
