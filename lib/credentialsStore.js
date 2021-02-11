/* eslint-disable no-undef */
const crypto = require('crypto')
const reqlib = require('app-root-path').require
const { joinPath } = reqlib('/lib/utils.js')
const jsonfile = require('jsonfile')
const appConfig = reqlib('/config/app')
const logger = reqlib('/lib/logger.js').module('Credentials')
const fs = require('fs-extra')
const uniqid = require('uniqid')

const encryptionAlgorithm = 'aes-256-ctr'

const CREDENTIALS_FILE = joinPath(appConfig.storeDir, appConfig.credentialsFile)
const CREDENTIALS_KEY_FILE = joinPath(appConfig.storeDir, appConfig.credentialsFile)

let credentialsKey = ''
let credentials = {}

function decryptCredentials (credentials) {
  let creds = credentials.$
  const initVector = Buffer.from(creds.substring(0, 32), 'hex')
  creds = creds.substring(32)
  const decipher = crypto.createDecipheriv(encryptionAlgorithm, credentialsKey, initVector)
  const decrypted = decipher.update(creds, 'base64', 'utf8') + decipher.final('utf8')

  try {
    return JSON.parse(decrypted)
  } catch (error) {
    throw Error('Wrong key')
  }
}

function encryptCredentials (credentials) {
  const initVector = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(encryptionAlgorithm, credentialsKey, initVector)
  return { $: initVector.toString('hex') + cipher.update(JSON.stringify(credentials), 'utf8', 'base64') + cipher.final('base64') }
}

async function updateKey () {
  let key = process.env.CREDENTIALS_KEY

  if (!key) {
    // try to load key from store
    try {
      key = await fs.readFile(CREDENTIALS_KEY_FILE)
    } catch (error) {
      logger.error('Error while reading key file', error)
    }

    // genereta e new one
    if (!key) {
      logger.warn('No credetials key found in env or file. Creating a fresh new one...')
      const key = crypto.randomBytes(16).toString('base64')
      await fs.writeFile(CREDENTIALS_KEY_FILE, key)
    }
  }

  credentialsKey = crypto.createHash('sha256').update(key).digest()
}

async function update () {
  try {
    await jsonfile.writeFile(CREDENTIALS_FILE, encryptCredentials(credentials))
    logger.info('Credentials updated')
  } catch (error) {
    logger.error('Error while updatig credentials', error)
  }
}

const exports = module.exports = {}

exports.getKey = () => credentialsKey

exports.init = async () => {
  try {
    updateKey()
    const data = await jsonfile.readFile(CREDENTIALS_FILE)
    credentials = decryptCredentials(data)
    logger.info('Credentials loaded')
  } catch (error) {
    if (error.message.startsWith('ENOENT')) logger.warn('Credentials file not found')
    else logger.error('Error while loading credentials:', error.message)
  }

  // // no users found, create the default one
  if (!credentials[appConfig.defaultUser]) {
    logger.info('No user found, creating the default one')
    credentials[appConfig.defaultUser] = { username: 'admin', password: 'zwaveRocks', _id: uniqid() }
    await update()
  }
}

exports.get = (credId) => {
  return credentials[credId]
}

exports.set = (credId, cred) => {
  credentials[credId] = cred
}

exports.delete = (credId) => {
  delete credentials[credId]
}

exports.update = update
