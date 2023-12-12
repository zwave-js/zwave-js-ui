const esbuild = require('esbuild')
const { cp, stat, readFile, writeFile } = require('fs/promises')
const { exists, emptyDir } = require('fs-extra')

const outputDir = 'build'

// from https://github.com/evanw/esbuild/issues/1051#issuecomment-806325487
const nativeNodeModulesPlugin = {
	name: 'native-node-modules',
	setup(build) {
		// If a ".node" file is imported within a module in the "file" namespace, resolve
		// it to an absolute path and put it into the "node-file" virtual namespace.
		build.onResolve({ filter: /\.node$/, namespace: 'file' }, (args) => ({
			path: require.resolve(args.path, { paths: [args.resolveDir] }),
			namespace: 'node-file',
		}))

		// Files in the "node-file" virtual namespace call "require()" on the
		// path from esbuild of the ".node" file in the output directory.
		build.onLoad({ filter: /.*/, namespace: 'node-file' }, (args) => ({
			contents: `
          import path from ${JSON.stringify(args.path)}
          try { module.exports = require(path) }
          catch {}
        `,
		}))

		// If a ".node" file is imported within a module in the "node-file" namespace, put
		// it in the "file" namespace where esbuild's default loading behavior will handle
		// it. It is already an absolute path since we resolved it to one above.
		build.onResolve(
			{ filter: /\.node$/, namespace: 'node-file' },
			(args) => ({
				path: args.path,
				namespace: 'file',
			}),
		)

		// Tell esbuild's default loading behavior to use the "file" loader for
		// these ".node" files.
		let opts = build.initialOptions
		opts.loader = opts.loader || {}
		opts.loader['.node'] = 'file'
	},
}

async function main() {
	const start = Date.now()
	// clean build folder
	await emptyDir(outputDir)

	const outfile = `${outputDir}/index.js`

	const externals = [
		'@serialport/bindings-cpp/prebuilds',
		'zwave-js/package.json',
		'@zwave-js/config/package.json',
		'@zwave-js/config/config',
		'@zwave-js/config/build',
		'./snippets',
		'./dist',
	]

	await esbuild.build({
		entryPoints: ['api/bin/www.ts'],
		plugins: [nativeNodeModulesPlugin],
		bundle: true,
		platform: 'node',
		target: 'node18',
		minify: true,
		// sourcemap: true,
		outfile,
		// suppress direct-eval warning
		logOverride: {
			'direct-eval': 'silent',
		},
		external: externals,
	})

	const end = Date.now()

	console.log(`Build took ${end - start}ms`)

	const stats = await stat(outfile)

	const content = (await readFile(outfile, 'utf-8'))
		.replace(
			/__dirname, "\.\.\/"/g,
			'__dirname, "./node_modules/@serialport/bindings-cpp"',
		)
		.replace(
			`__dirname, "../package.json"`,
			`__dirname, "./node_modules/@zwave-js/config/package.json"`,
		)
		.replace(
			`__dirname, "../config"`,
			`__dirname, "./node_modules/@zwave-js/config/config"`,
		)

	await writeFile(outfile, content)

	// print size in MB
	console.log(`Bundle size: ${Math.round(stats.size / 10000) / 100}MB\n\n`)

	// copy assets to build folder
	for (const ext of externals) {
		const path = ext.startsWith('./') ? ext : `node_modules/${ext}`
		if (await exists(path)) {
			console.log(`Copying "${path}" to "${outputDir}" folder`)
			await cp(path, `${outputDir}/${path}`, { recursive: true })
		} else {
			console.log(`Asset "${path}" does not exist. Skipping...`)
		}
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
