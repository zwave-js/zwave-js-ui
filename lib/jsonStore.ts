'use strict'

// eslint-disable-next-line one-var
import { readFile, writeFile } from 'jsonfile'
import { storeDir } from '../config/app'
import { StoreFile, StoreKeys } from '../config/store'
import { module } from './logger'
import * as utils from './utils'

const logger = module('Store')

/**
Constructor
**/
class StorageHelper {
	public store: Record<StoreKeys, any>
	public config: Record<StoreKeys, StoreFile>

	constructor() {
		this.store = {} as Record<StoreKeys, any>
	}

	async init(config: Record<StoreKeys, StoreFile>) {
		this.config = config

		for (const model in config) {
			const res = await this._getFile(config[model])
			this.store[res.file] = res.data
		}

		return this.store
	}

	async _getFile(config: StoreFile) {
		let err: { code: string }
		let data: any
		try {
			data = await readFile(utils.joinPath(storeDir, config.file))
		} catch (error) {
			err = error
		}

		// ignore ENOENT error
		if (err) {
			if (err.code !== 'ENOENT') throw err
			else {
				logger.warn(`${config.file} not found`)
			}
		}

		// replace data with default
		if (!data) {
			data = config.default
		}

		return { file: config.file, data: data }
	}

	get(model: StoreFile) {
		if (this.store[model.file]) {
			return this.store[model.file]
		} else {
			throw Error('Requested file not present in store: ' + model.file)
		}
	}

	async put(model: StoreFile, data: any) {
		await writeFile(utils.joinPath(storeDir, model.file), data)
		this.store[model.file] = data
		return data
	}
}

// eslint-disable-next-line camelcase
export default new StorageHelper()
