const translateMessageToEnglish = require('../../backbone/texttranslateworker.js'); // Assuming you have the translation function in a separate file called translate.js
const fs = require('fs');
const dotenv = require('dotenv');

// load environment variables
dotenv.config();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, } = require('discord.js');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-translateall')
        .setLabel('send to this channel')
        .setStyle(ButtonStyle.Danger),
];

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate text') {
    const targetMessage = interaction.options.getMessage('message');
    const text = targetMessage.content;
    console.log(text);

    await interaction.deferReply({ ephemeral: 'true'})

    const guildID = interaction.guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    const memberID = interaction.user.id;
    const member = interaction.member;
        
    const allowedSTA = guildSettings[guildID].allowedSTA;
    const isGuildOwner = memberID === guildSettings[guildID].owner;
    const isAdmin = member.permissions.has('Administrator');
    const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id)) || isGuildOwner || isAdmin;
    const replyAsBot = guildSettings[guildID].members[memberID] ? guildSettings[guildID].members[memberID].replyAsBot : false;
    const hasSTA = guildSettings[guildID].members[memberID] ? guildSettings[guildID].members[memberID].allowedSTA : '';

    const selectedLanguage = guildSettings[guildID].members[memberID] ? guildSettings[guildID].members[memberID].translateLanguage : 'en';

    if (!text || text === '') {
        interaction.editReply({
            content: 'this message doesn\'t contain any text',
            ephemeral: true
        });
    } else {
        await translateMessageToEnglish(text, interaction, selectedLanguage)
        .then(translatedText => {
            const text = translatedText[0].alreadyInLang;
            const inLang = translatedText[0].inLang;
            if (inLang === true) {
                // get the text message and remove "/servers" from the message
                const message = text.replace(/\/servers/g, '');
                interaction.editReply({
                    content: message,
                    ephemeral: true
                });
                return;
            } else if (inLang === false && !hasRole) {
                interaction.editReply({
                    content: text,
                    ephemeral: true
                });
                return;
            } else if (inLang === false && hasRole || hasSTA) {
                const actionRow = new ActionRowBuilder()
                    .addComponents(buttons);

                interaction.editReply({
                    content: text,
                    components: [actionRow],
                    ephemeral: true
                });

                const STAfilter = i => i.customId === 'confirm-translateall' && i.user.id === interaction.user.id;
                const STAcollector = interaction.channel.createMessageComponentCollector({ STAfilter, time: 15000 });

                STAcollector.on('collect', async i => {
                    if (i.customId === 'confirm-translateall') {
                        interaction.editReply({
                            content: 'done! :3',
                            components: [],
                            ephemeral: true
                        });

                        if (replyAsBot === false) {
                            const webhook = await interaction.channel.createWebhook({
                                name: interaction.user.username,
                                avatar: interaction.user.displayAvatarURL()
                            });

                            await webhook.send({
                                content: text
                            });

                            await webhook.delete();
                        } else {
                            await interaction.channel.send(text);
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error(error);
            interaction.editReply({
                content: errorMsg,
                ephemeral: true
            });
        });
    }
    }
};