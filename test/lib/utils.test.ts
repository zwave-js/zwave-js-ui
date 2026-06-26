import { describe, it, expect, afterEach } from 'vitest'
import nodePath from 'node:path'
import { getPath, joinPath, basePath } from '../../api/lib/utils.ts'

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
})
