import { Driver } from 'zwave-js'

export const enumerateSerialPorts: typeof Driver.enumerateSerialPorts =
	Driver.enumerateSerialPorts.bind(Driver)
