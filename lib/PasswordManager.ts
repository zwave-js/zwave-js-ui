import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { module } from './logger'
import { sessionSecret } from '../config/app'

const logger = module('PASSWORD')

export default class PasswordManager {
	private static PREFIX_CRYPT = '$zui_crypt_'

	private static algorithm = 'aes-256-cbc'

	private static key = sessionSecret

	static encrypt(data: string): string {
		try {
			if (!data) {
				throw new Error('Provided string is null or undefined')
			}

			// generate 16 bytes of random data
			const initVector = randomBytes(16)

			// the cipher function
			const cipher = createCipheriv(
				this.algorithm,
				Buffer.from(this.key),
				initVector
			)

			const encryptedData = cipher.update(data, 'utf-8')
			const encryptedHex = Buffer.concat([encryptedData, cipher.final()])

			return (
				PasswordManager.PREFIX_CRYPT +
				this.base64Encode(
					JSON.stringify({
						iv: initVector.toString('hex'),
						encryptedData: encryptedHex.toString('hex'),
					})
				)
			)
		} catch (error) {
			logger.error(error, 'Unable to encrypt')
			throw Error(error)
		}
	}

	static decrypt(data: string): string {
		try {
			// back compatibility: if prefix not present means that the password is in clear (not encrypted)
			if (!this.isEncrypted(data)) {
				return data
			}

			data = data.replace(PasswordManager.PREFIX_CRYPT, '')
			const decodedData = JSON.parse(this.base64Decode(data))
			const iv = Buffer.from(decodedData.iv, 'hex')

			const encryptedText = Buffer.from(decodedData.encryptedData, 'hex')
			const decipher = createDecipheriv(
				this.algorithm,
				Buffer.from(this.key),
				iv
			)
			let decrypted = decipher.update(encryptedText)
			decrypted = Buffer.concat([decrypted, decipher.final()])
			return decrypted.toString()
		} catch (error) {
			logger.error(error, 'Unable to decrypt')
			throw error
		}
	}

	static base64Encode(data: string): string {
		return Buffer.from(data).toString('base64')
	}

	static base64Decode(data: string): string {
		return Buffer.from(data, 'base64').toString('utf-8')
	}

	static isEncrypted(data: string): boolean {
		return data?.startsWith(PasswordManager.PREFIX_CRYPT)
	}
}
