const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const isoCorrection = require('../database/isoCorrection.json');
const languageSelection = require('../database/languageSelection.json');

module.exports = async function handleSlashCommand(interaction) {
    const buttonCollectors = new Map();
    const selectCollectors = new Map(); // New map for select menu collectors

    if (!interaction.isCommand()) return;
    const userID = interaction.user.id;
    const userSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    // check if user id is in the guild
    const guildID = interaction.guild.id;
    if (!userSettings[guildID].members[userID]) {
        userSettings[guildID].members[userID] = {
            name: interaction.user.username,
            replyAsBot: false,
            translateLanguage: 'en',
            translateLanguageCorrectedForDiscord: 'us',
            managed: interaction.member.permissions.has('Administrator') || userID === interaction.guild.ownerId
        };
        fs.writeFileSync('./database/guilds.json', JSON.stringify(userSettings, null, 4), 'utf8');
    }

    const members = userSettings[guildID].members;
    const user = members[userID];

    const embedTitle = 'user settings for **@' + interaction.user.username + '**';
    const embedColor = 2829617;
    const firstMessage =
        'reply as bot: ' +
        (user.replyAsBot ? '**yes**' : '**no**') +
        '\n\n' +
        'translation language: ' +
        ':flag_' + user.translateLanguageCorrectedForDiscord + ':';

    if (interaction.commandName === 'user') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('change-replyasbot')
                .setLabel('change reply as bot')
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId('change-translatelanguage')
                .setLabel('change translation language')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [
                {
                    title: embedTitle,
                    description: firstMessage,
                    color: embedColor
                }
            ],
            components: [row],
            ephemeral: true
        });

        const replyAsBotButtonFilter = (i) => i.customId === 'change-replyasbot' && i.user.id === interaction.user.id;
        const replyAsBotButtonCollector = interaction.channel.createMessageComponentCollector({ filter: replyAsBotButtonFilter, time: 15000 });
        
        replyAsBotButtonCollector.on('collect', async (i) => {
            try {
                user.replyAsBot = !user.replyAsBot;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(userSettings, null, 4), 'utf8');
        
                await i.update({
                    embeds: [
                        {
                            title: embedTitle,
                            description:
                                'reply as bot: ' +
                                (user.replyAsBot ? '**yes**' : '**no**') +
                                '\n\n' +
                                'translation language: ' +
                                ':flag_' + user.translateLanguageCorrectedForDiscord + ':',
                            color: embedColor
                        }
                    ],
                    components: [row],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error handling replyAsBotButtonCollector:', error);
                // Optionally, you can inform the user about the error here
            }
        });
        
        replyAsBotButtonCollector.on('error', (error) => {
            console.error('Error in replyAsBotButtonCollector:', error);
            // Optionally, you can inform the user about the error here
        });
        

        buttonCollectors.set('change-replyasbot', replyAsBotButtonCollector);

        const translateLanguageButtonFilter = (i) => i.customId === 'change-translatelanguage' && i.user.id === interaction.user.id;
        const translateLanguageButtonCollector = interaction.channel.createMessageComponentCollector({ filter: translateLanguageButtonFilter, time: 15000 });

        translateLanguageButtonCollector.on('collect', async (i) => {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-translatelanguage')
                .setPlaceholder('select a language')
                .addOptions(languageSelection);

            await i.update({
                embeds: [
                    {
                        title: 'change your translation language',
                        color: embedColor
                    }
                ],
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                ephemeral: true
            });

            const selectCollector = interaction.channel.createMessageComponentCollector({ filter: (selectInteraction) => selectInteraction.customId === 'select-translatelanguage' && selectInteraction.user.id === interaction.user.id, time: 15000 });

            selectCollector.on('collect', async (selectInteraction) => {
                const selectedLanguage = selectInteraction.values[0]; // Assuming single select, get the value

                // correct value for discord using a map
                const correctedLanguage = isoCorrection[selectedLanguage] || selectedLanguage;

                user.translateLanguage = selectedLanguage;
                user.translateLanguageCorrectedForDiscord = correctedLanguage;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(userSettings, null, 4), 'utf8');

                await selectInteraction.update({
                    embeds: [
                        {
                            title: embedTitle,
                            description:
                                'reply as bot: ' +
                                (user.replyAsBot ? '**yes**' : '**no**') +
                                '\n\n' +
                                'translation language: ' +
                                ':flag_' + correctedLanguage + ':',
                            color: embedColor
                        }
                    ],
                    components: [row],
                    ephemeral: true
                });
            });

            selectCollectors.set('select-translatelanguage', selectCollector);
        });

        buttonCollectors.set('change-translatelanguage', translateLanguageButtonCollector);
    }
};
