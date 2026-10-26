import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { generate } from 'selfsigned'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getTlsRejectionReason, loadCertKey } from '../../api/lib/tlsCert.ts'

const createCertificate = promisify(generate)

type Pair = Awaited<ReturnType<typeof createCertificate>>

const nodeMajor = Number(process.versions.node.split('.')[0])

async function fileMode(file: string) {
	return (await stat(file)).mode & 0o777
}

describe('#tlsCert', () => {
	let valid: Pair
	let other: Pair

	beforeAll(async () => {
		valid = await createCertificate([], { keySize: 2048 })
		other = await createCertificate([], { keySize: 2048 })
	})

	describe('#getTlsRejectionReason()', () => {
		it('accepts a valid 2048-bit pair', () => {
			expect(getTlsRejectionReason(valid.cert, valid.private)).to.equal(
				undefined,
			)
		})

		it('rejects a key that does not match the cert', () => {
			expect(getTlsRejectionReason(valid.cert, other.private)).to.be.a(
				'string',
			)
		})

		it('rejects input that is not PEM', () => {
			expect(getTlsRejectionReason('not a cert', 'not a key')).to.be.a(
				'string',
			)
		})

		// older Node.js releases still accept 1024-bit keys
		it.skipIf(nodeMajor < 24)('rejects a 1024-bit key', async () => {
			const weak = await createCertificate([], { keySize: 1024 })
			expect(getTlsRejectionReason(weak.cert, weak.private)).to.match(
				/key too small/,
			)
		})
	})

	describe('#loadCertKey()', () => {
		let dir: string
		let storeCert: string
		let storeKey: string

		beforeEach(async () => {
			dir = await mkdtemp(join(tmpdir(), 'zui-tls-'))
			storeCert = join(dir, 'cert.pem')
			storeKey = join(dir, 'key.pem')
		})

		afterEach(async () => {
			await rm(dir, { recursive: true, force: true })
		})

		it('returns an accepted stored pair untouched', async () => {
			await writeFile(storeCert, valid.cert)
			await writeFile(storeKey, valid.private)

			const pair = await loadCertKey(dir)

			expect(pair).to.deep.equal({ cert: valid.cert, key: valid.private })
		})

		it('generates and saves a pair when the store has none', async () => {
			const pair = await loadCertKey(dir)

			expect(getTlsRejectionReason(pair.cert, pair.key)).to.equal(
				undefined,
			)
			expect(await readFile(storeCert, 'utf8')).to.equal(pair.cert)
			expect(await readFile(storeKey, 'utf8')).to.equal(pair.key)
			expect(await fileMode(storeKey)).to.equal(0o600)
		})

		it('restricts an existing key file it overwrites', async () => {
			await writeFile(storeKey, 'stale', { mode: 0o644 })
			await chmod(storeKey, 0o644)

			await loadCertKey(dir)

			expect(await fileMode(storeKey)).to.equal(0o600)
		})

		// older Node.js releases still accept 1024-bit keys
		it.skipIf(nodeMajor < 24)(
			'regenerates a stored 1024-bit pair',
			async () => {
				const weak = await createCertificate([], { keySize: 1024 })
				await writeFile(storeCert, weak.cert)
				await writeFile(storeKey, weak.private)

				const pair = await loadCertKey(dir)

				expect(getTlsRejectionReason(pair.cert, pair.key)).to.equal(
					undefined,
				)
				expect(await readFile(`${storeKey}.bak`, 'utf8')).to.equal(
					weak.private,
				)
			},
		)

		it('moves a rejected stored pair to .bak and regenerates it', async () => {
			await writeFile(storeCert, valid.cert)
			await writeFile(storeKey, other.private)

			const pair = await loadCertKey(dir)

			expect(getTlsRejectionReason(pair.cert, pair.key)).to.equal(
				undefined,
			)
			expect(await readFile(`${storeCert}.bak`, 'utf8')).to.equal(
				valid.cert,
			)
			expect(await readFile(`${storeKey}.bak`, 'utf8')).to.equal(
				other.private,
			)
			expect(await readFile(storeKey, 'utf8')).to.equal(pair.key)
			expect(await fileMode(storeKey)).to.equal(0o600)
		})

		it('still serves a new pair when the store is not writable', async () => {
			const pair = await loadCertKey(join(dir, 'missing'))

			expect(getTlsRejectionReason(pair.cert, pair.key)).to.equal(
				undefined,
			)
		})

		it('throws on a rejected custom pair and leaves it alone', async () => {
			const certFile = join(dir, 'custom-cert.pem')
			const keyFile = join(dir, 'custom-key.pem')
			await writeFile(certFile, valid.cert)
			await writeFile(keyFile, other.private)

			await expect(loadCertKey(dir, certFile, keyFile)).rejects.toThrow(
				/not accepted by Node.js/,
			)
			expect(await readFile(keyFile, 'utf8')).to.equal(other.private)
			await expect(stat(storeCert)).rejects.toThrow()
		})

		it('throws on a missing custom file', async () => {
			const certFile = join(dir, 'custom-cert.pem')
			await writeFile(certFile, valid.cert)

			await expect(
				loadCertKey(dir, certFile, join(dir, 'missing-key.pem')),
			).rejects.toThrow(/Cannot read cert/)
			await expect(stat(storeCert)).rejects.toThrow()
		})

		it('throws on an empty custom file', async () => {
			const certFile = join(dir, 'custom-cert.pem')
			const keyFile = join(dir, 'custom-key.pem')
			await writeFile(certFile, valid.cert)
			await writeFile(keyFile, '')

			await expect(loadCertKey(dir, certFile, keyFile)).rejects.toThrow(
				/is empty/,
			)
			await expect(stat(storeCert)).rejects.toThrow()
		})

		it('throws when only one custom path is set', async () => {
			const certFile = join(dir, 'custom-cert.pem')
			await writeFile(certFile, valid.cert)

			await expect(loadCertKey(dir, certFile)).rejects.toThrow(/Set both/)
			await expect(stat(storeCert)).rejects.toThrow()
		})
	})
})
