export type SocketAck<T> = (result: T) => void

export const noop = (): void => {}
