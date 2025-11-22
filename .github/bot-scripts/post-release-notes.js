/// <reference path="types.d.ts" />
// @ts-check

// Note: This script uses ESM exports (export default) because it's used with
// actions/github-script@v8 which runs in ESM context. Other bot scripts use
// CommonJS (module.exports) because they're used with older github-script
// versions (v3, v7) that support CommonJS.

/**
 * @param {{github: Github, context: Context, fetch: Fetch }} param
 */
async function main(param) {
	const { github, context, fetch } = param;

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

    let releaseBody;
    
    // Check if this is a release event or manual workflow dispatch
    if (context.payload.release) {
        // Triggered by release event
        releaseBody = context.payload.release.body;
    } else {
        // Triggered by workflow_dispatch, fetch the latest release
        try {
            console.log('Fetching latest release...');
            const { data: latestRelease } = await github.rest.repos.getLatestRelease({
                owner: context.repo.owner,
                repo: context.repo.repo,
            });
            
            if (!latestRelease || !latestRelease.body) {
                console.error('No release body found in latest release');
                return;
            }
            
            releaseBody = latestRelease.body;
            console.log(`Found latest release: ${latestRelease.name || latestRelease.tag_name}`);
        } catch (error) {
            console.error('Failed to fetch latest release:', error);
            return;
        }
    }

    if (!releaseBody) {
        console.error('No release body available to post');
        return;
    }

    // remove multiple spaces and put links between < > to prevent embeds
    const releaseNotes = releaseBody.replace(/(\r\n+|\n+|\r+)/gm, '\n').replace(/(https:\/\/[^)]+)/g, '<$1>');

    try {
        console.log('Posting release notes to Discord...');
        console.log(releaseNotes);

        const response = await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: releaseNotes }),
        });

        if (response.ok) {
            console.log('Release notes posted to Discord successfully.');
        } else {
            console.error('Failed to post release notes to Discord:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error posting release notes to Discord:', error);
    }
}
export default main;

