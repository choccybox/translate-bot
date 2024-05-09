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

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'

module.exports = async function handleSlashCommand(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'translate') {

    const targetMessage = interaction.options.getString('text');
    const targetLanguage = interaction.options.getString('language');

    translateMessageToEnglish(targetMessage, interaction, targetLanguage)
    .then((translatedMessage) => {
        // check if user is admin, owner or one of allowedSTA roles
        const memberID = interaction.user.id;
        const member = interaction.member;
        const guildID = interaction.guild.id;
        // read server.json file
        const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        
        const allowedSTA = guildSettings[guildID].allowedSTA;
        const isAdmin = memberID === guildSettings[guildID].owner || member.permissions.has('Administrator');        
        // check if user has atleast one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id) || isAdmin);
        const replyAsBot = guildSettings[guildID].members[memberID] ? guildSettings[guildID].members[memberID].replyAsBot : false;

        if (translatedMessage.includes('this message is already in')) {
         interaction.reply({
             content: translatedMessage,
             ephemeral: true,
         });
         return;
        } else if (hasRole) {
         interaction.reply({
             content: translatedMessage,
             ephemeral: true,
             components: [new ActionRowBuilder().addComponents(buttons)],
         });

         const sendTranslationToAllButtonFilter = (i) => i.customId === 'confirm-translateall' && i.user.id === interaction.user.id;
         const sendTranslationToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendTranslationToAllButtonFilter, time: 15000 });

         sendTranslationToAllCollector.on('collect', async (i) => {
            
             if (!replyAsBot) {
                console.log(`user ${member.user.username} has the required permissions and configured to send messages as them.`);
                const webhook = await interaction.channel.createWebhook({
                    name: interaction.user.globalName,
                    avatar: interaction.user.displayAvatarURL(),
                });
                await webhook.send({
                    content: translatedMessage,
                });
                await webhook.delete();

                await i.update({
                    content: emojiReaction[Math.floor(Math.random() * emojiReaction.length)],
                    components: [],
                });
            } else {
                console.log(`user ${member.user.username} has the required permissions and configured to send messages as bot.`);
                await interaction.channel.send({
                    content: translatedMessage,
                });
   
                // Update the interaction message
                await i.update({
                    content: emojiReaction[Math.floor(Math.random() * emojiReaction.length)],
                    components: [],
                });
            }
         });
        } else {
            interaction.reply({
                content: translatedMessage,
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