import chai, { expect } from 'chai'
import esmock from 'esmock'
import type { SinonStub } from 'sinon'
import sinon from 'sinon'

import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import {
	mkdtemp,
	mkdir,
	writeFile,
	symlink,
	rm,
	realpath,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import {
	assertNoEscapingSymlinks,
	resolveSafeStorePath,
} from '../../api/lib/utils.ts'

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

	describe('#resolveSafeStorePath()', () => {
		const tmpDirs: string[] = []

		// canonical (symlink-free) store dir so the base path itself never
		// triggers the symlink-confinement logic in the "happy path" tests
		async function makeTmpDir(prefix: string): Promise<string> {
			const dir = await realpath(
				await mkdtemp(nodePath.join(tmpdir(), prefix)),
			)
			tmpDirs.push(dir)
			return dir
		}

		afterEach(async () => {
			while (tmpDirs.length) {
				await rm(tmpDirs.pop(), { recursive: true, force: true })
			}
		})

		it('resolves a normal path within the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await mkdir(nodePath.join(store, 'sub'))
			await writeFile(nodePath.join(store, 'sub', 'a.json'), '{}')
			await expect(
				resolveSafeStorePath('sub/a.json', store),
			).to.eventually.equal(nodePath.join(store, 'sub', 'a.json'))
		})

		it('allows a not-yet-existing path inside the store', async () => {
			// exercises the walk-up to the nearest existing ancestor (e.g. PUT
			// creating a new file/dir); neither newdir nor newfile.json exist
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath('newdir/newfile.json', store),
			).to.eventually.equal(
				nodePath.join(store, 'newdir', 'newfile.json'),
			)
		})

		it('rejects a non-string path', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath(undefined, store),
			).to.be.rejectedWith(/Invalid path/)
		})

		it('rejects a path equal to the store dir', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(resolveSafeStorePath('', store)).to.be.rejectedWith(
				/Path not allowed/,
			)
		})

		it('rejects a traversal path escaping the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath('../../etc/passwd', store),
			).to.be.rejectedWith(/Path not allowed/)
		})

		it('rejects a symlinked component escaping the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/passwd', store),
			).to.be.rejectedWith(/Path not allowed/)
		})

		it('rejects a new path under a symlinked-escaping ancestor', async () => {
			// the escaping symlink is an existing ancestor of a not-yet-existing
			// target, so the walk-up must reject it rather than keep climbing
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/newdir/newfile.json', store),
			).to.be.rejectedWith(/Path not allowed/)
		})

		it('skips the symlink check when resolveReal is false', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/passwd', store, false),
			).to.eventually.equal(nodePath.join(store, 'evil', 'passwd'))
		})

		// Regression: the store dir itself may be reached through a symlink
		// (bind-mounted data dirs, symlinked $HOME, /tmp -> /private/tmp, ...).
		// A resolved target must be compared against the *resolved* store root,
		// otherwise every legitimate path is rejected on such setups.
		it('allows a path when the store dir is reached through a symlink', async () => {
			const realStore = await makeTmpDir('zui-safe-path-real-')
			const linkParent = await makeTmpDir('zui-safe-path-link-')
			const linkedStore = nodePath.join(linkParent, 'store-link')
			await symlink(realStore, linkedStore)
			await writeFile(nodePath.join(realStore, 'settings.json'), '{}')

			await expect(
				resolveSafeStorePath('settings.json', linkedStore),
			).to.eventually.equal(nodePath.join(linkedStore, 'settings.json'))
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

	describe('#isValidNodeIdString()', () => {
		let utils: any

		before(async () => {
			utils = await esmock('../../api/lib/utils.ts')
		})

		it('returns true for node ids within the addressable range', () => {
			expect(utils.isValidNodeIdString('1')).to.equal(true)
			expect(utils.isValidNodeIdString('232')).to.equal(true)
			// Z-Wave Long Range node ids (up to MAX_NODES_LR = 4000)
			expect(utils.isValidNodeIdString('1000')).to.equal(true)
			expect(utils.isValidNodeIdString('4000')).to.equal(true)
		})

		it('returns false for values above the node id range', () => {
			expect(utils.isValidNodeIdString('4001')).to.equal(false)
			// decimal home id never gets mistaken for a node id
			expect(utils.isValidNodeIdString('3597893011')).to.equal(false)
		})

		it('returns false for non-node-id strings', () => {
			expect(utils.isValidNodeIdString('0')).to.equal(false)
			expect(utils.isValidNodeIdString('0xd6aa1f93')).to.equal(false)
			expect(utils.isValidNodeIdString('')).to.equal(false)
			expect(utils.isValidNodeIdString(5)).to.equal(false)
		})
	})

	describe('#isValidOperation()', () => {
		let utilsModule: any

		before(async () => {
			utilsModule = await esmock('../../api/lib/utils.ts')
		})

		it('accepts a single operator and number', () => {
			expect(utilsModule.isValidOperation('/10')).to.equal(true)
			expect(utilsModule.isValidOperation('*100')).to.equal(true)
			expect(utilsModule.isValidOperation('+20')).to.equal(true)
			expect(utilsModule.isValidOperation('-5')).to.equal(true)
		})
		it('accepts decimals, a signed operand and surrounding spaces', () => {
			expect(utilsModule.isValidOperation('/2.5')).to.equal(true)
			expect(utilsModule.isValidOperation('*-2')).to.equal(true)
			expect(utilsModule.isValidOperation(' / 10 ')).to.equal(true)
		})
		it('rejects empty, non-string and malformed operations', () => {
			expect(utilsModule.isValidOperation('')).to.equal(false)
			expect(utilsModule.isValidOperation(undefined)).to.equal(false)
			expect(utilsModule.isValidOperation('10')).to.equal(false)
			expect(utilsModule.isValidOperation('/')).to.equal(false)
		})
		it('rejects multiple operations and parentheses', () => {
			expect(utilsModule.isValidOperation('/10+5')).to.equal(false)
			expect(utilsModule.isValidOperation('(1+2)*3')).to.equal(false)
			expect(utilsModule.isValidOperation('/10,*2')).to.equal(false)
		})
		it('rejects anything that is not a number/operator', () => {
			expect(utilsModule.isValidOperation('process.exit(1)')).to.equal(
				false,
			)
		})
	})

	describe('#applyOperation()', () => {
		let utilsModule: any

		before(async () => {
			utilsModule = await esmock('../../api/lib/utils.ts')
		})

		it('applies each operator to a number', () => {
			expect(utilsModule.applyOperation(100, '/10')).to.equal(10)
			expect(utilsModule.applyOperation(2, '*100')).to.equal(200)
			expect(utilsModule.applyOperation(5, '+20')).to.equal(25)
			expect(utilsModule.applyOperation(5, '-2')).to.equal(3)
		})
		it('handles decimals and signed operands', () => {
			expect(utilsModule.applyOperation(5, '/2.5')).to.equal(2)
			expect(utilsModule.applyOperation(3, '*-2')).to.equal(-6)
		})
		it('returns non-numeric values untouched', () => {
			expect(utilsModule.applyOperation('foo', '/10')).to.equal('foo')
			expect(utilsModule.applyOperation('100', '/10')).to.equal('100')
			expect(utilsModule.applyOperation(true, '/10')).to.equal(true)
			expect(utilsModule.applyOperation(null, '/10')).to.equal(null)
		})
		it('returns the value on a malformed operation', () => {
			expect(utilsModule.applyOperation(100, '(1+2)*3')).to.equal(100)
			expect(utilsModule.applyOperation(100, '/10+5')).to.equal(100)
		})
		it('returns the value on a non-finite result (divide by zero)', () => {
			expect(utilsModule.applyOperation(100, '/0')).to.equal(100)
		})
	})
})
