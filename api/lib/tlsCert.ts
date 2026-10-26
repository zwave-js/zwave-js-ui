import { chmod, readFile, rename, writeFile } from 'node:fs/promises'
import { createSecureContext } from 'node:tls'
import { promisify } from 'node:util'
import { generate } from 'selfsigned'
import { module } from './logger.ts'
import { joinPath } from './utils.ts'

const logger = module('App')

const createCertificate = promisify(generate)

/**
 * Get the reason Node.js refuses to serve TLS with this cert and key
 * (e.g. key too small, key not matching the cert), or undefined if it accepts them
 */
export function getTlsRejectionReason(
	cert: string,
	key: string,
): string | undefined {
	try {
		// same check https.createServer runs
		createSecureContext({ cert, key })
		return undefined
	} catch (error) {
		return error.message
	}
}

/**
 * Load the HTTPS cert and key from the custom paths, or from the store,
 * generating a self-signed pair there when missing or rejected by Node.js.
 * Throws when a custom pair can't be read or is rejected.
 * Returns an undefined pair when a new one can't be generated.
 */
export async function loadCertKey(
	storeDir: string,
	customCertFile?: string,
	customKeyFile?: string,
): Promise<{
	cert: string
	key: string
}> {
	if (Boolean(customCertFile) !== Boolean(customKeyFile)) {
		throw new Error('Set both SSL_CERTIFICATE and SSL_KEY, or neither')
	}

	const customPaths = !!customCertFile
	const storeCertFile = joinPath(storeDir, 'cert.pem')
	const storeKeyFile = joinPath(storeDir, 'key.pem')
	const certFile = customCertFile || storeCertFile
	const keyFile = customKeyFile || storeKeyFile

	let key: string
	let cert: string

	try {
		cert = await readFile(certFile, 'utf8')
		key = await readFile(keyFile, 'utf8')
	} catch (error) {
		if (customPaths) {
			// fail closed: never swap the operator's cert or serve plain HTTP instead
			throw new Error(
				`Cannot read cert ${certFile} and key ${keyFile}: ${error.message}`,
			)
		}
	}

	if (customPaths && (!cert || !key)) {
		throw new Error(`Cert ${certFile} or key ${keyFile} is empty`)
	}

	const rejection = cert && key ? getTlsRejectionReason(cert, key) : undefined

	if (cert && key && !rejection) {
		return { cert, key }
	}

	if (rejection && customPaths) {
		throw new Error(
			`Cert ${certFile} and key ${keyFile} are not accepted by Node.js: ${rejection}. RSA keys need at least 2048 bits and the key must match the cert, or unset SSL_CERTIFICATE and SSL_KEY to use a generated self-signed pair`,
		)
	}

	if (rejection) {
		// e.g. 1024-bit pairs generated before v9.29.0, rejected since Node 24
		logger.warn(
			`Stored cert and key are not accepted by Node.js (${rejection}), moving them to .bak and generating new ones...`,
		)
	} else {
		logger.info(
			'Cert and key not found in store, generating fresh new ones...',
		)
	}

	try {
		const result = await createCertificate([], {
			days: 99999,
			keySize: 2048,
		})

		key = result.private
		cert = result.cert
	} catch (error) {
		logger.error('Error creating cert and key for HTTPS', error)
		return { cert: undefined, key: undefined }
	}

	try {
		if (rejection) {
			// the rejected pair may be a cert the user placed in the store
			await rename(storeCertFile, `${storeCertFile}.bak`)
			await rename(storeKeyFile, `${storeKeyFile}.bak`)
		}
		// restrict the private key (and cert) to the owner so a permissive
		// umask can't leave the self-signed TLS key world/group-readable
		await writeFile(storeCertFile, cert, { mode: 0o600 })
		await writeFile(storeKeyFile, key, { mode: 0o600 })
		// mode only applies when writeFile creates the file
		await chmod(storeKeyFile, 0o600)
		logger.info('New cert and key created')
	} catch (error) {
		logger.warn(
			'Cannot save the new cert and key to store, they will be regenerated on next start',
			error,
		)
	}

	return { cert, key }
}
