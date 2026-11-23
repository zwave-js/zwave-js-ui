import { describe, it, expect } from 'vitest'
import { getValueHint, isValidQRCodeString } from './utils.js'

describe('#getValueHint()', () => {
	it.each([
		[{ description: 'Level' }, 'Level'],
		[{ min: 0, max: 99 }, '(Min: 0, max: 99)'],
		[{ min: 0 }, '(Min: 0)'],
		[{ min: 5, max: 5 }, ''],
		[{ min: 0, max: 10, step: 1 }, '(Min: 0, max: 10)'],
		[
			{ description: 'LED', default: 0, min: 0, max: 10, step: 5 },
			'LED (Default: 0, min: 0, max: 10, step: 5)',
		],
		[{ description: 'Mode', list: true, min: 0, max: 10 }, 'Mode'],
		[
			{ list: true, allowManualEntry: true, default: 5, min: 0, max: 10 },
			'(Default: 5, min: 0, max: 10)',
		],
	])('%o -> %s', (valueId, hint) => {
		expect(getValueHint(valueId)).to.equal(hint)
	})
})

// Regression for #4909: zwave-js 15.32.4 (PR #9449) tolerates a float artifact
// such as ".9999999999999" at the end of the application version of some
// Heatit Z-TRM6 SmartStart QR codes. Manual entry in the UI must accept the
// same strings, otherwise the Confirm button stays disabled behind a frontend
// check that is stricter than the backend.
describe('#isValidQRCodeString()', () => {
	const validQrPrefix =
		'9001468690035152535455414243444531323334352122232425001004353015370220655200010000003577'

	it('accepts an all-digit SmartStart code', () => {
		expect(isValidQRCodeString(validQrPrefix)).to.equal(true)
	})

	it('accepts a tolerated float artifact after the DSK', () => {
		expect(isValidQRCodeString(`${validQrPrefix}.9999999999999`)).to.equal(
			true,
		)
	})

	it('rejects a non-digit character inside the DSK', () => {
		const badDsk =
			'900146869003515253545541424344.53132333435212223242500100435301537022065520001000000300578'
		expect(isValidQRCodeString(badDsk)).to.not.equal(true)
	})

	it('rejects short or non-90-prefixed codes', () => {
		expect(isValidQRCodeString('90')).to.not.equal(true)
		expect(isValidQRCodeString('1234567890')).to.not.equal(true)
		expect(isValidQRCodeString('not-a-qr-code')).to.not.equal(true)
	})
})
