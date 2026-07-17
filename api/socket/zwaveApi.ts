import type { Socket } from 'socket.io'
import debugManager from '../lib/DebugManager.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import type { ZnifferPort, ZwaveClientPort } from '../runtime/ports.ts'
import { noop, type SocketAck } from './types.ts'

type ZwaveState = ReturnType<ZwaveClientPort['getState']>
type ZnifferStatus = ReturnType<ZnifferPort['status']>

export interface InitAckState extends Partial<ZwaveState> {
	zniffer?: ZnifferStatus
	debugCaptureActive: boolean
}

export function registerInitHandler(socket: Socket, runtime: AppRuntime): void {
	socket.on(
		inboundEvents.init,
		(_data: unknown, cb: SocketAck<InitAckState> = noop) => {
			let state: Partial<ZwaveState> & { zniffer?: ZnifferStatus } = {}

			const currentGw = runtime.requireGateway()
			if (currentGw.zwave) {
				state = currentGw.zwave.getState()
			}

			const currentZniffer = runtime.getZniffer()
			if (currentZniffer) {
				state.zniffer = currentZniffer.status()
			}

			cb({
				...state,
				debugCaptureActive: debugManager.isSessionActive(),
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
			const currentGw = runtime.requireGateway()
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
