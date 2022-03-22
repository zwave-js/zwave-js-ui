'use strict'

// eslint-disable-next-line one-var
import { readFile, writeFile } from 'jsonfile'
import { storeDir } from '../config/app'
import { StoreFile, StoreKeys } from '../config/store'
import { module } from './logger'
import * as utils from './utils'
import { recursive as merge } from 'merge'

const logger = module('Store')

/**
Constructor
**/
export class StorageHelper {
	private _store: Record<StoreKeys, any>
	private config: Record<StoreKeys, StoreFile>

	public get store() {
		return this._store
	}

	constructor() {
		this._store = {} as Record<StoreKeys, any>
	}

	async init(config: Record<StoreKeys, StoreFile>) {
		this.config = config

		for (const model in config) {
			const res = await this._getFile(config[model])
			this._store[res.file] = res.data
		}

		return this._store
	}

	private async _getFile(config: StoreFile) {
		let err: { code: string } | undefined
		let data: any
		try {
			data = await readFile(utils.joinPath(storeDir, config.file))
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
			data = merge(config.default, data)
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
		await writeFile(utils.joinPath(storeDir, model.file), data)
		this._store[model.file] = data
		return data
	}
}

// eslint-disable-next-line camelcase
export default new StorageHelper()
