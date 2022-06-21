import store from '../config/store'
import { module } from '../lib/logger'
import jsonStore from './jsonStore'
import Cron from 'croner'
import { readdir, unlink } from 'fs/promises'
import { backupsDir, storeDir } from '../config/app'
import { joinPath } from './utils'
import ZwaveClient, { NVM_BACKUP_PREFIX } from './ZwaveClient'

export interface BackupSettings {
	storeBackup: boolean
	storeCron: string
	storeKeep: number
	nvmBackup: boolean
	nvmBackupOnEvent: boolean
	nvmCron: string
	nvmKeep: number
}

const logger = module('Backup')

class BackupManager {
	private config: BackupSettings
	private storeJob: Cron
	private nvmJob: Cron
	private zwaveClient: ZwaveClient

	get default(): BackupSettings {
		return {
			storeBackup: false,
			storeCron: '0 0 * * *',
			storeKeep: 7,
			nvmBackup: false,
			nvmBackupOnEvent: false,
			nvmCron: '0 0 * * *',
			nvmKeep: 7,
		}
	}

	init(zwaveClient: ZwaveClient) {
		this.config = {
			...this.default,
			...(jsonStore.get(store.settings).backup as BackupSettings),
		}

		this.zwaveClient = zwaveClient

		if (this.storeJob) {
			this.storeJob.stop()
		}

		if (!this.config.storeBackup) {
			logger.warn('Store backup is disabled')
		} else {
			this.storeJob = new Cron(
				this.config.storeCron,
				this.backupStore.bind(this)
			)

			logger.info(
				`Backup job started with cron: ${
					this.config.storeCron
				}. Next run: ${this.storeJob.next().toLocaleString()}`
			)
		}

		if (this.nvmJob) {
			this.nvmJob.stop()
		}

		if (!this.config.nvmBackup) {
			logger.warn('Nvm backup is disabled')
		} else {
			this.nvmJob = new Cron(
				this.config.nvmCron,
				this.backupNvm.bind(this)
			)

			logger.info(
				`Backup job started with cron: ${
					this.config.nvmCron
				}. Next run: ${this.nvmJob.next().toLocaleString()}`
			)
		}
	}

	private async backupNvm() {
		logger.info('Backup started')

		try {
			const { fileName } = await this.zwaveClient.backupNVMRaw()

			logger.info(`Backup created: ${fileName}`)

			logger.info(`Next backup: ${this.nvmJob.next().toLocaleString()}`)

			// cleanup backups dir, keep last backup files
			const backups = (await readdir(storeDir)).filter((f) =>
				f.startsWith(NVM_BACKUP_PREFIX)
			)

			// keep last `keep` backups
			if (backups.length > this.config.nvmKeep) {
				const toDelete = backups.slice(
					0,
					backups.length - this.config.nvmKeep
				)
				await Promise.all(
					toDelete.map(async (file) =>
						unlink(joinPath(storeDir, file))
					)
				)

				logger.info(`Deleted ${toDelete.length} old NVM backups`)
			}
		} catch (err) {
			logger.error('Backup failed', err)
		}
	}

	private async backupStore() {
		logger.info('Backup started')

		try {
			const backupFile = await jsonStore.backup()

			logger.info(`Backup created: ${backupFile}`)

			logger.info(`Next backup: ${this.storeJob.next().toLocaleString()}`)

			// cleanup backups dir, keep last backup files
			const backups = await readdir(backupsDir)

			// keep last `keep` backups
			if (backups.length > this.config.storeKeep) {
				const toDelete = backups.slice(
					0,
					backups.length - this.config.storeKeep
				)
				await Promise.all(
					toDelete.map(async (file) =>
						unlink(joinPath(backupsDir, file))
					)
				)

				logger.info(`Deleted ${toDelete.length} old store backups`)
			}
		} catch (err) {
			logger.error('Backup failed', err)
		}
	}
}

export default new BackupManager()
