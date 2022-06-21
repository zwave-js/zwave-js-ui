import store from '../config/store'
import { module } from '../lib/logger'
import jsonStore from './jsonStore'
import Cron from 'croner'
import { readdir, unlink } from 'fs/promises'
import { backupsDir } from '../config/app'
import { joinPath } from './utils'

export interface BackupSettings {
	enabled: boolean
	cron: string
	keep: number
}

const logger = module('Backup')

class BackupManager {
	private config: BackupSettings
	private backupJob: Cron

	get default(): BackupSettings {
		return {
			enabled: false,
			cron: '0 0 * * *',
			keep: 7,
		}
	}

	init() {
		this.config = {
			...this.default,
			...(jsonStore.get(store.settings).backup as BackupSettings),
		}

		if (!this.config.enabled) {
			logger.warn('Backup is disabled')
			return
		}

		if (this.backupJob) {
			this.backupJob.stop()
		}

		this.backupJob = new Cron(this.config.cron, this.doBackup.bind(this))

		logger.info(
			`Backup job started with cron: ${
				this.config.cron
			}. Next run: ${this.backupJob.next().toLocaleString()}`
		)
	}

	private async doBackup() {
		logger.info('Backup started')

		try {
			const backupFile = await jsonStore.backup()

			logger.info(`Backup created: ${backupFile}`)

			logger.info(
				`Next backup: ${this.backupJob.next().toLocaleString()}`
			)

			// cleanup backups dir, keep last backup files
			const backups = await readdir(backupsDir)

			// keep last `keep` backups
			if (backups.length > this.config.keep) {
				const toDelete = backups.slice(
					0,
					backups.length - this.config.keep
				)
				await Promise.all(
					toDelete.map(async (file) =>
						unlink(joinPath(backupsDir, file))
					)
				)

				logger.info(`Deleted ${toDelete.length} old backups`)
			}
		} catch (err) {
			logger.error('Backup failed', err)
		}
	}
}

export default new BackupManager()
