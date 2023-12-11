const esbuild = require('esbuild')
const { cp, stat } = require('fs/promises')
const pkgJson = require('./package.json')
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

	const outfile = `${outputDir}/src/bin/index.js`

	await esbuild.build({
		entryPoints: ['api/bin/www.ts'],
		plugins: [nativeNodeModulesPlugin],
		bundle: true,
		platform: 'node',
		target: 'node18',
		outfile,
		// suppress direct-eval warning
		logOverride: {
			'direct-eval': 'silent',
		},
		external: ['serialport', '@zwave-js/config', 'zwave-js/package.json'],
	})

	// copy assets to build folder
	for (let asset of pkgJson.pkg.assets) {
		// resolve glob assets
		asset = asset.replace('/**/*', '').replace('/**', '')

		// only copy bindings-cpp folder if serialport is used
		if (asset.includes('@serialport')) {
			asset += '/bindings-cpp'
		}

		if (await exists(asset)) {
			console.log(`Copying ${asset} to ${outputDir} folder`)
			await cp(asset, `${outputDir}/${asset}`, { recursive: true })
		} else {
			console.log(`Asset ${asset} does not exist. Skipping...`)
		}
	}

	const end = Date.now()

	console.log(`\n\nBuild took ${end - start}ms`)

	const stats = await stat(outfile)

	// print size in MB
	console.log(`Bundle size: ${Math.round(stats.size / 10000) / 100}MB`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
