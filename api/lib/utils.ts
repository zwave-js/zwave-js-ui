import type { PartialZWaveOptions, ValueID, ZnifferOptions } from 'zwave-js'
import path, { resolve } from 'node:path'
import crypto from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import type { ZwaveConfig } from './ZwaveClient.ts'
import { isUint8Array } from 'node:util/types'
import { createRequire } from 'node:module'
import { mkdir, access, readdir, readlink, realpath } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import tripleBeam from 'triple-beam'
import { MAX_NODES_LR } from '@zwave-js/core'
import type { BytesView } from '@zwave-js/shared'
import { hasErrorCode } from './errors.ts'

const loglevels = tripleBeam.configs.npm.levels

// don't use import here, it will break the build
const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

let VERSION: string

export const pkgJson = pkg

export interface Snippet {
	name: string
	content: string
}

// Bottoms out at non-object types (primitives, functions, class instances) instead of recursing into their prototype members, since `keyof` on those produces a nonsensical mapped type
export type DeepPartial<T> = T extends (...args: never[]) => unknown
	? T
	: T extends Array<infer U>
		? Array<DeepPartial<U>>
		: T extends ReadonlyArray<infer U>
			? ReadonlyArray<DeepPartial<U>>
			: T extends object
				? { [P in keyof T]?: DeepPartial<T[P]> }
				: T

export interface ErrnoException extends Error {
	errno?: number
	code?: string
	path?: string
	syscall?: string
	stack?: string
}

export type Constructor<T = object> = new (...args: any[]) => T

export function applyMixin(
	target: Constructor,
	mixin: Constructor,
	includeConstructor = false,
): void {
	// Figure out the inheritance chain of the mixin
	const inheritanceChain: Constructor[] = [mixin]

	while (true) {
		const current = inheritanceChain[0]
		const base = Object.getPrototypeOf(current)
		if (base?.prototype) {
			inheritanceChain.unshift(base)
		} else {
			break
		}
	}
	for (const ctor of inheritanceChain) {
		for (const prop of Object.getOwnPropertyNames(ctor.prototype)) {
			// Do not override the constructor
			if (includeConstructor || prop !== 'constructor') {
				Object.defineProperty(
					target.prototype,
					prop,
					Object.getOwnPropertyDescriptor(ctor.prototype, prop) ??
						Object.create(null),
				)
			}
		}
	}
}

export function padNumber(num: number, digits: number): string {
	return num ? num.toString().padStart(digits, '0') : 'unknown'
}

export function deepEqual(a: any, b: any) {
	return JSON.stringify(a) === JSON.stringify(b)
}

export function fileDate(date?: Date) {
	date = date || new Date()
	return date.toISOString().slice(-24).replace(/\D/g, '').slice(0, 14)
}

export const __filename = fileURLToPath(new URL('', import.meta.url))
export const __dirname = path.dirname(__filename)

export const basePath = __filename.endsWith('index.js')
	? resolve(__dirname) // esbuild bundle
	: resolve(__dirname, '..', '..')

/**
 *  Get the base root path to application directory. When we are in a `pkg` environment
 *  the path of the snapshot is not writable
 */
export function getPath(write: boolean): string {
	if (write && hasProperty(process, 'pkg')) return process.cwd()
	else return basePath
}

/**
 * path.join wrapper, the first option can be a boolean and it will automatically fetch the root path
 * passing the boolean to getPath
 */
export function joinPath(write: boolean | string, ...paths: string[]): string {
	if (typeof write === 'boolean') {
		write = getPath(write)
	}
	return path.join(write, ...paths)
}

/**
 * Join props with a `_` and skips undefined props
 */
export function joinProps(...props: (string | number)[]): string {
	props = props || []
	let ret = props[0].toString() || ''
	for (let i = 1; i < props.length; i++) {
		const p = props[i]
		if (p !== null && p !== undefined && p !== '') {
			ret += '_' + (typeof p === 'number' ? p.toString() : p)
		}
	}
	return ret
}

/**
 * Checks if an object is a valueId, returns error otherwise
 */
export function isValueId(v: ValueID): boolean | string {
	if (typeof v.commandClass !== 'number' || v.commandClass < 0) {
		return 'invalid `commandClass`'
	}
	if (v.endpoint !== undefined && v.endpoint < 0) {
		return 'invalid `endpoint`'
	}
	if (
		v.property === undefined ||
		(typeof v.property !== 'string' && typeof v.property !== 'number')
	) {
		return 'invalid `property`'
	}
	if (
		v.propertyKey !== undefined &&
		typeof v.propertyKey !== 'string' &&
		typeof v.propertyKey !== 'number'
	) {
		return 'invalid `propertyKey`'
	}
	return true
}

/**
 * Deep copy of an object
 */
export function copy<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj))
}

/**
 * Converts a decimal to an hex number of 4 digits and `0x` as prefix
 */
export function num2hex(num: number): string {
	const hex = num >= 0 ? num.toString(16) : 'XXXX'
	return '0x' + '0'.repeat(4 - hex.length) + hex
}

/**
 * Gets the actual package.json version with also the git revision number at the end of it
 */
export function getVersion(): string {
	if (!VERSION) {
		try {
			// try to get short sha of last commit
			let rev = readFileSync('.git/HEAD').toString().trim()
			if (rev.indexOf(':') !== -1) {
				rev = readFileSync('.git/' + rev.substring(5))
					.toString()
					.trim()
			}

			VERSION = `${pkg.version}${rev ? '.' + rev.substring(0, 7) : ''}`
		} catch {
			VERSION = pkg.version
		}
	}

	return VERSION
}

/**
 * Sanitize chars of a string to use in a topic
 *
 */
export function sanitizeTopic(
	str: string | number,
	sanitizeSlash = false,
): string {
	if (typeof str === 'number' || !str) return str.toString()

	if (sanitizeSlash) {
		str = removeSlash(str)
	}

	// replace spaces with '_'
	str = str.replace(/\s/g, '_')
	// remove special chars
	return str.replace(/[^A-Za-z0-9-_À-ÖØ-öø-ÿ/]/g, '')
}

/**
 * Removes `/` chars from strings
 */
export function removeSlash(str: string | number): string {
	return typeof str === 'number' ? str.toString() : str.replace(/\//g, '-')
}

/**
 * Check if an object has a property
 */
export function hasProperty(obj: Record<string, any>, prop: string): boolean {
	return Object.prototype.hasOwnProperty.call(obj, prop)
}

/**
 * Check if a value is a non-array object
 */
export function isRecord(value: unknown): value is Record<string, any> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check if a value is a base-10 positive integer string
 */
export function isPositiveIntegerString(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false
	}

	if (!/^\d+$/.test(value)) {
		return false
	}

	const number = Number(value)
	return Number.isSafeInteger(number) && number > 0
}

/**
 * Check if a value is a string holding a valid Z-Wave node id, i.e. a positive
 * integer within the addressable range (1..MAX_NODES_LR). Used to tell node-id
 * keys apart from home-id keys when importing a `nodes.json` backup: node ids
 * are at most 4 digits (Long Range tops out at 4000) while home ids are larger
 * (8 hex digits, or a ~10-digit decimal).
 */
export function isValidNodeIdString(value: unknown): boolean {
	return isPositiveIntegerString(value) && Number(value) <= MAX_NODES_LR
}

/**
 * Gets the size in a human readable form starting from bytes
 */
export function humanSize(bytes: number): string {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

	if (bytes === 0) {
		return 'n/a'
	}

	const i = Math.floor(Math.log(bytes) / Math.log(1024))

	if (i === 0) {
		return bytes + ' ' + sizes[i]
	}

	return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
}

export async function hashPsw(password: crypto.BinaryLike): Promise<string> {
	return new Promise((resolve, reject) => {
		const salt = crypto.randomBytes(8).toString('hex')

		crypto.scrypt(password, salt, 64, (err, derivedKey) => {
			if (err) reject(err)
			resolve(salt + ':' + derivedKey.toString('hex'))
		})
	})
}

export async function verifyPsw(
	password: crypto.BinaryLike,
	hash: string,
): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const [salt, key] = hash.split(':')
		crypto.scrypt(password, salt, 64, (err, derivedKey) => {
			if (err) reject(err)
			resolve(key === derivedKey.toString('hex'))
		})
	})
}

/**
 * Checks if a string is a hex buffer
 */
export function isBufferAsHex(str: string): boolean {
	return /^0x([a-fA-F0-9]{2})+$/.test(str)
}

/**
 * Parses a buffer from a string has the form 0x[a-f0-9]+
 */
export function bufferFromHex(hex: string): Buffer {
	return Buffer.from(hex.substr(2), 'hex')
}

/**
 * Converts a buffer to an hex string
 */
export function buffer2hex(buffer: Uint8Array): string {
	if (buffer.length === 0) return ''
	return `0x${Buffer.from(buffer).toString('hex')}`
}

export function generateId(): string {
	return crypto.randomBytes(6).toString('hex')
}

export function allSettled(promises: Promise<any>[]): Promise<any> {
	const wrappedPromises = promises.map((p) =>
		Promise.resolve(p).then(
			(val) => ({ status: 'fulfilled', value: val }),
			(err) => ({ status: 'rejected', reason: err }),
		),
	)
	return Promise.all(wrappedPromises)
}

/** Parses a string to json with buffer decode support */
export function parseJSON(str: string): any {
	return JSON.parse(str, (k, v) => {
		if (
			v !== null &&
			typeof v === 'object' &&
			'type' in v &&
			v.type === 'Buffer' &&
			'data' in v &&
			Array.isArray(v.data)
		) {
			return Buffer.from(v.data)
		}
		return v
	})
}

/**
 * Correctly stringify a JSON object with uint8array support
 */
export function stringifyJSON(obj: any): string {
	return JSON.stringify(obj, (k, v) => {
		if (isUint8Array(v)) {
			return {
				type: 'Buffer',
				data: Array.from(v.values()),
			}
		}
		return v
	})
}

type SecurityKeyName = keyof NonNullable<ZwaveConfig['securityKeys']>
type SecurityKeyLongRangeName = keyof NonNullable<
	ZwaveConfig['securityKeysLongRange']
>

function isKeyOf<T extends string>(
	key: string,
	allowed: readonly T[],
): key is T {
	return (allowed as readonly string[]).includes(key)
}

export function parseSecurityKeys(
	config: ZwaveConfig,
	options: PartialZWaveOptions | ZnifferOptions,
): void {
	config.securityKeys = config.securityKeys || {}
	// Setting a KEY_LR_* env var without a persisted securityKeysLongRange map throws below instead of silently creating one (see #4736)

	if (process.env.NETWORK_KEY) {
		config.securityKeys.S0_Legacy = process.env.NETWORK_KEY
	}

	const availableKeys: readonly SecurityKeyName[] = [
		'S2_Unauthenticated',
		'S2_Authenticated',
		'S2_AccessControl',
		'S0_Legacy',
	]
	const availableLongRangeKeys: readonly SecurityKeyLongRangeName[] = [
		'S2_Authenticated',
		'S2_AccessControl',
	]

	const envKeys = Object.keys(process.env)
		.filter((k) => k?.startsWith('KEY_'))
		.map((k) => k.substring(4))

	const longRangeEnvKeys = Object.keys(process.env)
		.filter((k) => k?.startsWith('KEY_LR_'))
		.map((k) => k.substring(7))

	// load security keys from env
	for (const k of envKeys) {
		if (isKeyOf(k, availableKeys)) {
			config.securityKeys[k] = process.env[`KEY_${k}`]
		}
	}
	// load long range security keys from env
	for (const k of longRangeEnvKeys) {
		if (isKeyOf(k, availableLongRangeKeys)) {
			if (!config.securityKeysLongRange) {
				// Throws to characterize the missing-map failure instead of fixing it (see #4736)
				throw new TypeError(
					`Cannot set Long Range security key '${k}' from env var 'KEY_LR_${k}': ` +
						"no 'zwave.securityKeysLongRange' object exists in the persisted settings. " +
						'Configure at least one Long Range security key via the UI first.',
				)
			}
			config.securityKeysLongRange[k] = process.env[`KEY_LR_${k}`]
		}
	}

	const securityKeys: Partial<Record<SecurityKeyName, BytesView>> = {}

	// convert security keys to buffer
	for (const key in config.securityKeys) {
		if (isKeyOf(key, availableKeys)) {
			const value = config.securityKeys[key]
			// A persisted null value throws explicitly here instead of the incidental TypeError value?.length used to silently avoid (see #4736)
			if (value === null) {
				throw new TypeError(
					`config.securityKeys.${key} is null; remove the key entirely instead of persisting it as null`,
				)
			}
			if (value?.length === 32) {
				securityKeys[key] = Buffer.from(value, 'hex')
			}
		}
	}

	options.securityKeys = securityKeys

	// Defaulted only immediately before this loop, matching the pre-existing ordering where the earlier KEY_LR_* loop is the only path that can hit the missing-map failure
	config.securityKeysLongRange = config.securityKeysLongRange || {}

	const securityKeysLongRange: Partial<
		Record<SecurityKeyLongRangeName, BytesView>
	> = {}

	// convert long range security keys to buffer
	for (const key in config.securityKeysLongRange) {
		if (isKeyOf(key, availableLongRangeKeys)) {
			const value = config.securityKeysLongRange[key]
			// Same null-value behavior as securityKeys above (see #4736)
			if (value === null) {
				throw new TypeError(
					`config.securityKeysLongRange.${key} is null; remove the key entirely instead of persisting it as null`,
				)
			}
			if (value?.length === 32) {
				securityKeysLongRange[key] = Buffer.from(value, 'hex')
			}
		}
	}

	options.securityKeysLongRange = securityKeysLongRange
}

function hasDockerEnv() {
	try {
		statSync('/.dockerenv')
		return true
	} catch {
		return false
	}
}

function hasDockerCGroup() {
	try {
		return readFileSync('/proc/self/cgroup', 'utf8').includes('docker')
	} catch {
		return false
	}
}

let isDockerCached: boolean

export function isDocker(): boolean {
	isDockerCached ??= hasDockerEnv() || hasDockerCGroup()
	return isDockerCached
}

/**
 * Ensures that a directory exists. If the directory does not exist, it creates it recursively.
 * @param dir The directory path to ensure
 */
export async function ensureDir(dir: string): Promise<void> {
	try {
		await mkdir(dir, { recursive: true })
	} catch (err) {
		// Ignore error if directory already exists
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
			throw err
		}
	}
}

/**
 * Synchronously ensures that a directory exists. If the directory does not exist, it creates it recursively.
 * @param dir The directory path to ensure
 */
export function ensureDirSync(dir: string): void {
	const { mkdirSync } = require('node:fs')
	try {
		mkdirSync(dir, { recursive: true })
	} catch (err) {
		// Ignore error if directory already exists
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
			throw err
		}
	}
}

/**
 * Checks if a file or directory exists
 * @param path The path to check
 * @returns Promise that resolves to true if the path exists, false otherwise
 */
export async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

/**
 * Convert scales configuration to preferences format for Z-Wave driver options
 * This converts the array format used in our settings to the Record format expected by the driver
 */
export function buildPreferences(
	config: ZwaveConfig,
): PartialZWaveOptions['preferences'] {
	const { scales } = config
	if (!scales || scales.length === 0) {
		return undefined
	}

	const scalesRecord: Record<string | number, string | number> = {}
	for (const s of scales) {
		scalesRecord[s.key] = s.label
	}

	return {
		scales: scalesRecord,
	}
}

/**
 * Throw if any symlink under `dir` resolves outside `root`. Targets are
 * resolved literally (not followed), so dangling links work and the walk
 * never leaves `root`. Permits in-store links (e.g. `*_current.log`).
 */
export async function assertNoEscapingSymlinks(
	dir: string,
	root: string,
): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true })

	for (const entry of entries) {
		const full = path.join(dir, entry.name)

		if (entry.isSymbolicLink()) {
			const target = await readlink(full)
			const resolved = path.resolve(path.dirname(full), target)

			if (resolved !== root && !resolved.startsWith(root + path.sep)) {
				throw Error(
					`Archive contains a symlink escaping the store: ${entry.name}`,
				)
			}
		} else if (entry.isDirectory()) {
			await assertNoEscapingSymlinks(full, root)
		}
	}
}

/**
 * Resolve the real path of the nearest existing ancestor of `target` and
 * ensure it is still confined within `storeDir`. This defeats symlinked
 * path components (which a plain string prefix check is blind to) for both
 * existing and not-yet-created paths.
 *
 * The comparison is made against the *resolved* `storeDir` because the
 * configured store path may itself traverse a symlink (e.g. a bind-mounted
 * data dir, or `/tmp` -> `/private/tmp`); comparing a resolved target against
 * an unresolved root would reject every legitimate path on such setups.
 */
export async function assertRealPathInStore(
	target: string,
	storeDir: string,
): Promise<void> {
	const realStoreDir = await realpath(storeDir)
	let current = target

	// Walk up until we hit an existing ancestor (the target itself may be new)

	while (true) {
		try {
			// If the path exists, check if it is a symlink that escapes the store
			const real = await realpath(current)
			if (
				real !== realStoreDir &&
				!real.startsWith(realStoreDir + path.sep)
			) {
				throw Error('Path not allowed')
			}
			// We found an existing non-symlink target within the store,
			// so the given path is safe to use (whether it exists or not)
			return
		} catch (err) {
			// If the path does not exist, e.g. when creating a directory,
			// walk up to the nearest existing ancestor and check that.
			if (!hasErrorCode(err) || err.code !== 'ENOENT') {
				throw err
			}
			const parent = path.dirname(current)
			if (parent === current) {
				// reached filesystem root without finding an existing ancestor
				throw Error('Path not allowed')
			}
			current = parent
		}
	}
}

/**
 * Resolve `reqPath` against `storeDir` and throw if it is not safe - that is
 * if it escapes the storeDir. When `resolveReal` is set, symlinked path
 * components are resolved too (see {@link assertRealPathInStore}).
 */
export async function resolveSafeStorePath(
	reqPath: unknown,
	storeDir: string,
	resolveReal = true,
): Promise<string> {
	if (typeof reqPath !== 'string') {
		throw Error('Invalid path')
	}

	// path.resolve collapses any `..` segments and yields an absolute path, so
	// the prefix check below cannot be bypassed with traversal sequences.
	const safePath = path.resolve(storeDir, reqPath)

	if (safePath === storeDir || !safePath.startsWith(storeDir + path.sep)) {
		throw Error('Path not allowed')
	}

	if (resolveReal) {
		await assertRealPathInStore(safePath, storeDir)
	}

	return safePath
}

/**
 * Build logConfig object for Z-Wave driver options from Z-Wave configuration
 */
export function buildLogConfig(
	config: ZwaveConfig,
	logsDir: string,
): PartialZWaveOptions['logConfig'] {
	return {
		enabled: config.logEnabled,
		level: config.logLevel ? loglevels[config.logLevel] : 'info',
		logToFile: config.logToFile,
		maxFiles: config.maxFiles || 7,
		nodeFilter:
			config.nodeFilter && config.nodeFilter.length > 0
				? config.nodeFilter.map((n: string) => parseInt(n))
				: undefined,
		filename: joinPath(logsDir, 'zwavejs_%DATE%.log'),
		forceConsole: isDocker() ? !config.logToFile : false,
	}
}

/**
 * A post operation is a single arithmetic operator (+ - * /) applied to a
 * literal number, e.g. "/10", "*100", "+20". Only this shape is supported
 * because the receive path inverts the operation by naively swapping the
 * operator (see parsePayload), which is only correct for a single operation.
 */
const POST_OPERATION =
	/^\s*(?<operator>[-+*/])\s*(?<operand>-?\d+(?:\.\d+)?)\s*$/

/**
 * Checks if an operation is valid: a single operator (+ - * /) followed by
 * a literal number.
 */
export function isValidOperation(op: string): boolean {
	return typeof op === 'string' && POST_OPERATION.test(op)
}

/**
 * Apply a numeric scaling operation (e.g. "/10", "*2", "+5") to a numeric value.
 */
export function applyOperation(value: any, op: string): any {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return value
	}

	const match = POST_OPERATION.exec(op)
	if (!match || !match.groups) {
		return value
	}

	const operand = Number(match.groups.operand)
	let result: number
	switch (match.groups.operator) {
		case '+':
			result = value + operand
			break
		case '-':
			result = value - operand
			break
		case '*':
			result = value * operand
			break
		case '/':
			result = value / operand
			break
		default:
			return value
	}

	return Number.isFinite(result) ? result : value
}
