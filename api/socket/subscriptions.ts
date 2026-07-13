import type { Socket } from 'socket.io'
import { ALL_CHANNELS, channelMap, inboundEvents } from '#api/lib/SocketEvents'
import type { SocketAck } from '#api/socket/api'

export interface ChannelSubscriptionRequest {
	channels?: unknown
}

export interface ChannelSubscriptionAck {
	channels: string[]
}

function currentSubscriptions(socket: Socket): string[] {
	return [...socket.rooms].filter(
		(r) => r !== socket.id && Object.hasOwn(channelMap, r),
	)
}

function requestedChannels(
	data: ChannelSubscriptionRequest | undefined,
): string[] {
	return Array.isArray(data?.channels)
		? data.channels.filter((c: unknown) => typeof c === 'string')
		: []
}

async function applyChannelSubscription(
	socket: Socket,
	data: ChannelSubscriptionRequest | undefined,
	action: 'join' | 'leave',
	cb?: SocketAck<ChannelSubscriptionAck>,
): Promise<void> {
	const channels = requestedChannels(data)
	const validChannels = channels.includes('all')
		? ALL_CHANNELS
		: channels.filter((channel) => Object.hasOwn(channelMap, channel))

	for (const channel of validChannels) {
		await socket[action](channel)
	}

	cb?.({ channels: currentSubscriptions(socket) })
}

export function registerSubscriptionHandlers(socket: Socket): void {
	socket.on(
		inboundEvents.subscribe,
		async (
			data: ChannelSubscriptionRequest | undefined,
			cb?: SocketAck<ChannelSubscriptionAck>,
		) => {
			await applyChannelSubscription(socket, data, 'join', cb)
		},
	)

	socket.on(
		inboundEvents.unsubscribe,
		async (
			data: ChannelSubscriptionRequest | undefined,
			cb?: SocketAck<ChannelSubscriptionAck>,
		) => {
			await applyChannelSubscription(socket, data, 'leave', cb)
		},
	)
}
