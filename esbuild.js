const esbuild = require('esbuild')
const { cp, stat, readFile, writeFile } = require('fs/promises')
const { exists, emptyDir } = require('fs-extra')
const { join } = require('path')

const outputDir = 'build'

function cleanPkgJson(json) {
	delete json.devDependencies
	delete json['release-it']
	delete json.optionalDependencies
	delete json.dependencies
	return json
}

/**
 * Remove useless fields from package.json, this is needed mostly for `pkg`
 * otherwise it will try to bundle dependencies
 */
async function patchPkgJson(path) {
	const pkgJsonPath = join(outputDir, path, 'package.json')
	const pkgJson = require('./' + pkgJsonPath)
	cleanPkgJson(pkgJson)
	delete pkgJson.scripts
	await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
}

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

async function printSize(fileName) {
	const stats = await stat(fileName)

	// print size in MB
	console.log(`Bundle size: ${Math.round(stats.size / 10000) / 100}MB\n\n`)
}

async function main() {
	const start = Date.now()
	// clean build folder
	await emptyDir(outputDir)

	const outfile = `${outputDir}/index.js`

	const externals = [
		'@serialport/bindings-cpp/prebuilds',
		'zwave-js/package.json',
		'@zwave-js/server/package.json',
		'@zwave-js/config/package.json',
		'@zwave-js/config/config',
		'@zwave-js/config/build',
		'./snippets',
		'./dist',
	]

	/** @type { import('esbuild').BuildOptions } */
	const config = {
		entryPoints: [
			process.argv.includes('--js-entrypoint')
				? 'server/bin/www.js'
				: 'api/bin/www.ts',
		],
		plugins: [nativeNodeModulesPlugin],
		bundle: true,
		platform: 'node',
		target: 'node18',
		sourcemap: process.argv.includes('--sourcemap'),
		outfile,
		// suppress direct-eval warning
		logOverride: {
			'direct-eval': 'silent',
		},
		external: externals,

		// Prevent esbuild from adding a "2" to the names of CC classes for some reason.
		keepNames: true,

		// Fix import.meta.url in CJS output
		define: {
			'import.meta.url': '__import_meta_url',
		},
		inject: ['esbuild-import-meta-url-shim.js'],
	}

	await esbuild.build(config)

	console.log(`Build took ${Date.now() - start}ms`)
	await printSize(outfile)

	const content = (await readFile(outfile, 'utf-8'))
		.replace(
			/__dirname, "\.\.\/"/g,
			'__dirname, "./node_modules/@serialport/bindings-cpp"',
		)
		.replace(
			`"../../package.json"`,
			`"./node_modules/@zwave-js/server/package.json"`,
		)

	await writeFile(outfile, content)

	if (process.argv.includes('--minify')) {
		// minify the file
		await esbuild.build({
			...config,
			entryPoints: [outfile],
			minify: true,
			keepNames: true, // needed for zwave-js as it relies on class names
			allowOverwrite: true,
			outfile,
		})

		console.log(`Minify took ${Date.now() - start}ms`)
		await printSize(outfile)
	}

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

	// create main patched packege.json
	const pkgJson = require('./package.json')
	cleanPkgJson(pkgJson)

	pkgJson.scripts = {
		start: 'node index.js',
	}

	pkgJson.bin = 'index.js'
	pkgJson.pkg = {
		assets: ['dist/**', 'snippets/**', 'node_modules/**'],
	}

	await writeFile(
		`${outputDir}/package.json`,
		JSON.stringify(pkgJson, null, 2),
	)

	await patchPkgJson('node_modules/@zwave-js/config')
	await patchPkgJson('node_modules/zwave-js')
	await patchPkgJson('node_modules/@zwave-js/server')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
