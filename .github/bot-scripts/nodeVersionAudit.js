/// <reference path="types.d.ts" />
// @ts-check
const fs = require('fs');
const childProcess = require('child_process');

const baseNodeTagMatch = new RegExp(/^FROM node:(\S+)/);

/**
 * @param {[string]} dockerfilePaths
 * @returns {Promise<Set<string>>}
 */
async function getNodeTagsFromDockerfile(dockerfilePaths) {
	const tags = new Set();
	try {
		for (const dockerfilePath of dockerfilePaths) {
			const dockerfile = fs.readFileSync(dockerfilePath, {encoding: 'utf8'});
			for (const line of dockerfile.split('\n')) {
				const matches = baseNodeTagMatch.exec(line);
				if (matches && matches.length === 2) {
					tags.add(matches[1])
				}
			}
		}
	} catch (err) {
		const errorMessage = `Unable to parse dockerfiles: ${dockerfilePaths}`
		console.error(errorMessage, err);
		throw new Error(errorMessage)
	}
	return tags;
}

/**
 * @param {Set<string>} tags
 * @returns {Promise<void>}
 */
async function runNodeVersionAuditForDockerTags(tags) {
	const options = {
		timeout: 600000 // 10 minutes
	}
	for (const tag of tags) {
		let out;
		try {
			out = childProcess.execFileSync('docker', ['run', '--rm', `node:${tag}`, 'npx', '--no-update-notifier', '--yes', 'node-version-audit@latest', '--fail-security'], options);
		} catch (error) {
			// non-zero exit code means either `--fail-security` failed, or something unknown happened
			console.error(error.stdout.toString());
			process.exit(error.status);
		}
		console.info(out.toString());
	}
}

async function main() {
	const dockerTags = await getNodeTagsFromDockerfile(['./docker/Dockerfile', './docker/Dockerfile.contrib',]);
	await runNodeVersionAuditForDockerTags(dockerTags);
	process.exit(0); // success - all secure
}

module.exports = main;
