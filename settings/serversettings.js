const fs = require('fs');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');

const languageSelection = require('../database/languageSelection.json');
const isoCorrection = require('../database/isoCorrection.json');

const buttons = [
    new ButtonBuilder()
        .setCustomId('change-sta')
        .setLabel('change "send to all" permissions')
        .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
        .setCustomId('change-brainrot')
        .setLabel('change "brainrot translation" permissions')
        .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
        .setCustomId('change-serverlanguage')
        .setLabel('change server translate language')
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
    '"send to all" permitted roles: ' + (guildSettings[guildID].allowedSTA.length > 0 ? guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
    '\n\n' +
    '"translate to brainrot" permitted roles: ' + (guildSettings[guildID].allowedBrainrot.length > 0 ? guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') : '**none**') +
    '\n\n' +
    'server translate language: ' + ':flag_' + guildSettings[guildID].guildTranslateLanguageCorrectedForDiscord + ':';

    if (interaction.commandName === 'server') {
        if (interaction.guild.ownerId === interaction.user.id || interaction.member.permissions.has('Administrator')) {

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
            const changeRolesButtonCollector = interaction.channel.createMessageComponentCollector({ filter: changeRolesButtonFilter, time: 15000 });

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
                    const newSelectCollector = interaction.channel.createMessageComponentCollector({ filter: selectFilter, time: 15000 });

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
                            title: "translate to brainrot permissions",
                            description: `select the roles you want to allow to use "send to all" command\n\n
                            permittable user roles *(these should be selected, please dont select bot roles)*: ${nonManagedRoles.length > 0 ? nonManagedRoles.map(role => '<@&' + role.value + '>').join('  ') : '**none**'}\n
                            currently permitted roles: ${guildSettings[guildID].allowedBrainrot.map(role => '<@&' + role + '>').join('  ') || '**none**'}`,
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
                            // Get the selected roles
                            let selectedRoles = selectInteraction.values;
                    
                            // Log the selected roles before filtering
                            console.log('Selected Roles by user: ', selectedRoles);
                    
                            // Get roles from the JSON
                            let guildRolesBrainrot = guildSettings[guildID].allowedBrainrot;
                    
                            console.log('Guild Roles:', guildRolesBrainrot);
                    
                            // Update roles for Brainrot
                            selectedRoles.forEach(role => {
                                if (!guildRolesBrainrot.includes(role)) {
                                    guildRolesBrainrot.push(role); // Add newly selected role
                                } else {
                                    guildRolesBrainrot = guildRolesBrainrot.filter(r => r !== role); // Remove deselected role
                                }
                            });
                    
                            // Update guildSettings with updated roles
                            guildSettings[guildID].allowedBrainrot = guildRolesBrainrot;
                    
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

                buttonCollectors.set(interaction.id, changeBrainrotButtonCollector);
            } catch (error) {
                console.error('An error occurred during role selection:', error);
                await i.reply({ content: 'An error occurred while processing your request. Please try again later.', ephemeral: true });
            }
        });

            const changeServerLanguageButtonFilter = (i) => i.customId === 'change-serverlanguage' && i.user.id === interaction.user.id;
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
                                 '"send to all" permitted roles: ' + (guildSettings[guildID].allowedSTA.length > 0 ? guildSettings[guildID].allowedSTA.map(role => '<@&' + role + '>').join('  ') : '**none**') +
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
