import type winston from 'winston'
import { transports } from 'winston'
import { customFormat, logContainer } from './logger.ts'
import archiver from 'archiver'
import type ZWaveClient from './ZwaveClient.ts'
import { joinPath, pathExists } from './utils.ts'
import { storeDir } from '../config/app.ts'
import { rm, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import { createDefaultTransportFormat } from '@zwave-js/core/bindings/log/node'
import { JSONTransport } from '@zwave-js/log-transport-json'

const debugTempDir = joinPath(storeDir, '.debug-temp')

export interface DebugSession {
	startTime: Date
	logFilePath: string
	driverLogFilePath: string
	transport: winston.transport
	originalLogLevel: string
	driverDebugTransport?: any
	driverLogStream?: NodeJS.WritableStream
	zwaveClient: ZWaveClient
}

class DebugManager {
	private session: DebugSession | null = null

	/**
	 * Initialize the debug manager by cleaning up any old temp files
	 */
	async init(): Promise<void> {
		// Clean up old debug temp directory on startup
		if (await pathExists(debugTempDir)) {
			await rm(debugTempDir, { recursive: true, force: true })
		}
	}

	/**
	 * Check if a debug session is active
	 */
	isSessionActive(): boolean {
		return this.session !== null
	}

	/**
	 * Start a debug capture session
	 */
	async startSession(
		zwaveClient: ZWaveClient,
		originalLogLevel: string,
	): Promise<void> {
		if (this.session) {
			throw new Error('A debug session is already active')
		}

		// Ensure debug temp directory exists
		await mkdir(debugTempDir, { recursive: true })

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const logFilePath = joinPath(debugTempDir, `ui-logs-${timestamp}.log`)
		const driverLogFilePath = joinPath(
			debugTempDir,
			`driver-logs-${timestamp}.log`,
		)

		// Create a file transport to capture UI logs
		const transport = new transports.File({
			filename: logFilePath,
			format: customFormat(true),
			level: 'debug',
		})

		// Add transport to all existing loggers
		logContainer.loggers.forEach((logger: winston.Logger) => {
			logger.add(transport)
			// Also set logger level to debug
			logger.level = 'debug'
		})

		// Update driver log level to debug using updateLogConfig
		let driverDebugTransport: any = undefined
		let driverLogStream: NodeJS.WritableStream | undefined = undefined
		if (zwaveClient.driverReady) {
			const debugTransport = new JSONTransport()
			debugTransport.format = createDefaultTransportFormat(false, true)

			// Write driver logs to file
			driverLogStream = createWriteStream(driverLogFilePath)
			debugTransport.stream.on('data', (data) => {
				driverLogStream.write(data.message.toString() + '\n')
			})

			driverDebugTransport = debugTransport

			// Update log config to debug level with new transport
			zwaveClient.driver.updateLogConfig({
				level: 'debug',
				transports: [debugTransport],
			})
		}

		this.session = {
			startTime: new Date(),
			logFilePath,
			driverLogFilePath,
			transport,
			originalLogLevel,
			driverDebugTransport,
			driverLogStream,
			zwaveClient,
		}
	}

	/**
	 * Stop the debug session and generate a zip file with logs and node dumps
	 */
	async stopSession(nodeIds: number[]): Promise<{
		archive: NodeJS.ReadableStream
		cleanup: () => Promise<void>
	}> {
		const session = this.session

		await this.restoreSession(session)

		// Wait a bit to ensure all logs are flushed to disk
		await setTimeout(200)

		// Create archive
		const archive = archiver('zip', {
			zlib: { level: 9 }, // Maximum compression
		})

		// Add UI logs to archive
		if (await pathExists(session.logFilePath)) {
			archive.file(session.logFilePath, {
				name: `ui-logs-${session.startTime.toISOString()}.log`,
			})
		}

		// Add driver logs to archive
		if (await pathExists(session.driverLogFilePath)) {
			archive.file(session.driverLogFilePath, {
				name: `driver-logs-${session.startTime.toISOString()}.log`,
			})
		}

		// Add node dumps to archive
		for (const nodeId of nodeIds) {
			try {
				const driverDump = session.zwaveClient.dumpNode(nodeId)
				archive.append(JSON.stringify(driverDump, null, 2), {
					name: `node-${nodeId}-driver-dump.json`,
				})

				// Get node from client for UI dump
				const node = session.zwaveClient.getNode(nodeId)
				if (node) {
					const uiDump = session.zwaveClient.nodes.get(nodeId)
					if (uiDump) {
						archive.append(JSON.stringify(uiDump, null, 2), {
							name: `node-${nodeId}-ui-dump.json`,
						})
					}
				}
			} catch (error) {
				// Log error but continue with other nodes
				archive.append(
					`Error dumping node ${nodeId}: ${error.message}`,
					{
						name: `node-${nodeId}-error.txt`,
					},
				)
			}
		}

		// Add session metadata
		const metadata = {
			startTime: session.startTime.toISOString(),
			endTime: new Date().toISOString(),
			duration: new Date().getTime() - session.startTime.getTime() + 'ms',
			nodesIncluded: nodeIds,
		}
		archive.append(JSON.stringify(metadata, null, 2), {
			name: 'session-metadata.json',
		})

		// Finalize the archive
		await archive.finalize()

		// Prepare cleanup function to delete temp files after download
		const cleanup = async () => {
			await this.cleanupTempFiles(
				session.logFilePath,
				session.driverLogFilePath,
			)
		}

		return { archive, cleanup }
	}

	/**
	 * Cancel the current debug session without generating a package
	 */
	async cancelSession(): Promise<void> {
		const session = this.session
		await this.restoreSession(session)

		// Clean up temp files
		await this.cleanupTempFiles(
			session.logFilePath,
			session.driverLogFilePath,
		)
	}

	private async restoreSession(session: DebugSession): Promise<void> {
		if (!this.session) {
			throw new Error('No active debug session')
		}

		// Remove the debug transport from all loggers and restore log level
		logContainer.loggers.forEach((logger: winston.Logger) => {
			logger.remove(session.transport)
			logger.level = session.originalLogLevel
		})

		// wait for transport to close properly
		await new Promise<void>((resolve) => {
			session.transport.on('finish', () => resolve())
			session.transport.end()
		})

		// Restore original driver log level
		await this.restoreDriverLogLevel(session)

		// Clear session
		this.session = null
	}

	/**
	 * Restore the driver log level after a debug session
	 */
	private async restoreDriverLogLevel(session: DebugSession): Promise<void> {
		if (session.zwaveClient.driverReady && session.driverDebugTransport) {
			const logTransport = new JSONTransport()
			logTransport.format = createDefaultTransportFormat(true, false)

			session.zwaveClient.driver.updateLogConfig({
				level: session.originalLogLevel as any,
				transports: [logTransport],
			})

			// Clean up debug transport
			if (session.driverDebugTransport.stream) {
				session.driverDebugTransport.stream.destroy()
			}

			// Close driver log stream properly
			if (session.driverLogStream) {
				await new Promise<void>((resolve, reject) => {
					session.driverLogStream.end(() => resolve())
					session.driverLogStream.on('error', reject)
				})
			}
		}
	}

	/**
	 * Clean up temporary files
	 */
	private async cleanupTempFiles(
		logFilePath: string,
		driverLogFilePath: string,
	): Promise<void> {
		try {
			if (await pathExists(logFilePath)) {
				await rm(logFilePath, { force: true })
			}
			if (await pathExists(driverLogFilePath)) {
				await rm(driverLogFilePath, { force: true })
			}
		} catch (error) {
			// Log but don't throw - cleanup is best effort
			console.error('Error cleaning up debug temp files:', error)
		}
	}
}

export default new DebugManager()
