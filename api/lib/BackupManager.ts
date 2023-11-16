import store from '../config/store'
import { module } from './logger'
import jsonStore, { STORE_BACKUP_PREFIX } from './jsonStore'
import Cron from 'croner'
import { readdir, unlink } from 'fs/promises'
import { nvmBackupsDir, storeBackupsDir } from '../config/app'
import { joinPath } from './utils'
import type ZwaveClient from './ZwaveClient'

export const NVM_BACKUP_PREFIX = 'NVM_'

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

	get backupOnEvent() {
		return this.config.nvmBackupOnEvent
	}

	nextRun(job: Cron) {
		if (job?.nextRun()) {
			return job.nextRun().toLocaleString()
		}

		return 'UNKNOWN'
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
				this.backupStore.bind(this),
			)

			logger.info(
				`Backup job started with cron: ${
					this.config.storeCron
				}. Next run: ${this.nextRun(this.storeJob)}`,
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
				this.backupNvm.bind(this),
			)

			logger.info(
				`Backup job started with cron: ${
					this.config.nvmCron
				}. Next run: ${this.nextRun(this.nvmJob)}`,
			)
		}
	}

	async backupNvm() {
		logger.info('Backup NVM started')

		try {
			const { fileName } = await this.zwaveClient.backupNVMRaw()

			logger.info(`Backup NVM created: ${fileName}`)

			if (this.nvmJob) {
				logger.info(`Next NVM backup: ${this.nextRun(this.nvmJob)}`)
			}
			// cleanup backups dir, keep last backup files
			const backups = (await readdir(nvmBackupsDir)).filter((f) =>
				f.startsWith(NVM_BACKUP_PREFIX),
			)

			// keep last `keep` backups
			if (backups.length > this.config.nvmKeep) {
				const toDelete = backups.slice(
					0,
					backups.length - this.config.nvmKeep,
				)
				await Promise.all(
					toDelete.map(async (file) =>
						unlink(joinPath(nvmBackupsDir, file)),
					),
				)

				logger.info(`Deleted ${toDelete.length} old NVM backups`)
			}
		} catch (err) {
			logger.error('Backup NVM failed', err)
		}
	}

	async backupStore() {
		logger.info('Backup STORE started')

		try {
			const backupFile = await jsonStore.backup()

			logger.info(`Backup STORE created: ${backupFile}`)

			if (this.storeJob) {
				logger.info(`Next STORE backup: ${this.nextRun(this.storeJob)}`)
			}
			// cleanup backups dir, keep last backup files
			const backups = (await readdir(storeBackupsDir)).filter((f) =>
				f.startsWith(STORE_BACKUP_PREFIX),
			)

			// keep last `keep` backups
			if (backups.length > this.config.storeKeep) {
				const toDelete = backups.slice(
					0,
					backups.length - this.config.storeKeep,
				)
				await Promise.all(
					toDelete.map(async (file) =>
						unlink(joinPath(storeBackupsDir, file)),
					),
				)

				logger.info(`Deleted ${toDelete.length} old STORE backups`)
			}
		} catch (err) {
			logger.error('Backup STORE failed', err)
		}
	}
}

export default new BackupManager()
