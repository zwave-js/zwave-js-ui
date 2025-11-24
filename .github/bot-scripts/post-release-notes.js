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

        // Discord webhook limits:
        // - content field: 2000 characters
        // - embed description: 4096 characters
        // - total embeds: 10 per message
        const MAX_CONTENT_LENGTH = 2000;
        const MAX_EMBED_LENGTH = 4096;

        let payload;

        if (releaseNotes.length <= MAX_CONTENT_LENGTH) {
            // Short message - use content field directly
            payload = { content: releaseNotes };
        } else if (releaseNotes.length <= MAX_EMBED_LENGTH) {
            // Medium message - use embed with description
            payload = {
                embeds: [{
                    description: releaseNotes,
                    color: 0x0099ff
                }]
            };
        } else {
            // Long message - split into multiple embeds
            const chunks = [];
            let currentChunk = '';
            const lines = releaseNotes.split('\n');

            for (const line of lines) {
                // Check if adding this line would exceed the limit
                const separator = currentChunk ? '\n' : '';
                const potentialChunk = currentChunk + separator + line;
                
                if (potentialChunk.length <= MAX_EMBED_LENGTH) {
                    // Line fits in current chunk
                    currentChunk = potentialChunk;
                } else {
                    // Line doesn't fit, save current chunk if not empty
                    if (currentChunk) {
                        chunks.push(currentChunk);
                        currentChunk = '';
                    }
                    
                    // If this single line is too long, split it
                    if (line.length > MAX_EMBED_LENGTH) {
                        for (let i = 0; i < line.length; i += MAX_EMBED_LENGTH) {
                            chunks.push(line.substring(i, i + MAX_EMBED_LENGTH));
                        }
                    } else {
                        // Line fits on its own, start new chunk with it
                        currentChunk = line;
                    }
                }
            }
            if (currentChunk) {
                chunks.push(currentChunk);
            }

            // Discord allows up to 10 embeds per message
            const embeds = chunks.slice(0, 10).map((chunk, index) => {
                const embed = {
                    description: chunk,
                    color: 0x0099ff
                };
                if (index === 0) {
                    embed.title = 'Release Notes';
                }
                return embed;
            });

            payload = { embeds };

            if (chunks.length > 10) {
                console.warn(`Release notes exceed Discord's 10 embed limit (${chunks.length} total chunks). Only the first 10 embeds will be posted; remaining content is lost.`);
            }
        }

        const response = await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            console.log('Release notes posted to Discord successfully.');
        } else {
            const responseText = await response.text();
            console.error('Failed to post release notes to Discord:', response.status, response.statusText);
            console.error('Response body:', responseText);
        }
    } catch (error) {
        console.error('Error posting release notes to Discord:', error);
    }
}
export default main;

