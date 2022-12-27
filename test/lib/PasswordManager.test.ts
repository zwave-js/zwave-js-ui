import { expect } from 'chai'
import PasswordManager from '../../lib/PasswordManager'

describe('#PasswordManager', () => {
	it('should check if data is crypted', () => {
		const data = 'pippo'
		expect(PasswordManager.isEncrypted(data)).be.false
		const encrypt = PasswordManager.encrypt(data)
		return expect(PasswordManager.isEncrypted(encrypt)).be.true
	})

	it('should encrypt/decrypt data', () => {
		const data = 'pippo'
		const encrypt = PasswordManager.encrypt(data)
		const decrypt = PasswordManager.decrypt(encrypt)
		return expect(data).to.equal(decrypt)
	})

	it('should return the password when not encrypted', () => {
		const data = 'pippo'
		return expect(PasswordManager.decrypt(data)).be.equal(data)
	})
})
