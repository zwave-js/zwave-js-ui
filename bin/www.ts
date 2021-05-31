#!/usr/bin/env node

/**
 * Module dependencies.
 */
import * as jsonStore from '../lib/jsonStore'
import * as store from '../config/store.js'
import * as conf from '../config/app.js'

import { app, startServer } from '../app.js'

console.log(`
 ______                       _     ___                  _   _   
|___  /                      (_)   |__ \\                | | | |  
   / /_      ____ ___   _____ _ ___   ) |_ __ ___   __ _| |_| |_ 
  / /\\ \\ /\\ / / _\` \\ \\ / / _ \\ / __| / /| '_ \` _ \\ / _\` | __| __|
 / /__\\ V  V / (_| |\\ V /  __/ \\__ \\/ /_| | | | | | (_| | |_| |_ 
/_____|\\_/\\_/ \\__,_| \\_/ \\___| |___/____|_| |_| |_|\\__, |\\__|\\__|
                            _/ |                      | |        
                           |__/                       |_|        
`)

// jsonstore is a singleton instance that handles the json configuration files
// used in the application. Init it before anything else than start app.
// if jsonstore fails exit the application
jsonStore.init(store)
  .then(() => {
    

    /**
     * Normalize a port into a number, string, or false.
     */

    function normalizePort (val: string) {
      const port = parseInt(val, 10)

      if (isNaN(port)) {
        // named pipe
        return val
      }

      if (port >= 0) {
        // port number
        return port
      }

      return false
    }

    /**
     * Get port from environment and store in Express.
     */

    const port = normalizePort(conf.port)
    app.set('port', port)

    return startServer(conf.host, port)
  })
  .catch((err: any) => {
    console.error(err)
    process.exit(1)
  })
