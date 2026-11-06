import jsonFile from 'jsonfile'
import { storeBackupsDir, storeDir } from '../config/app.ts'
import type { StoreFile, StoreKeys } from '../config/store.ts'
import { module } from './logger.ts'
import floorPlansStore from './FloorPlans.ts'
import { recursive as merge } from 'merge'
import archiver from 'archiver'
import { createWriteStream, existsSync } from 'node:fs'
import type { Response } from 'express'
import { ensureDir, fileDate, joinPath } from './utils.ts'

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

/**
Constructor
**/
export class StorageHelper {
	private _store: Record<StoreKeys, any>
	private config: Record<StoreKeys, StoreFile>
	private readFile: typeof jsonFile.readFile
	private writeFile: typeof jsonFile.writeFile

	public get store() {
		return this._store
	}

	constructor(deps?: StorageHelperDeps) {
		this._store = {} as Record<StoreKeys, any>
		this.readFile = deps?.readFile || defaultDeps.readFile
		this.writeFile = deps?.writeFile || defaultDeps.writeFile
	}

	async init(config: Record<StoreKeys, StoreFile>) {
		this.config = config

		for (const model in config) {
			const res = await this._getFile(config[model])
			this._store[res.file] = res.data
		}

		return this._store
	}

	/**
	 * Zip the store files, streaming the zip to `res` too when given.
	 * `floorPlans: false` leaves the floorplans out.
	 */
	async backup({
		res,
		floorPlans = true,
	}: { res?: Response; floorPlans?: boolean } = {}): Promise<string> {
		const backupFile = `${STORE_BACKUP_PREFIX}${fileDate()}.zip`

		// a floorplans problem must not cost the rest of the backup
		let floorPlanFiles: { name: string; data: Buffer }[] = []
		if (floorPlans) {
			try {
				floorPlanFiles = await floorPlansStore.backupFiles()
			} catch (error) {
				logger.error(
					`Floorplans left out of the backup: ${error.message}`,
				)
			}
		}

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

			// pictures are already compressed: store them as they are
			for (const { name, data } of floorPlanFiles) {
				archive.append(data, {
					name: `floorplans/${name}`,
					store: name.startsWith('images/'),
				})
			}

			for (const model in this.config) {
				const config: StoreFile = this.config[model]
				const filePath = joinPath(storeDir, config.file)
				if (existsSync(filePath)) {
					archive.file(filePath, {
						name: config.file,
					})
				}
			}

			void archive.finalize()
		})
	}

	private async _getFile(config: StoreFile) {
		let err: { code: string } | undefined
		let data: any
		try {
			data = await this.readFile(joinPath(storeDir, config.file))
		} catch (error) {
			err = error
		}

		// ignore ENOENT error
		if (err) {
			if (err.code !== 'ENOENT') {
				logger.error('Error reading file: ' + config.file, err)
			} else {
				logger.warn(`${config.file} not found`)
			}
		}

		// replace data with default
		if (!data) {
			data = config.default
		} else {
			data = Array.isArray(data) ? data : merge(config.default, data)
		}

		return { file: config.file, data: data }
	}

	get(model: StoreFile) {
		if (this._store[model.file]) {
			return this._store[model.file]
		} else {
			throw Error('Requested file not present in store: ' + model.file)
		}
	}

	async put(model: StoreFile, data: any) {
		await this.writeFile(joinPath(storeDir, model.file), data)
		this._store[model.file] = data
		return data
	}
}

export default new StorageHelper()
