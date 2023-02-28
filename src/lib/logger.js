import Logger from 'js-logger'

Logger.useDefaults({
	defaultLevel:
		process.env.NODE_ENV === 'production' ? Logger.WARN : Logger.DEBUG,
})

export default Logger
