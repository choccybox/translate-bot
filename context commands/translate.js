const translateMessageToEnglish = require('../backbone/texttranslateworker.js'); // Assuming you have the translation function in a separate file called translate.js
const fs = require('fs');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-translateall')
        .setLabel('send to all?')
        .setStyle(ButtonStyle.Danger),
];

const emojiReaction = [
    '<:catthumb:1235660903601541262>',
    '<:catthumb2:1235660901571624971>',
    '<:catthumb3:1235660900057354320>',
    '<:catthumb4:1235660898408992818>',
]

let storedMessageID = null;

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate') {
        // before running, check if user has atleast one of the mapped role ids or permissions
        const member = interaction.member;
        const guildID = interaction.guild.id;
        // read server.json file
        const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        const allowedSTA = guildSettings[guildID].allowedSTA;
        const isAdmin = member.permissions.has('ADMINISTRATOR');

        // check if user has atleast one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id) || isAdmin);
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
        console.log(`guild translate language: ${guildTranslateLang}`);

        translateMessageToEnglish(targetContent, interaction, guildTranslateLang)
        .then((translatedMessage) => {
            if (translatedMessage.includes('this message is already in')) {
                interaction.reply({
                    content: translatedMessage,
                    ephemeral: true,
                });
                return;
            } else if (hasRole){
                interaction.reply({
                    content: translatedMessage,
                    ephemeral: true,
                    components: [new ActionRowBuilder().addComponents(buttons)],
                });

                // store the message id, not the interaction id
                storedMessageID = targetMessage.id;
                console.log(`stored message id: ${storedMessageID}`);

                const sendTranslationToAllButtonFilter = (i) => i.customId === 'confirm-translateall' && i.user.id === interaction.user.id;
                const sendTranslationToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendTranslationToAllButtonFilter, time: 15000 });

                sendTranslationToAllCollector.on('collect', async (i) => {
                    // Send translated message to the channel
                    await interaction.channel.send({
                        content: translatedMessage,
                        allowedMentions: { repliedUser: false },
                        reply: { messageReference: storedMessageID },
                    });

                    // Update the interaction message
                    await i.update({
                        content: emojiReaction[Math.floor(Math.random() * emojiReaction.length)],
                        components: [],
                    });
                });
            } else {
                interaction.reply({
                    content: errorMsg,
                    ephemeral: true,
                });
            
            }
        })
        .catch((error) => {
            console.error(error);
            interaction.reply({
                content: translatedMessage,
                ephemeral: true,
            });
        });
}
};