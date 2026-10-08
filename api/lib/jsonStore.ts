import jsonFile from 'jsonfile'
import { storeBackupsDir, storeDir } from '../config/app.ts'
import type { StoreFile, StoreKeys } from '../config/store.ts'
import { module } from './logger.ts'
import { recursive as merge } from 'merge'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import type { Response } from 'express'
import { ensureDir, fileDate, joinPath } from './utils.ts'
import { closeFileStream, streamZip, type ZipEntry } from './zip.ts'

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

	async backup(res?: Response): Promise<string> {
		const backupFile = `${STORE_BACKUP_PREFIX}${fileDate()}.zip`

		await ensureDir(storeBackupsDir)

		const backupPath = joinPath(storeBackupsDir, backupFile)

		// backup zwavejs files too
		const entries: ZipEntry[] = (await readdir(storeDir))
			.filter((file) => file.endsWith('.jsonl'))
			.map((file) => ({ path: joinPath(storeDir, file), name: file }))

		for (const model in this.config) {
			const config: StoreFile = this.config[model]
			const filePath = joinPath(storeDir, config.file)
			if (existsSync(filePath)) {
				entries.push({ path: filePath, name: config.file })
			}
		}

		// written in full before it is sent, so a client that drops the download can't truncate the copy on disk
		const file = createWriteStream(backupPath)
		try {
			await streamZip(file, entries)
		} catch (error) {
			// a partial zip would count as a backup and could push a good one out of retention
			await closeFileStream(file)
			await rm(backupPath, { force: true })
			throw error
		}

		if (res) {
			res.set({
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${backupFile}"`,
			})

			await pipeline(createReadStream(backupPath), res)
		}

		return backupFile
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
