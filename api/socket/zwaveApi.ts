import type { Socket } from 'socket.io'
import type ZwaveClient from '../lib/ZwaveClient.ts'
import type ZnifferManager from '../lib/ZnifferManager.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

type ZwaveState = ReturnType<ZwaveClient['getState']>
type ZnifferStatus = ReturnType<ZnifferManager['status']>

export interface InitAckState extends Partial<ZwaveState> {
	zniffer?: ZnifferStatus
	debugCaptureActive: boolean
}

// Resolves the gateway via runtime on every call so a gateway replaced mid-restart is seen by the next event
export function registerInitHandler(socket: Socket, runtime: AppRuntime): void {
	socket.on(
		inboundEvents.init,
		(_data: unknown, cb: SocketAck<InitAckState> = noop) => {
			let state: Partial<ZwaveState> & { zniffer?: ZnifferStatus } = {}

			// Throws when no gateway is attached yet
			const currentGw = runtime.requireGateway('zwave')
			if (currentGw.zwave) {
				state = currentGw.zwave.getState()
			}

			const currentZniffer = runtime.getZniffer()
			if (currentZniffer) {
				state.zniffer = currentZniffer.status()
			}

			cb({
				...state,
				debugCaptureActive: runtime.getDebugManager().isSessionActive(),
			})
		},
	)
}

export interface ZwaveApiRequest {
	api: string
	args?: unknown
}

interface ZwaveApiAck {
	success: boolean
	message: string
	result?: unknown
	args?: unknown[]
	api?: string
}

type DynamicCallApi = (
	apiName: string,
	...args: unknown[]
) => Promise<ZwaveApiAck>

function wireArguments(args: unknown): unknown[] {
	return [...(args as Iterable<unknown>)]
}

export function registerZwaveApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.zwave,
		async (data: ZwaveApiRequest, cb: SocketAck<ZwaveApiAck> = noop) => {
			const currentGw = runtime.requireGateway('zwave')
			if (currentGw.zwave) {
				if (!data.args) data.args = []
				const callApi = currentGw.zwave.callApi.bind(
					currentGw.zwave,
				) as DynamicCallApi
				const result = await callApi(
					data.api,
					...wireArguments(data.args),
				)
				result.api = data.api
				cb(result)
			} else {
				cb({
					success: false,
					message: 'Zwave client not connected',
				})
			}
		},
	)
}
