import { joinPath } from '../lib/utils'
import { config } from 'dotenv'

config({ path: './.env.app' })

// config/app.js
export const title: string = 'ZWave To MQTT'
export const storeDir: string = process.env.STORE_DIR || joinPath(true, 'store')
export const tmpDir: string = joinPath(storeDir, '.tmp')
export const backupsDir: string = joinPath(storeDir, 'backups')


export const defaultUser: string =  'admin'
export const defaultPsw: string =  'zwave'
export const sessionSecret: string =  process.env.SESSION_SECRET || 'DEFAULT_SESSION_SECRET_CHANGE_ME'
export const base: string =  '/'
export const port: string | number =  process.env.PORT || 8091
export const host: string =  process.env.HOST || '0.0.0.0'