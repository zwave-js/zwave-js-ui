import Logger from 'js-logger'

Logger.useDefaults({
	defaultLevel:
		import.meta.env.MODE === 'production' ? Logger.WARN : Logger.DEBUG,
})

export default Logger
