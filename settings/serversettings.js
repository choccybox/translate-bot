const fs = require('fs');

const dotenv = require('dotenv');
dotenv.config();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');

const languageSelection = require('../defaults/languageSelection.json');
const isoCorrection = require('../defaults/isoCorrection.json');

const buttons = [
    new ButtonBuilder()
        .setCustomId('change-sta')
        .setLabel('send to all permissions')
        .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
        .setCustomId('change-serverlanguage')
        .setLabel('guild language')
        .setStyle(ButtonStyle.Secondary),
];

const roleSelectMenu = new RoleSelectMenuBuilder()
    .setCustomId('role-select')
    .setPlaceholder('select roles')
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
    '**send to all** permitted roles: ' + (guildSettings[guildID].allowedSTA.length > 0 ? guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
    '\n\n' +
    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':';

    if (interaction.commandName === 'server') {
        if (interaction.guild.ownerId === interaction.user.id || interaction.user.id === process.env.OWNER_ID) {

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

            const changeRolesButtonFilter = (i) => i.customId === 'change-sta' && i.user.id === interaction.user.id;
            const changeRolesButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeRolesButtonFilter, time: 60000 });

            changeRolesButtonCollector.on('collect', async (i) => {
                try {
                    const selectCollector = selectCollectors.get(i.message.id);
                    if (selectCollector) {
                        selectCollector.stop();
                        selectCollectors.delete(i.message.id);
                    }

                    // get non managed roles
                    const nonManagedRoles = interaction.guild.roles.cache.filter(role => !role.managed && role.name !== '@everyone').map(role => {
                        return {
                            label: role.name,
                            value: role.id,
                        };
                    });

                    // send the multi select menu
                    const selectMessage = await i.update({
                        embeds: [{
                            title: "send to all permissions",
                            description: `select the roles you want to allow to use "send to all" command\n\n
                            permittable user roles *(these should be selected, please dont select bot roles)*: ${nonManagedRoles.length > 0 ? nonManagedRoles.map(role => '<@&' + role.value + '>').join('  ') : '**none**'}\n
                            currently permitted roles: ${guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') || '**none**'}`,
                            color: embedColor,
                        }],
                        components: [new ActionRowBuilder().addComponents(roleSelectMenu)],
                        ephemeral: true,
                    });
                    //console.log('user clicked the button');

                    // create a collector for multi-select menu interactions
                    const selectFilter = i => i.customId === 'role-select' && i.user.id === interaction.user.id;
                    // create a collector for multi-select menu interactions
                    const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 60000 });

                    newSelectCollector.on('collect', async selectInteraction => {
                        newSelectCollector.stop();
                        selectCollectors.delete(selectInteraction.message.id); // remove the collector when done
                    
                        try {
                            // Get the selected roles
                            let selectedRoles = selectInteraction.values;
                    
                            // Log the selected roles before filtering
                            console.log('Selected Roles by user: ', selectedRoles);
                    
                            // Get roles from the JSON
                            let guildRoles = guildSettings[guildID].allowedSTA;
                    
                            console.log('Guild Roles:', guildRoles);
                    
                            // Remove deselected roles and add newly selected roles
                            selectedRoles.forEach(role => {
                                if (!guildRoles.includes(role)) {
                                    guildRoles.push(role); // Add newly selected role
                                } else {
                                    guildRoles = guildRoles.filter(r => r !== role); // Remove deselected role
                                }
                            });
                    
                            // Update guildSettings with updated roles
                            guildSettings[guildID].allowedSTA = guildRoles;
                    
                            // Write updated guildSettings to the JSON file
                            fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
                    
                            // Update the embed with the new roles
                            await selectInteraction.update({
                                embeds: [{
                                    title: embedTitle,
                                    description: '"send to all" permitted roles: ' + (guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') || '**none**') +
                                    '\n\n' +
                                    '"translate to brainrot" permitted roles: ' + (guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') || '**none**') +
                                    '\n\n' +
                                    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':',
                                    color: embedColor,
                                }],
                                components: [new ActionRowBuilder().addComponents(buttons)],
                                ephemeral: true,
                            });
                    
                            console.log('User has updated permissions to: ' + selectedRoles);
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

            const changeServerLanguageButtonFilter = (i) => i.customId === 'change-serverlanguage' && i.user.id === interaction.user.id;
            const changeServerLanguageButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeServerLanguageButtonFilter, time: 60000 });

            // reply with a select menu with language options
            changeServerLanguageButtonCollector.on('collect', async (i) => {
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
                        title: "server translate language",
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
                            title: "server translate language",
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
                            title: "server translate language",
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
                                 '"send to all" permitted roles: ' + (guildSettings[guildID].allowedSTA.length > 0 ? guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
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
