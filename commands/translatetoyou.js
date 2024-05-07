const translateMessageToEnglish = require('./translateworker.js');
const fs = require('fs');

let storedMessageID = null;

module.exports = async function handleContextMenuCommand(interaction) {
    if (!interaction.isMessageContextMenuCommand() || interaction.commandName !== 'translate to you') return;

    const targetMessage = interaction.targetMessage;
    let targetContent = targetMessage.content; // Use let to make it mutable

    // read from guild users translateLanguage
    const guildId = interaction.guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json'));
    const userLang = guildSettings[guildId]?.members.find(member => member.id === interaction.user.id)?.translateLanguage;
    
    try {
        if (targetContent) {
            // Translate the message to the user's preferred language
            const translatedToPreferredLanguage = await translateMessageToEnglish(targetContent, interaction, userLang);

            if (targetMessage.attachments.size > 0) {
                const attachment = targetMessage.attachments.first();
                interaction.reply({
                    content: translatedToPreferredLanguage,
                    files: [attachment.url],
                    ephemeral: true,
                });
            } else {
                interaction.reply({
                    content: translatedToPreferredLanguage,
                    ephemeral: true,
                });
                console.log(translatedToPreferredLanguage);

                storedMessageID = targetMessage.id;
            }
        }
    } catch (error) {
        console.error(error);
        interaction.reply({
            content: error.message,
            ephemeral: true,
        });
    }
};
