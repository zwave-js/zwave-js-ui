#!/usr/bin/env node
/* eslint-disable no-useless-escape */

/**
 * Module dependencies.
 */
import jsonStore from '../lib/jsonStore'
import store from '../config/store'
import * as conf from '../config/app'
import app, { startServer } from '../app'

console.log(
	`  ______  __          __                      _  _____     _    _ _____ \n |___  /  \\ \\        / /                     | |/ ____|   | |  | |_   _|\n    / /____\\ \\  /\\  / /_ ___   _____         | | (___     | |  | | | |  \n   / /______\\ \\/  \\/ / _\' \\ \\ / / _ \\    _   | |\\___ \\    | |  | | | |  \n  / /__      \\  /\\  / (_| |\\ V /  __/   | |__| |____) |   | |__| |_| |_ \n /_____|      \\/  \\/ \\__,_| \\_/ \\___|    \\____/|_____/     \\____/|_____|\n`,
)

// jsonstore is a singleton instance that handles the json configuration files
// used in the application. Init it before anything else than start app.
// if jsonstore fails exit the application
jsonStore
	.init(store)
	.then(() => {
		/**
		 * Normalize a port into a number, string, or false.
		 */

		function normalizePort(val: string | number) {
			const port = typeof val === 'string' ? parseInt(val, 10) : val

			if (isNaN(port)) {
				// named pipe
				return val
			}

			if (port >= 0) {
				// port number
				return port
			}

			throw Error(`Port ${port} is not valid`)
		}

		/**
		 * Get port from environment and store in Express.
		 */

		const port = normalizePort(conf.port)
		app.set('port', port)

		return startServer(port, conf.host)
	})
	.catch((err: unknown) => {
		console.error(err)
		process.exit(1)
	})
