import type winston from 'winston'
import { transports } from 'winston'
import { customFormat, logContainer, module } from './logger.ts'
import archiver from 'archiver'
import type ZWaveClient from './ZwaveClient.ts'
import { joinPath, pathExists, getVersion } from './utils.ts'
import { storeDir } from '../config/app.ts'
import { rm, mkdir } from 'node:fs/promises'
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs'
import { finished, pipeline } from 'node:stream/promises'
import { createDefaultTransportFormat } from '@zwave-js/core/bindings/log/node'
import { JSONTransport } from '@zwave-js/log-transport-json'
import { libVersion } from 'zwave-js'
import os from 'node:os'

const logger = module('DebugManager')

const debugTempDir = joinPath(storeDir, '.debug-temp')

export interface DebugSession {
	startTime: Date
	logFilePath: string
	driverLogFilePath: string
	transport: winston.transport
	logStream: NodeJS.WritableStream
	originalLogLevel: string
	driverDebugTransport?: any
	driverLogStream?: NodeJS.WritableStream
	zwaveClient: ZWaveClient
	// log files that were cut short, reported in the package metadata
	incompleteLogs: { file: string; error: string }[]
	// the driver log level could not be restored, reported in the package metadata
	restoreError?: string
}

class DebugManager {
	private session: DebugSession | null = null
	// set while start creates the temp dir and while stop restores the loggers
	private transitioning = false

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
		restartDriver = false,
	): Promise<void> {
		if (this.session) {
			throw new Error('A debug session is already active')
		}
		// an overlapping start would orphan one session; a pending restore would reset our log levels
		if (this.transitioning) {
			throw new Error('A debug session is still starting or stopping')
		}

		this.transitioning = true
		try {
			// Ensure debug temp directory exists
			await mkdir(debugTempDir, { recursive: true })
		} finally {
			this.transitioning = false
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const logFilePath = joinPath(debugTempDir, `ui-logs-${timestamp}.log`)
		const driverLogFilePath = joinPath(
			debugTempDir,
			`driver-logs-${timestamp}.log`,
		)

		// not a File transport: logger.remove() closes it and strands any pending backlog
		const logStream = createWriteStream(logFilePath)
		logStream.on('error', (err) =>
			logger.error('Error writing debug UI logs:', err),
		)
		const transport = new transports.Stream({
			stream: logStream,
			format: customFormat(true),
			level: 'debug',
		})

		// Add transport to all existing loggers
		logContainer.loggers.forEach((moduleLogger: winston.Logger) => {
			moduleLogger.add(transport)
			// Also set logger level to debug
			moduleLogger.level = 'debug'
		})

		// Set up driver debug transport that persists across restarts
		let driverDebugTransport: any = undefined
		let driverLogStream: NodeJS.WritableStream | undefined = undefined

		const debugTransport = new JSONTransport()
		debugTransport.format = createDefaultTransportFormat(false, true)

		// Write driver logs to file
		driverLogStream = createWriteStream(driverLogFilePath)
		driverLogStream.on('error', (err) =>
			logger.error('Error writing debug driver logs:', err),
		)
		debugTransport.stream.on('data', (data) => {
			driverLogStream.write(data.message.toString() + '\n')
		})

		driverDebugTransport = debugTransport

		// Register transport so it persists across driver restarts
		zwaveClient.addExtraLogTransport(debugTransport, 'debug')

		this.session = {
			startTime: new Date(),
			logFilePath,
			driverLogFilePath,
			transport,
			logStream,
			originalLogLevel,
			driverDebugTransport,
			driverLogStream,
			zwaveClient,
			incompleteLogs: [],
		}

		// Restart driver if requested to capture startup logs
		if (restartDriver && zwaveClient.driverReady) {
			await zwaveClient.restart()
		}
	}

	/**
	 * Stop the debug session and stream a zip file with logs and node dumps to `output`.
	 * The session and its temp files are consumed even when this rejects.
	 */
	async stopSession(
		nodeIds: number[],
		output: NodeJS.WritableStream,
	): Promise<void> {
		const session = this.detachSession()
		// owned rather than archive.file(): archiver never closes those if the output fails
		const fileStreams: ReadStream[] = []

		try {
			await this.restoreSession(session)

			// Create archive
			const archive = archiver('zip', {
				zlib: { level: 9 }, // Maximum compression
			})
			// piped before any source is added, so a source error always reaches the pipeline
			const streaming = pipeline(archive, output)
			// observed below; this only stops an early rejection being reported as unhandled
			streaming.catch(() => {})

			const addFile = async (path: string, name: string) => {
				if (await pathExists(path)) {
					const stream = createReadStream(path)
					// archiver pipes sources without forwarding their errors: fail the archive instead of hanging
					stream.on('error', (error) => archive.destroy(error))
					fileStreams.push(stream)
					archive.append(stream, { name })
				}
			}

			// Add UI logs to archive
			await addFile(
				session.logFilePath,
				`ui-logs-${session.startTime.toISOString()}.log`,
			)

			// Add driver logs to archive
			await addFile(
				session.driverLogFilePath,
				`driver-logs-${session.startTime.toISOString()}.log`,
			)

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
					// Record the error in the package and continue with other nodes
					archive.append(
						`Error dumping node ${nodeId}: ${error.message}`,
						{
							name: `node-${nodeId}-error.txt`,
						},
					)
				}
			}

			// Add session metadata
			const endTime = new Date()
			const metadata = {
				startTime: session.startTime.toISOString(),
				endTime: endTime.toISOString(),
				duration:
					endTime.getTime() - session.startTime.getTime() + 'ms',
				nodesIncluded: nodeIds,
				os: os.platform(),
				nodeVersion: process.version.replace(/^v/, ''),
				driverVersion: libVersion,
				zuiVersion: getVersion(),
				incompleteLogs: session.incompleteLogs,
				restoreError: session.restoreError,
			}
			archive.append(JSON.stringify(metadata, null, 2), {
				name: 'session-metadata.json',
			})

			// finalize() only resolves once the output has consumed the archive
			await Promise.all([streaming, archive.finalize()])
			logger.info(
				`Debug package sent: ${archive.pointer()} bytes, ${nodeIds.length} nodes`,
			)
		} finally {
			// destroy() only schedules the close: removing an open file fails on Windows
			await Promise.all(
				fileStreams.map((stream) => {
					// resolves on close only: an open error must not skip the cleanup below
					const closed = new Promise<void>((resolve) =>
						stream.once('close', () => resolve()),
					)
					stream.destroy()
					return stream.closed ? undefined : closed
				}),
			)
			await this.cleanupTempFiles(
				session.logFilePath,
				session.driverLogFilePath,
			)
		}
	}

	/**
	 * Cancel the current debug session without generating a package
	 */
	async cancelSession(): Promise<void> {
		const session = this.detachSession()
		try {
			await this.restoreSession(session)
		} finally {
			// Clean up temp files
			await this.cleanupTempFiles(
				session.logFilePath,
				session.driverLogFilePath,
			)
		}
	}

	/**
	 * Take the active session synchronously so a concurrent stop or a failed restore can't reuse it
	 */
	private detachSession(): DebugSession {
		const session = this.session
		if (!session) {
			throw new Error('No active debug session')
		}
		this.session = null
		return session
	}

	private async restoreSession(session: DebugSession): Promise<void> {
		this.transitioning = true
		try {
			// Remove the debug transport from all loggers and restore log level
			logContainer.loggers.forEach((moduleLogger: winston.Logger) => {
				moduleLogger.remove(session.transport)
				moduleLogger.level = session.originalLogLevel
			})

			// wait for all UI logs to be flushed to disk
			await this.closeLogStream(session, session.logStream, 'ui-logs')

			// a misbehaving driver is when the capture matters most: keep it and report the failure
			try {
				await this.restoreDriverLogLevel(session)
			} catch (error) {
				session.restoreError = error.message
				logger.warn(
					'Could not restore the driver log level after the debug capture:',
					error,
				)
			}
		} finally {
			this.transitioning = false
		}
	}

	/**
	 * End a capture stream and wait for it to flush. A failed stream doesn't stop the package:
	 * whatever reached disk is still archived, and the failure is recorded in its metadata.
	 */
	private async closeLogStream(
		session: DebugSession,
		stream: NodeJS.WritableStream,
		name: string,
	): Promise<void> {
		stream.end()
		await finished(stream).catch((error: Error) => {
			session.incompleteLogs.push({ file: name, error: error.message })
			logger.warn(`Debug ${name} capture is incomplete: ${error.message}`)
		})
	}

	/**
	 * Restore the driver log level after a debug session
	 */
	private async restoreDriverLogLevel(session: DebugSession): Promise<void> {
		if (session.driverDebugTransport) {
			try {
				// Remove extra transport (works even if driver was restarted)
				session.zwaveClient.removeExtraLogTransport(
					session.driverDebugTransport,
				)

				// Restore original log level if driver is still running
				if (session.zwaveClient.driverReady) {
					session.zwaveClient.driver.updateLogConfig({
						level: session.originalLogLevel as any,
					})
				}
			} finally {
				// the capture streams must be released even if the driver refused the restore
				if (session.driverDebugTransport.stream) {
					session.driverDebugTransport.stream.destroy()
				}
				if (session.driverLogStream) {
					await this.closeLogStream(
						session,
						session.driverLogStream,
						'driver-logs',
					)
				}
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
		for (const filePath of [logFilePath, driverLogFilePath]) {
			try {
				await rm(filePath, { force: true })
			} catch (error) {
				// Log but don't throw - cleanup is best effort
				logger.warn(
					`Error removing debug temp file ${filePath}:`,
					error,
				)
			}
		}
	}
}

export default new DebugManager()
