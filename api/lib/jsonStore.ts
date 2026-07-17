import jsonFile from 'jsonfile'
import { storeBackupsDir, storeDir } from '../config/app.ts'
import type { StoreFile, StoreKeys } from '../config/store.ts'
import { module } from './logger.ts'
import { recursive as merge } from 'merge'
import archiver from 'archiver'
import { createWriteStream, existsSync } from 'node:fs'
import type { Response } from 'express'
import { ensureDir, fileDate, joinPath } from './utils.ts'
import { hasErrorCode } from './errors.ts'

const logger = module('Store')

export const STORE_BACKUP_PREFIX = 'store-backup_'

// Default dependencies for production use
const defaultDeps = {
	readFile: jsonFile.readFile.bind(jsonFile),
	writeFile: jsonFile.writeFile.bind(jsonFile),
}

export interface StorageHelperDeps {
	readFile?: typeof jsonFile.readFile
	writeFile?: typeof jsonFile.writeFile
}

// The subset of store entries this helper has been initialized with
export type StoreConfig = Record<StoreKeys, StoreFile<unknown>>

/**
Constructor
**/
export class StorageHelper {
	// Keyed by the on-disk filename, not StoreKeys, since get/put schema-check via each call's own StoreFile<T>
	private _store: Record<string, unknown>
	private config?: StoreConfig
	private readFile: typeof jsonFile.readFile
	private writeFile: typeof jsonFile.writeFile

	public get store() {
		return this._store
	}

	constructor(deps?: StorageHelperDeps) {
		this._store = {}
		this.readFile = deps?.readFile || defaultDeps.readFile
		this.writeFile = deps?.writeFile || defaultDeps.writeFile
	}

	async init(config: StoreConfig) {
		this.config = config

		for (const model in config) {
			const res = await this._getFile(config[model as StoreKeys])
			this._store[res.file] = res.data
		}

		return this._store
	}

	async backup(res?: Response): Promise<string> {
		const backupFile = `${STORE_BACKUP_PREFIX}${fileDate()}.zip`

		await ensureDir(storeBackupsDir)

		const fileStream = createWriteStream(
			joinPath(storeBackupsDir, backupFile),
		)

		return new Promise((resolve, reject) => {
			const archive = archiver('zip')

			archive.on('error', (err) => {
				reject(err)
			})

			// on stream closed we can end the request
			archive.on('end', () => {
				resolve(backupFile)
			})

			if (res) {
				res.set({
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${backupFile}"`,
				})

				archive.pipe(res)
			}

			archive.pipe(fileStream)

			// backup zwavejs files too
			archive.glob('*.jsonl', {
				cwd: storeDir,
			})

			if (this.config) {
				for (const model in this.config) {
					const config: StoreFile<unknown> =
						this.config[model as StoreKeys]
					const filePath = joinPath(storeDir, config.file)
					if (existsSync(filePath)) {
						archive.file(filePath, {
							name: config.file,
						})
					}
				}
			}

			void archive.finalize()
		})
	}

	private async _getFile<T>(config: StoreFile<T>) {
		let err: unknown
		let data: unknown
		try {
			data = await this.readFile(joinPath(storeDir, config.file))
		} catch (error) {
			err = error
		}

		// ignore ENOENT error
		if (err) {
			if (hasErrorCode(err) && err.code === 'ENOENT') {
				logger.warn(`${config.file} not found`)
			} else {
				logger.error('Error reading file: ' + config.file, err)
			}
		}

		// replace data with default
		if (!data) {
			data = config.default
		} else {
			data = Array.isArray(data) ? data : merge(config.default, data)
		}

		return { file: config.file, data: data as T }
	}

	get<T>(model: StoreFile<T>): T {
		if (this._store[model.file]) {
			return this._store[model.file] as T
		} else {
			throw Error('Requested file not present in store: ' + model.file)
		}
	}

	async put<T>(model: StoreFile<T>, data: T): Promise<T> {
		await this.writeFile(joinPath(storeDir, model.file), data)
		this._store[model.file] = data
		return data
	}
}

export default new StorageHelper()
