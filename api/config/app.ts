import { joinPath } from '../lib/utils'
import { config } from 'dotenv'

config({ path: './.env.app' })

// config/app.js
export const title: string = 'Z-Wave JS UI'
export const storeDir: string = process.env.STORE_DIR || joinPath(true, 'store')
export const logsDir: string =
	process.env.ZWAVEJS_LOGS_DIR || joinPath(storeDir, 'logs')
export const snippetsDir: string = joinPath(storeDir, 'snippets')

export const tmpDir: string = joinPath(storeDir, '.tmp')
export const backupsDir: string =
	process.env.BACKUPS_DIR || joinPath(storeDir, 'backups')
export const nvmBackupsDir: string = joinPath(backupsDir, 'nvm')
export const storeBackupsDir: string = joinPath(backupsDir, 'store')

export const configDbDir: string = joinPath(storeDir, '.config-db')

export const defaultUser: string = process.env.DEFAULT_USERNAME || 'admin'
export const defaultPsw: string = process.env.DEFAULT_PASSWORD || 'zwave'
// lgtm [js/hardcoded-credentials]
export const sessionSecret: string =
	process.env.SESSION_SECRET || 'DEFAULT_SESSION_SECRET_CHANGE_ME'
export const base: string = process.env.BASE_PATH || '/'
export const port: string | number = process.env.PORT || 8091
export const host: string = process.env.HOST // by default undefined, so it will listen on all interfaces both ipv4 and ipv6
