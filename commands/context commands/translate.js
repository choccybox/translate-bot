const translateMessageToEnglish = require('../../backbone/texttranslateworker.js'); // Assuming you have the translation function in a separate file called translate.js
const fs = require('fs');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-translateall')
        .setLabel('send to this channel')
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
        const isAdmin = member.permissions.has('Administrator');

        // check if user has atleast one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id) || isAdmin);

        const targetMessage = interaction.targetMessage;
        const targetContent = targetMessage.content;
        const guildTranslateLang = guildSettings[guildID].guildTranslateLanguage;
        // console.log(`guild translate language: ${guildTranslateLang}`);

        const hasAttachment = targetMessage.attachments.size > 0;
        // get attachment url
        const attachmentURL = targetMessage.attachments.map((attachment) => attachment.url);

        translateMessageToEnglish(targetContent, interaction, guildTranslateLang)
        .then((translatedMessage) => {
            // get the :flag_xx: emoji from the translated language
            const flagEmoji = translatedMessage.match(/:flag_\w+:/g);
            if (translatedMessage.includes('this message is already in')) {
                interaction.reply({
                    content: 'this message is already in servers preffered language: ' + flagEmoji,
                    ephemeral: true,
                });
                return;
            } else {
                interaction.reply({
                    content: translatedMessage,
                    ephemeral: true,
                    files: hasAttachment ? attachmentURL : null,
                    components: hasRole ? [new ActionRowBuilder().addComponents(buttons)] : [],
                });
            } 
            
            // store the message id, not the interaction id
            storedMessageID = targetMessage.id;
            console.log(`stored message id: ${storedMessageID}`);

            const sendTranslationToAllButtonFilter = (i) => i.customId === 'confirm-translateall' && i.user.id === interaction.user.id;
            const sendTranslationToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendTranslationToAllButtonFilter, time: 15000 });

            sendTranslationToAllCollector.on('collect', async (i) => {
                    await interaction.channel.send({
                        content: translatedMessage,
                        allowedMentions: { repliedUser: false },
                        reply: { messageReference: storedMessageID },
                        files: hasAttachment ? attachmentURL : null,
                    });

                    // Update the interaction message
                    await i.update({
                        content: 'done! :3',
                        components: [],
                    });
                });
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