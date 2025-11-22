/// <reference path="types.d.ts" />
// @ts-check

/**
 * @param {{github: Github, context: Context, fetch: Fetch }} param
 */
async function main(param) {
	const { context, fetch } = param;

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

    // remove multiple spaces and put links between < > to prevent embeds
    const releaseNotes = context.payload.release.body.replace(/(\r\n+|\n+|\r+)/gm, '\n').replace(/(https:\/\/[^)]+)/g, '<$1>');

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

