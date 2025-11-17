import { PassThrough } from 'node:stream'
import type winston from 'winston'
import { customFormat } from './logger.ts'
import archiver from 'archiver'
import type ZWaveClient from './ZwaveClient.ts'

export interface DebugSession {
	startTime: Date
	logs: string[]
	logStream: PassThrough
	transport: winston.transport
	originalLogLevel: string
}

class DebugManager {
	private session: DebugSession | null = null

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
		logContainer: winston.Container,
		zwaveClient: ZWaveClient,
		originalLogLevel: string,
	): Promise<void> {
		if (this.session) {
			throw new Error('A debug session is already active')
		}

		const logStream = new PassThrough()
		const logs: string[] = []

		// Create a stream transport to capture logs
		const { transports } = await import('winston')
		const transport = new transports.Stream({
			format: customFormat(true),
			level: 'debug',
			stream: logStream,
		})

		// Collect logs into array
		logStream.on('data', (chunk: Buffer) => {
			logs.push(chunk.toString())
		})

		// Add transport to all existing loggers
		logContainer.loggers.forEach((logger: winston.Logger) => {
			logger.add(transport)
		})

		// Update driver log level to debug using updateLogConfig
		if (zwaveClient.driverReady) {
			const { createDefaultTransportFormat } = await import(
				'@zwave-js/core/bindings/log/node'
			)
			const { JSONTransport } = await import(
				'@zwave-js/log-transport-json'
			)

			const debugTransport = new JSONTransport()
			debugTransport.format = createDefaultTransportFormat(false, true)

			// Capture driver logs
			debugTransport.stream.on('data', (data) => {
				logs.push(data.message.toString())
			})

			zwaveClient.driver.updateLogConfig({
				level: 'debug',
				transports: [debugTransport],
			})
		}

		this.session = {
			startTime: new Date(),
			logs,
			logStream,
			transport,
			originalLogLevel,
		}
	}

	/**
	 * Stop the debug session and generate a zip file with logs and node dumps
	 */
	async stopSession(
		logContainer: winston.Container,
		zwaveClient: ZWaveClient,
		nodeIds: number[],
	): Promise<NodeJS.ReadableStream> {
		if (!this.session) {
			throw new Error('No active debug session')
		}

		const session = this.session

		// Remove the debug transport from all loggers
		logContainer.loggers.forEach((logger: winston.Logger) => {
			logger.remove(session.transport)
		})

		// Restore original driver log level
		if (zwaveClient.driverReady) {
			const { createDefaultTransportFormat } = await import(
				'@zwave-js/core/bindings/log/node'
			)
			const { JSONTransport } = await import(
				'@zwave-js/log-transport-json'
			)

			const logTransport = new JSONTransport()
			logTransport.format = createDefaultTransportFormat(true, false)

			zwaveClient.driver.updateLogConfig({
				level: session.originalLogLevel as any,
				transports: [logTransport],
			})
		}

		// Create archive
		const archive = archiver('zip', {
			zlib: { level: 9 }, // Maximum compression
		})

		// Add logs to archive
		const logsContent = session.logs.join('\n')
		archive.append(logsContent, {
			name: `debug-logs-${session.startTime.toISOString()}.log`,
		})

		// Add node dumps to archive
		for (const nodeId of nodeIds) {
			try {
				const driverDump = zwaveClient.dumpNode(nodeId)
				archive.append(JSON.stringify(driverDump, null, 2), {
					name: `node-${nodeId}-driver-dump.json`,
				})

				// Get node from client for UI dump
				const node = zwaveClient.getNode(nodeId)
				if (node) {
					const uiDump = zwaveClient.nodes.get(nodeId)
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
			logCount: session.logs.length,
		}
		archive.append(JSON.stringify(metadata, null, 2), {
			name: 'session-metadata.json',
		})

		// Finalize the archive
		await archive.finalize()

		// Clean up session
		session.logStream.destroy()
		this.session = null

		return archive
	}

	/**
	 * Cancel the current debug session without generating a package
	 */
	cancelSession(
		logContainer: winston.Container,
		zwaveClient: ZWaveClient,
	): void {
		if (!this.session) {
			throw new Error('No active debug session')
		}

		const session = this.session

		// Remove the debug transport from all loggers
		logContainer.loggers.forEach((logger: winston.Logger) => {
			logger.remove(session.transport)
		})

		// Restore original driver log level
		if (zwaveClient.driverReady) {
			zwaveClient.driver.updateLogConfig({
				level: session.originalLogLevel as any,
			})
		}

		// Clean up session
		session.logStream.destroy()
		this.session = null
	}
}

export default new DebugManager()
