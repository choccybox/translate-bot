const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const isoCorrection = require('../defaults/isoCorrection.json');
const languageSelection = require('../defaults/languageSelection.json');

module.exports = async function handleSlashCommand(interaction) {
    const buttonCollectors = new Map();
    const selectCollectors = new Map(); // New map for select menu collectors

    if (!interaction.isCommand()) return;
    const userID = interaction.user.id;
    const userSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
    const guildID = interaction.guild.id;
    const members = userSettings[guildID].members;
    const user = members[userID];
    const member = interaction.member;
    const guildSettings = userSettings[guildID];
    const allowedSTA = guildSettings.allowedSTA;
    const roles = member.roles.cache;
    // check if one of user's roles is in allowedSTA or is admin
    const hasSTARole = roles.some(role => allowedSTA.includes(role.id) || member.permissions.has('Administrator'));
    const hasSTARoleRenamed = hasSTARole ? '**yes**' : '**no**';

    function saveGuildSettings(guildSettings) {
        try {
          fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
        } catch (error) {
          console.error('Error saving guild settings:', error);
        }
      }

    // check if user id is in the guild, read from ../database/userSettingDefaults.json
    if (!userSettings[guildID].members[userID]) {
        userSettings[guildID].members[userID] = JSON.parse(fs.readFileSync('./defaults/userSettingDefaults.json', 'utf8'));

        // modify managed line by getting if user is administrator or server owner, write true or false
        if (member.permissions.has('Administrator') || member.permissions.has('ManageGuild')) {
            userSettings[guildID].members[userID].managed = true;
        } else {
            userSettings[guildID].members[userID].managed = false;
        }
        userSettings[guildID].members[userID].name = interaction.user.username;
        saveGuildSettings(userSettings);
    }

    // get member settings
    const userSettingsWrite = userSettings[guildID].members[userID];
    const AIResetIn = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8')).AIResetIn;
    
    const embedTitle = 'user settings for **@' + interaction.user.username + '**';
    const embedColor = 2829617;

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
            embeds: [{
            title: embedTitle,
            fields: [
                {
                name: 'reply as bot',
                value: (userSettingsWrite.replyAsBot ? '**yes**' : '**no**') + '\n\n',
                inline: true
                },
                {
                name: 'translation language',
                value: ':flag_' + userSettingsWrite.translateLanguageCorrectedForDiscord + ':',
                inline: true
                },
                {
                name: 'can translate for all?',
                value: hasSTARoleRenamed,
                inline: true
                },
/*                 {
                name: 'AI uses remaning',
                value: userSettingsWrite.AIuses + ' uses, resets in **' + AIResetIn + '**',
                } */
            ],
            color: embedColor
            }],
            components: [row],
            ephemeral: true
        });

        const replyAsBotButtonFilter = (i) => i.customId === 'change-replyasbot' && i.user.id === interaction.user.id;
        const replyAsBotButtonCollector = interaction.channel.createMessageComponentCollector({ filter: replyAsBotButtonFilter, time: 15000 });
        
        replyAsBotButtonCollector.on('collect', async (i) => {
            try {
                userSettingsWrite.replyAsBot = !userSettingsWrite.replyAsBot;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(userSettings, null, 4), 'utf8');
        
                await i.update({
                    embeds: [
                        {
                            title: embedTitle,
                            description:
                                'reply as bot: ' +
                                (userSettingsWrite.replyAsBot ? '**yes**' : '**no**') +
                                '\n\n' +
                                'translation language: ' +
                                ':flag_' + userSettingsWrite.translateLanguageCorrectedForDiscord + ':' +
                                '\n\n' +
                                'can translate for all?: ' + hasSTARoleRenamed,
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

        const changeTranslateLanguageButtonFilter = (i) => i.customId === 'change-translatelanguage' && i.user.id === interaction.user.id;
        const changeTranslateLanguageButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeTranslateLanguageButtonFilter, time: 60000 });

        // reply with a select menu with language options
        changeTranslateLanguageButtonCollector.on('collect', async (i) => {
            currentIndex = 0;
            // reset index if it's not the first time the button is clicked
            //console.log(currentIndex);
            // remove the previous select collector if it exists
            const selectCollector = selectCollectors.get(i.message.id);
            if (selectCollector) {
                selectCollector.stop();
                selectCollectors.delete(i.message.id);
            }

            // split the language selection into chunks of 25
            const languageSelectionChunks = languageSelection.reduce((resultArray, item, index) => {
                const chunkIndex = Math.floor(index / 25);
                if (!resultArray[chunkIndex]) {
                    resultArray[chunkIndex] = []; // start a new chunk
                }
                resultArray[chunkIndex].push(item);
                return resultArray;
            }, []);

/*             if (process.env.DISABLE_DEBUG === 'false') {
                console.log(`Created ${selectMenus.length} select menus with a total of ${languageSelection.length} entries`);
            } */

            // create a select menu with language options
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('language-select')
                .setPlaceholder('select language')
                .addOptions(languageSelectionChunks[0]);

            const prevBtn = new ButtonBuilder()
                .setCustomId('language-prev')
                .setLabel('previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const nextBtn = new ButtonBuilder()
                .setCustomId('language-next')
                .setLabel('next')
                .setStyle(ButtonStyle.Secondary);

            // send the select menu
            const selectMessage = await i.update({
                embeds: [{
                    title: "user translate language",
                    description: 'select the language you want to translate messages to.',
                    color: embedColor,
                }],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    new ActionRowBuilder().addComponents(prevBtn, nextBtn)
                ],
                ephemeral: true,
            });

            const previousFilter = i => i.customId === 'language-prev' && i.user.id === interaction.user.id;
            const nextFilter = i => i.customId === 'language-next' && i.user.id === interaction.user.id;

            const newPrevCollector = interaction.channel.createMessageComponentCollector({ filter: previousFilter, time: 60000 });
            const newNextCollector = interaction.channel.createMessageComponentCollector({ filter: nextFilter, time: 60000 });

            const lastIndex = languageSelectionChunks.length - 1;

            // when the next button is clicked, add +1 to the index of the language selection and update the select menu while enabling previous button
            newNextCollector.on('collect', async (interaction) => {
                const nextIndex = currentIndex + 1;
                //console.log('current index: ' + nextIndex);

                if (nextIndex < lastIndex) {
                    selectMenu.setOptions(languageSelectionChunks[nextIndex]);
                    prevBtn.setDisabled(false);
                } else {
                    selectMenu.setOptions(languageSelectionChunks[lastIndex]);
                    nextBtn.setDisabled(true);
                }

                await interaction.update({
                    embeds: [{
                        title: "user translate language",
                        description: 'select the language you want to translate messages to.',
                        color: embedColor,
                    }],
                    components: [
                        new ActionRowBuilder().addComponents(selectMenu),
                        new ActionRowBuilder().addComponents(prevBtn, nextBtn)
                    ],
                    ephemeral: true,
                });

                currentIndex = nextIndex;
            });

            // when the previous button is clicked, subtract -1 from the index of the language selection and update the select menu while enabling next button
            newPrevCollector.on('collect', async (interaction) => {
                // get current index knowing that the first index is 0
                const prevIndex = currentIndex - 1;

                //console.log('current index: ' + prevIndex);

                if (prevIndex > 0) {
                    selectMenu.setOptions(languageSelectionChunks[prevIndex]);
                    nextBtn.setDisabled(false);
                } else {
                    selectMenu.setOptions(languageSelectionChunks[0]);
                    prevBtn.setDisabled(true);
                }

                await interaction.update({
                    embeds: [{
                        title: "user translate language",
                        description: 'select the language you want to translate messages to.',
                        color: embedColor,
                    }],
                    components: [
                        new ActionRowBuilder().addComponents(selectMenu),
                        new ActionRowBuilder().addComponents(prevBtn, nextBtn)
                    ],
                    ephemeral: true,
                });

                currentIndex = prevIndex;
            });

            // create a collector for select menu interactions
            const selectFilter = i => i.customId === 'language-select' && i.user.id === interaction.user.id;
            const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000 });

            newSelectCollector.on('collect', async selectInteraction => {
                newSelectCollector.stop();
                newNextCollector.stop();
                newPrevCollector.stop();
                selectCollectors.delete(selectInteraction.message.id); // remove the collector when done
                currentIndex = 0;
                //console.log(currentIndex);
                try {
                    // get the selected language
                    const selectedLanguage = selectInteraction.values[0];
                    // update the user settings with the selected language
                    user.translateLanguage = selectedLanguage;
                    // update corrected language for discord
                    user.translateLanguageCorrectedForDiscord = isoCorrection[selectedLanguage];
                    fs.writeFileSync('./database/guilds.json', JSON.stringify(userSettings, null, 4), 'utf8');

                    // update the embed with the new language
                    await selectInteraction.update({
                        embeds: [{
                            title: embedTitle,
                            description: 
                             'reply as bot: ' + (userSettingsWrite.replyAsBot ? '**yes**' : '**no**') + '\n\n' +
                            'translation language: ' + ':flag_' + isoCorrection[selectedLanguage] + ':' + '\n\n' +
                            'can translate for all?: ' + hasSTARoleRenamed,
                            color: embedColor,
                        }],
                        components: [row],
                        ephemeral: true,
                    });

                    console.log('user has updated server language to: ' + selectedLanguage);
                } catch (error) {
                    console.error('An error occurred:', error);
                    await selectInteraction.reply('An error occurred while updating server language. Please try again later.');
                }
            });
        });

}
};