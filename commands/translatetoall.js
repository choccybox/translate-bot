const translateMessageToEnglish = require('./translateworker.js'); // Assuming you have the translation function in a separate file called translate.js
const fs = require('fs');

const emojiReaction = [
    '<:catthumb:1235660903601541262>',
    '<:catthumb2:1235660901571624971>',
    '<:catthumb3:1235660900057354320>',
    '<:catthumb4:1235660898408992818>',
]

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate to all') {
        // before running, check if user has atleast one of the mapped role ids or permissions
        const member = interaction.member;
        const guildID = interaction.guild.id;
        // read server.json file
        const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        const allowedTTA = guildSettings[guildID].allowedTTA;
        const isAdmin = member.permissions.has('ADMINISTRATOR');

        // check if user has atleast one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedTTA.includes(role.id) || isAdmin);
        // if one of the conditions is met, continue, otherwise end interaction
        if (!hasRole) {
            console.log(`user ${member.user.username} does not have permissions.`);
            interaction.reply({
                content: 'You do not have the required permissions or roles to use this command.',
                ephemeral: true,
            });
            return;
        } else {
            console.log(`user ${member.user.username} has the required permissions.`);
        }

        const targetMessage = interaction.targetMessage;
        const targetContent = targetMessage.content;
        const guildTranslateLang = guildSettings[guildID].guildTranslateLanguage;

        translateMessageToEnglish(targetContent, interaction, guildTranslateLang)
            .then((translatedMessage) => {

                // if message includes "this message is already in..." return
                if (translatedMessage.includes('this message is already in')) {
                    interaction.reply({
                        content: translatedMessage,
                        ephemeral: true,
                    });
                    return;
                } else if (targetMessage.attachments.size > 0) {
                    const attachment = targetMessage.attachments.first();

                    targetMessage.reply({
                        content: translatedMessage,
                        allowedMentions: { repliedUser: false },
                    });

                    interaction.reply({
                        content: `${emojiReaction[Math.floor(Math.random() * emojiReaction.length)]}`,
                        files: [attachment.url],
                        ephemeral: true,
                    });
                } else {
                    targetMessage.reply({
                        content: translatedMessage,
                        allowedMentions: { repliedUser: false },
                    });

                    interaction.reply({
                        content: `${emojiReaction[Math.floor(Math.random() * emojiReaction.length)]}`,
                        ephemeral: true,
                    });
                }
            })
            .catch((error) => {
                console.error(error);
                interaction.reply({
                    content: errorMsg,
                    ephemeral: true,
                });
            });
    }
};