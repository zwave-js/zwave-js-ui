import type { Socket } from 'socket.io'
import debugManager from '../lib/DebugManager.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AllowedApis, CallAPIResult } from '../lib/ZwaveClient.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import type { ZnifferPort, ZwaveClientPort } from '../runtime/ports.ts'
import type { SocketAck } from './api.ts'

type ZwaveState = ReturnType<ZwaveClientPort['getState']>
type ZnifferStatus = ReturnType<ZnifferPort['status']>

export interface InitAckState extends Partial<ZwaveState> {
	zniffer?: ZnifferStatus
	debugCaptureActive: boolean
}

export function registerInitHandler(socket: Socket, runtime: AppRuntime): void {
	socket.on(
		inboundEvents.init,
		(_data: unknown, cb?: SocketAck<InitAckState>) => {
			let state: Partial<ZwaveState> & { zniffer?: ZnifferStatus } = {}

			const currentGw = runtime.ensureGateway()
			if (currentGw.zwave) {
				state = { ...currentGw.zwave.getState() }
			}

			const currentZniffer = runtime.zniffer
			if (currentZniffer) {
				state.zniffer = currentZniffer.status()
			}

			cb?.({
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

type ZwaveApiAck = CallAPIResult<AllowedApis> & {
	api?: string
}

type DynamicCallApi = (
	apiName: string,
	...args: unknown[]
) => Promise<CallAPIResult<AllowedApis>>

export function registerZwaveApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.zwave,
		async (data: ZwaveApiRequest, cb?: SocketAck<ZwaveApiAck>) => {
			const currentGw = runtime.ensureGateway()
			if (currentGw.zwave) {
				if (!data.args) data.args = []
				if (!Array.isArray(data.args)) {
					cb?.({
						success: false,
						message: 'Z-Wave API arguments must be an array',
						api: data.api,
					})
					return
				}
				const callApi = currentGw.zwave.callApi.bind(
					currentGw.zwave,
				) as DynamicCallApi
				const result: ZwaveApiAck = await callApi(
					data.api,
					...data.args,
				)
				result.api = data.api
				cb?.(result)
			} else {
				cb?.({
					success: false,
					message: 'Z-Wave client not connected',
				})
			}
		},
	)
}
