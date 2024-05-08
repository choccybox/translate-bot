const fs = require('fs');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');

const languageSelection = require('../database/languageSelection.json');
const isoCorrection = require('../database/isoCorrection.json');

const buttons = [
    new ButtonBuilder()
        .setCustomId('change-roles')
        .setLabel('change "translate to all" permissions')
        .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
        .setCustomId('change-brainrot')
        .setLabel('change "brainrot translation" permissions')
        .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
        .setCustomId('change-server-language')
        .setLabel('change server translate language')
        .setStyle(ButtonStyle.Secondary),
];

const roleSelectMenu = new RoleSelectMenuBuilder()
    .setCustomId('role-select')
    .setPlaceholder('Select roles')
    .setMinValues(1)
    .setMaxValues(25);


const embedTitle = 'server settings';
const embedColor = 2829617;

module.exports = async function handleSlashCommand(interaction) {
    const buttonCollectors = new Map();
    const selectCollectors = new Map();

    if (!interaction.isCommand()) return;
    const guildID = interaction.guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    const firstMessage = 
    '"translate to all" permitted roles: ' + (guildSettings[guildID].allowedTTA.length > 0 ? guildSettings[guildID].allowedTTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
    '\n\n' +
    '"translate to brainrot" permitted roles: ' + (guildSettings[guildID].allowedBrainrot.length > 0 ? guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') : '**none**') +
    '\n\n' +
    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':';

    if (interaction.commandName === 'server') {
        if (interaction.guild.ownerId === interaction.user.id || interaction.member.permissions.has('ADMINISTRATOR')) {

            // send the row of buttons
            await interaction.reply({
                embeds: [{
                    title: embedTitle,
                    description: firstMessage,
                    color: embedColor,
                }],
                components: [new ActionRowBuilder().addComponents(buttons)],
                ephemeral: true,
            });

            const changeRolesButtonFilter = (i) => i.customId === 'change-roles' && i.user.id === interaction.user.id;
            const changeRolesButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeRolesButtonFilter, time: 15000 });

            changeRolesButtonCollector.on('collect', async (i) => {
                try {
                    const selectCollector = selectCollectors.get(i.message.id);
                    if (selectCollector) {
                        selectCollector.stop();
                        selectCollectors.delete(i.message.id);
                    }

                    // send the multi select menu
                    const selectMessage = await i.update({
                        embeds: [{
                            title: "translate to all permissions",
                            description: 'select the roles you want to allow to use "translate to all" command.',
                            color: embedColor,
                        }],
                        components: [new ActionRowBuilder().addComponents(roleSelectMenu)],
                        ephemeral: true,
                    });
                    //console.log('user clicked the button');

                    // create a collector for multi-select menu interactions
                    const selectFilter = i => i.customId === 'role-select' && i.user.id === interaction.user.id;
                    const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 15000 });

                    newSelectCollector.on('collect', async selectInteraction => {
                        newSelectCollector.stop();
                        selectCollectors.delete(selectInteraction.message.id); // remove the collector when done

                        try {
                            // get the selected roles
                            const selectedRoles = selectInteraction.values;

                            // update the server settings with the selected roles
                            guildSettings[guildID].allowedTTA = [...new Set([...guildSettings[guildID].allowedTTA, ...selectedRoles])];
                            fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));

                            // update the embed with the new roles
                            await selectInteraction.update({
                                embeds: [{
                                    title: embedTitle,
                                    description: '"translate to all" permitted roles: ' + guildSettings[guildID].allowedTTA.map(role => '<@&' + role + '>').join('  ')  +
                                    '\n\n' +
                                    '"translate to brainrot" permitted roles: ' + guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') +
                                    '\n\n' +
                                    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':',
                                    color: embedColor,
                                }],
                                components: [new ActionRowBuilder().addComponents(buttons)],
                                ephemeral: true,
                            });

                            console.log('user has updated permissions to: ' + selectedRoles);
                        } catch (error) {
                            console.error('An error occurred:', error);
                            await selectInteraction.reply('An error occurred while updating permissions. Please try again later.');
                        }
                    });

                    selectCollectors.set(selectMessage.id, newSelectCollector);

                buttonCollectors.set(interaction.id, changeRolesButtonCollector);

                } catch (error) {
                    console.error('An error occurred during role selection:', error);
                    await i.reply({ content: 'An error occurred while processing your request. Please try again later.', ephemeral: true });
                }
            });
    
            buttonCollectors.set('change-replyasbot', changeRolesButtonCollector); 
            } else {
                interaction.reply({ content: "you ain't the server owner bruh", ephemeral: true });
            }

            const changeBrainrotButtonFilter = (i) => i.customId === 'change-brainrot' && i.user.id === interaction.user.id;
            const changeBrainrotButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeBrainrotButtonFilter, time: 15000 });
    
            // reply with hi, thats it for now
            changeBrainrotButtonCollector.on('collect', async (i) => {
                try {
                    // remove the previous select collector if it exists
                    const selectCollector = selectCollectors.get(i.message.id);
                    if (selectCollector) {
                        selectCollector.stop();
                        selectCollectors.delete(i.message.id);
                    }

                    // send the multi select menu
                    const selectMessage = await i.update({
                        embeds: [{
                            title: "translate to brainrot permissions",
                            description: 'select the roles you want to allow to use "translate to brainrot" command.',
                            color: embedColor,
                        }],
                        components: [new ActionRowBuilder().addComponents(roleSelectMenu)],
                        ephemeral: true,
                    });
                    //console.log('user clicked the button');

                    // create a collector for multi-select menu interactions
                    const selectFilter = i => i.customId === 'role-select' && i.user.id === interaction.user.id;
                    const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 15000 });

                    newSelectCollector.on('collect', async selectInteraction => {
                        newSelectCollector.stop();
                        selectCollectors.delete(selectInteraction.message.id); // remove the collector when done

                        try {
                            // get the selected roles
                            const selectedRoles = selectInteraction.values;

                            // update the server settings with the selected roles
                            guildSettings[guildID].allowedBrainrot = [...new Set([...guildSettings[guildID].allowedTTA, ...selectedRoles])];

                            fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));

                            // update the embed with the new roles
                            await selectInteraction.update({
                                embeds: [{
                                    title: embedTitle,
                                    description: '"translate to all" permitted roles: ' + guildSettings[guildID].allowedTTA.map(role => '<@&' + role + '>').join('  ')  +
                                    '\n\n' +
                                    '"translate to brainrot" permitted roles: ' + guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') +
                                    '\n\n' +
                                    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':',
                                    color: embedColor,
                                }],
                                components: [new ActionRowBuilder().addComponents(buttons)],
                                ephemeral: true,
                            });

                            console.log('user has updated permissions to: ' + selectedRoles);
                        } catch (error) {
                            console.error('An error occurred:', error);
                            await selectInteraction.reply('An error occurred while updating permissions. Please try again later.');
                        }
                    });

                    selectCollectors.set(selectMessage.id, newSelectCollector);

                buttonCollectors.set(interaction.id, changeBrainrotButtonCollector);
            } catch (error) {
                console.error('An error occurred during role selection:', error);
                await i.reply({ content: 'An error occurred while processing your request. Please try again later.', ephemeral: true });
            }
        });

            const changeServerLanguageButtonFilter = (i) => i.customId === 'change-server-language' && i.user.id === interaction.user.id;
            const changeServerLanguageButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeServerLanguageButtonFilter, time: 15000 });

            // reply with a select menu with language options
            changeServerLanguageButtonCollector.on('collect', async (i) => {
                // remove the previous select collector if it exists
                const selectCollector = selectCollectors.get(i.message.id);
                if (selectCollector) {
                    selectCollector.stop();
                    selectCollectors.delete(i.message.id);
                }

                // create a select menu with language options
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('language-select')
                    .setPlaceholder('Select language')
                    .addOptions(languageSelection);

                // send the select menu
                const selectMessage = await i.update({
                    embeds: [{
                        title: "server translate language",
                        description: 'select the language you want to translate messages to.',
                        color: embedColor,
                    }],
                    components: [new ActionRowBuilder().addComponents(selectMenu)],
                    ephemeral: true,
                });

                // create a collector for select menu interactions
                const selectFilter = i => i.customId === 'language-select' && i.user.id === interaction.user.id;
                const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 15000 });

                newSelectCollector.on('collect', async selectInteraction => {
                    newSelectCollector.stop();
                    selectCollectors.delete(selectInteraction.message.id); // remove the collector when done

                    try {
                        // get the selected language
                        const selectedLanguage = selectInteraction.values[0];
                        // update the server settings with the selected language
                        guildSettings[guildID].guildTranslateLanguage = selectedLanguage;
                        // update corrected language for discord
                        guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord = isoCorrection[selectedLanguage] || selectedLanguage;
                        fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));

                        // update the embed with the new language
                        await selectInteraction.update({
                            embeds: [{
                                title: embedTitle,
                                description: 
                                 '"translate to all" permitted roles: ' + (guildSettings[guildID].allowedTTA.length > 0 ? guildSettings[guildID].allowedTTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
                                '\n\n' +
                                '"translate to brainrot" permitted roles: ' + (guildSettings[guildID].allowedBrainrot.length > 0 ? guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') : '**none**') +
                                '\n\n' +
                                'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':',
                                color: embedColor,
                            }],
                            components: [new ActionRowBuilder().addComponents(buttons)],
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
