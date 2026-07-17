import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
	getPath,
	joinPath,
	basePath,
	assertNoEscapingSymlinks,
	resolveSafeStorePath,
	isRecord,
	isPositiveIntegerString,
	isValidNodeIdString,
	isValidOperation,
	applyOperation,
} from '../../api/lib/utils.ts'

declare let process: NodeJS.Process & {
	pkg?: boolean
}

describe('#utils', () => {
	describe('#getPath()', () => {
		afterEach(() => {
			delete process.pkg
		})

		it('write && process.pkg', () => {
			process.pkg = true
			expect(getPath(true)).to.equal(process.cwd())
		})
		it('write && !process.pkg', () => {
			delete process.pkg
			expect(getPath(true)).to.equal(basePath)
		})
		it('!write && process.pkg', () => {
			process.pkg = true
			expect(getPath(false)).to.equal(basePath)
		})
		it('!write && !process.pkg', () => {
			delete process.pkg
			expect(getPath(false)).to.equal(basePath)
		})
	})

	describe('#joinPath()', () => {
		afterEach(() => {
			delete process.pkg
		})

		it('passes string arguments straight to path.join', () => {
			expect(joinPath('foo', 'bar')).to.equal(nodePath.join('foo', 'bar'))
		})
		it('resolves a boolean first argument to the base path', () => {
			expect(joinPath(false, 'bar')).to.equal(
				nodePath.join(basePath, 'bar'),
			)
			expect(joinPath(true, 'bar')).to.equal(
				nodePath.join(basePath, 'bar'),
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
			await expect(
				assertNoEscapingSymlinks(root, root),
			).resolves.toBeUndefined()
		})

		it('allows a relative symlink pointing inside the root', async () => {
			await writeFile(nodePath.join(root, 'zwavejs_2024.log'), 'log')
			await symlink(
				'zwavejs_2024.log',
				nodePath.join(root, 'zwavejs_current.log'),
			)
			await expect(
				assertNoEscapingSymlinks(root, root),
			).resolves.toBeUndefined()
		})

		it('allows a relative in-root symlink nested in a subdirectory', async () => {
			await mkdir(nodePath.join(root, 'logs'))
			await writeFile(nodePath.join(root, 'logs', 'a.log'), 'log')
			await symlink('a.log', nodePath.join(root, 'logs', 'current.log'))
			await expect(
				assertNoEscapingSymlinks(root, root),
			).resolves.toBeUndefined()
		})

		it('rejects an absolute symlink escaping the root', async () => {
			await symlink('/etc/passwd', nodePath.join(root, 'settings.json'))
			await expect(assertNoEscapingSymlinks(root, root)).rejects.toThrow(
				/escaping the store/,
			)
		})

		it('rejects a relative symlink escaping the root via ..', async () => {
			await symlink('../../../../etc/passwd', nodePath.join(root, 'evil'))
			await expect(assertNoEscapingSymlinks(root, root)).rejects.toThrow(
				/escaping the store/,
			)
		})

		it('rejects an escaping symlink nested in a subdirectory', async () => {
			await mkdir(nodePath.join(root, 'nested'))
			await symlink('../../../etc', nodePath.join(root, 'nested', 'out'))
			await expect(assertNoEscapingSymlinks(root, root)).rejects.toThrow(
				/escaping the store/,
			)
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
				const dir = tmpDirs.pop()
				if (dir !== undefined) {
					await rm(dir, { recursive: true, force: true })
				}
			}
		})

		it('resolves a normal path within the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await mkdir(nodePath.join(store, 'sub'))
			await writeFile(nodePath.join(store, 'sub', 'a.json'), '{}')
			await expect(
				resolveSafeStorePath('sub/a.json', store),
			).resolves.toBe(nodePath.join(store, 'sub', 'a.json'))
		})

		it('allows a not-yet-existing path inside the store', async () => {
			// exercises the walk-up to the nearest existing ancestor (e.g. PUT
			// creating a new file/dir); neither newdir nor newfile.json exist
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath('newdir/newfile.json', store),
			).resolves.toBe(nodePath.join(store, 'newdir', 'newfile.json'))
		})

		it('rejects a non-string path', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath(undefined, store),
			).rejects.toThrow(/Invalid path/)
		})

		it('rejects a path equal to the store dir', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(resolveSafeStorePath('', store)).rejects.toThrow(
				/Path not allowed/,
			)
		})

		it('rejects a traversal path escaping the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await expect(
				resolveSafeStorePath('../../etc/passwd', store),
			).rejects.toThrow(/Path not allowed/)
		})

		it('rejects a symlinked component escaping the store', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/passwd', store),
			).rejects.toThrow(/Path not allowed/)
		})

		it('rejects a new path under a symlinked-escaping ancestor', async () => {
			// the escaping symlink is an existing ancestor of a not-yet-existing
			// target, so the walk-up must reject it rather than keep climbing
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/newdir/newfile.json', store),
			).rejects.toThrow(/Path not allowed/)
		})

		it('skips the symlink check when resolveReal is false', async () => {
			const store = await makeTmpDir('zui-safe-path-')
			await symlink('/etc', nodePath.join(store, 'evil'))
			await expect(
				resolveSafeStorePath('evil/passwd', store, false),
			).resolves.toBe(nodePath.join(store, 'evil', 'passwd'))
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
			).resolves.toBe(nodePath.join(linkedStore, 'settings.json'))
		})
	})

	describe('#isRecord()', () => {
		it('returns true for plain objects', () => {
			expect(isRecord({ key: 'value' })).to.equal(true)
		})

		it('returns false for arrays and null', () => {
			expect(isRecord([])).to.equal(false)
			expect(isRecord(null)).to.equal(false)
		})

		it('returns false for non-object primitives', () => {
			expect(isRecord(undefined)).to.equal(false)
			expect(isRecord('value')).to.equal(false)
			expect(isRecord(1)).to.equal(false)
			expect(isRecord(true)).to.equal(false)
		})
	})

	describe('#isPositiveIntegerString()', () => {
		it('returns true for base-10 positive integer strings', () => {
			expect(isPositiveIntegerString('1')).to.equal(true)
			expect(isPositiveIntegerString('42')).to.equal(true)
			expect(isPositiveIntegerString('9007199254740991')).to.equal(true)
		})

		it('returns false for non-decimal or non-positive values', () => {
			expect(isPositiveIntegerString('0')).to.equal(false)
			expect(isPositiveIntegerString('-1')).to.equal(false)
			expect(isPositiveIntegerString('0xd6aa1f93')).to.equal(false)
			expect(isPositiveIntegerString('2.5')).to.equal(false)
		})

		it('returns false for empty or whitespace values', () => {
			expect(isPositiveIntegerString('')).to.equal(false)
			expect(isPositiveIntegerString(' ')).to.equal(false)
		})

		it('returns false for numeric precision edge values', () => {
			expect(isPositiveIntegerString('9007199254740993')).to.equal(false)
		})

		it('returns false for non-string values', () => {
			expect(isPositiveIntegerString(undefined)).to.equal(false)
			expect(isPositiveIntegerString(null)).to.equal(false)
			expect(isPositiveIntegerString(1)).to.equal(false)
		})
	})

	describe('#isValidNodeIdString()', () => {
		it('returns true for node ids within the addressable range', () => {
			expect(isValidNodeIdString('1')).to.equal(true)
			expect(isValidNodeIdString('232')).to.equal(true)
			// Z-Wave Long Range node ids (up to MAX_NODES_LR = 4000)
			expect(isValidNodeIdString('1000')).to.equal(true)
			expect(isValidNodeIdString('4000')).to.equal(true)
		})

		it('returns false for values above the node id range', () => {
			expect(isValidNodeIdString('4001')).to.equal(false)
			// decimal home id never gets mistaken for a node id
			expect(isValidNodeIdString('3597893011')).to.equal(false)
		})

		it('returns false for non-node-id strings', () => {
			expect(isValidNodeIdString('0')).to.equal(false)
			expect(isValidNodeIdString('0xd6aa1f93')).to.equal(false)
			expect(isValidNodeIdString('')).to.equal(false)
			expect(isValidNodeIdString(5)).to.equal(false)
		})
	})

	describe('#isValidOperation()', () => {
		function callStringPredicateWithUnknown(
			predicate: (value: string) => boolean,
			value: unknown,
		): boolean {
			return Reflect.apply(predicate, undefined, [value])
		}

		it('accepts a single operator and number', () => {
			expect(isValidOperation('/10')).to.equal(true)
			expect(isValidOperation('*100')).to.equal(true)
			expect(isValidOperation('+20')).to.equal(true)
			expect(isValidOperation('-5')).to.equal(true)
		})
		it('accepts decimals, a signed operand and surrounding spaces', () => {
			expect(isValidOperation('/2.5')).to.equal(true)
			expect(isValidOperation('*-2')).to.equal(true)
			expect(isValidOperation(' / 10 ')).to.equal(true)
		})
		it('rejects empty, non-string and malformed operations', () => {
			expect(isValidOperation('')).to.equal(false)
			expect(
				callStringPredicateWithUnknown(isValidOperation, undefined),
			).to.equal(false)
			expect(isValidOperation('10')).to.equal(false)
			expect(isValidOperation('/')).to.equal(false)
		})
		it('rejects multiple operations and parentheses', () => {
			expect(isValidOperation('/10+5')).to.equal(false)
			expect(isValidOperation('(1+2)*3')).to.equal(false)
			expect(isValidOperation('/10,*2')).to.equal(false)
		})
		it('rejects anything that is not a number/operator', () => {
			expect(isValidOperation('process.exit(1)')).to.equal(false)
		})
	})

	describe('#applyOperation()', () => {
		it('applies each operator to a number', () => {
			expect(applyOperation(100, '/10')).to.equal(10)
			expect(applyOperation(2, '*100')).to.equal(200)
			expect(applyOperation(5, '+20')).to.equal(25)
			expect(applyOperation(5, '-2')).to.equal(3)
		})
		it('handles decimals and signed operands', () => {
			expect(applyOperation(5, '/2.5')).to.equal(2)
			expect(applyOperation(3, '*-2')).to.equal(-6)
		})
		it('returns non-numeric values untouched', () => {
			expect(applyOperation('foo', '/10')).to.equal('foo')
			expect(applyOperation('100', '/10')).to.equal('100')
			expect(applyOperation(true, '/10')).to.equal(true)
			expect(applyOperation(null, '/10')).to.equal(null)
		})
		it('returns the value on a malformed operation', () => {
			expect(applyOperation(100, '(1+2)*3')).to.equal(100)
			expect(applyOperation(100, '/10+5')).to.equal(100)
		})
		it('returns the value on a non-finite result (divide by zero)', () => {
			expect(applyOperation(100, '/0')).to.equal(100)
		})
	})
})
