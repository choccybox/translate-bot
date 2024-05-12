const translateMessageToEnglish = require('../../backbone/texttranslateworker.js'); // Assuming you have the translation function in a separate file called translate.js
const fs = require('fs');
const dotenv = require('dotenv');

// load environment variables
dotenv.config();

if (process.env.DISABLE_DEBUG) {
    console.log('console logs are enabled');
} else {
    console.log('console logs are disabled');
}

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,  } = require('discord.js');

const languageSelection = require('../../database/languageSelection.json');
const isoCorrection = require('../../database/isoCorrection.json');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-translateall')
        .setLabel('send to this channel')
        .setStyle(ButtonStyle.Danger),
];

const embedColor = 2829617;

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'

module.exports = async function handleSlashCommand(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'translate') {
    const targetMessage = interaction.options.getString('text');

    const guildID = interaction.guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    const memberID = interaction.user.id;
    const member = interaction.member;
        
    const allowedSTA = guildSettings[guildID].allowedSTA;
    const isGuildOwner = memberID === guildSettings[guildID].owner;
    const isAdmin = member.permissions.has('Administrator');
    const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id)) || isGuildOwner || isAdmin;
    const replyAsBot = guildSettings[guildID].members[memberID] ? guildSettings[guildID].members[memberID].replyAsBot : false;

    // send message with select menu of languages
    currentIndex = 0;

    // create a select menus with language options
    const languageSelectionChunks = languageSelection.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / 25);
        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
        }
        resultArray[chunkIndex].push(item);
        return resultArray;
    }, []);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('language-select')
        .setPlaceholder('Select language')
        .addOptions(languageSelectionChunks[0]);

    const prevBtn = new ButtonBuilder()
        .setCustomId('language-prev')
        .setLabel('previous')
        .setStyle(ButtonStyle.Secondary);

    const nextBtn = new ButtonBuilder()
        .setCustomId('language-next')
        .setLabel('next')
        .setStyle(ButtonStyle.Secondary);

    interaction.reply({
        embeds: [{
            title: "select language to translate to",
            description: `**${targetMessage}**`,
            color: embedColor,
        }],
        components: [
            new ActionRowBuilder().addComponents(selectMenu),
            new ActionRowBuilder().addComponents(prevBtn, nextBtn)
        ],
        ephemeral: true,
    });

    let selectCollectors, newPrevCollector, newNextCollector, buttonCollector;

    selectCollectors = interaction.channel.createMessageComponentCollector({ filter: i => i.customId === 'language-select' && i.user.id === interaction.user.id, time: 60000 });
    newPrevCollector = interaction.channel.createMessageComponentCollector({ filter: i => i.customId === 'language-prev' && i.user.id === interaction.user.id, time: 60000 });
    newNextCollector = interaction.channel.createMessageComponentCollector({ filter: i => i.customId === 'language-next' && i.user.id === interaction.user.id, time: 60000 });

    const lastIndex = languageSelectionChunks.length - 1;

    selectCollectors.on('collect', async (interaction) => {
        const selectedLanguage = interaction.values[0];
        newPrevCollector.stop();
        newNextCollector.stop();
        selectCollectors.stop();

        // translate the message
        translateMessageToEnglish(targetMessage, interaction, selectedLanguage)
            .then((translatedMessage) => {

                const botHasPerm = interaction.guild.members.cache.get(process.env.CLIENT_ID);
                const permissions = botHasPerm.permissions.toArray();
                if (process.env.DISABLE_DEBUG === 'false') {
                    console.log(permissions);
                    console.log('is guild owner?: ' +isGuildOwner);
                    console.log('has STA role?: ' + hasRole);
                }

                const flagEmoji = translatedMessage.match(/:flag_\w+:/g);
                if (translatedMessage.includes('this message is already in')) {
                    interaction.update({
                        embeds: [{
                            title: "",
                            description: 'this message is already in servers preffered language: ' + flagEmoji,
                            color: embedColor,
                        }],
                        components: [],
                        ephemeral: true,
                    });
                } else if (!permissions.some(permission => permission === 'Administrator' || permission === 'ManageWebhooks')) {
                    if (process.env.DISABLE_DEBUG === 'false' || isGuildOwner === false) {
                        console.log(isGuildOwner === true ? 'bot doesnt have the required permissions and user is the guild owner' : 'bot doesnt have the required permissions and user is not the guild owner');
                    }

                    interaction.update({
                        embeds: [{
                            title: "",
                            description: `**${translatedMessage}**`,
                            color: embedColor,
                            footer: {
                                text: isGuildOwner === true ? 'let me say it this way, even tho you can send messages to everyone, i cant. YOU can fix it tho' : 'let me say it this way, even tho you can send messages to everyone, i cant. the owner can tho',
                            },
                        }],
                        components: [],
                        ephemeral: true,
                    });
                } else {
                    if (process.env.DISABLE_DEBUG === 'false' || hasRole === true) {
                        console.log(hasRole === true ? 'bot has the required permissions and user has the required role' : 'bot has the required permissions and user does not have the required role');
                    }

                    interaction.update({
                        embeds: [{
                            title: "",
                            description: `**${translatedMessage}**`,
                            color: embedColor,
                        }],
                        components: hasRole === true ? [new ActionRowBuilder().addComponents(buttons)] : [],
                        ephemeral: true,
                    });
                }
                    
                buttonCollector = interaction.channel.createMessageComponentCollector({ filter: i => i.customId === 'confirm-translateall' && i.user.id === interaction.user.id, time: 60000 });

                // send the message from previous collector when user clicks the button
                buttonCollector.on('collect', async (interaction) => {
                    if (!replyAsBot) {
                        if (process.env.DISABLE_DEBUG === 'false') {
                            console.log('user has configured to reply as themselves');
                        }
                        // create webhook with the user's name and avatar
                        const webhook = await interaction.channel.createWebhook({
                            name: interaction.user.username,
                            avatar: interaction.user.displayAvatarURL(),
                        });

                        // send webhook message
                        webhook.send({
                            content: translatedMessage,
                            username: interaction.user.username,
                            avatarURL: interaction.user.displayAvatarURL(),
                        });

                        // wait for 5 seconds
                        setTimeout(() => {
                            webhook.delete();

                            interaction.update({
                                embeds: [{
                                    title: "done! :3",
                                    description: ``,
                                    color: embedColor,
                                }],
                                components: [],
                                ephemeral: true,
                            });
                        }, 1000);

                        buttonCollector.stop();
                    } else {
                        if (process.env.DISABLE_DEBUG === 'false') {
                            console.log('user has configured to reply as bot');
                        }
                        interaction.channel.send(translatedMessage);
                        buttonCollector.stop();
                    }
                });
            })
            .catch((error) => {
                console.error(error);
                interaction.update({
                    content: errorMsg,
                    ephemeral: true,
                });
            });
    });

    // when the previous button is clicked, subtract -1 from the index of the language selection and update the select menu while enabling next button
    newPrevCollector.on('collect', async (interaction) => {
        // get current index knowing that the first index is 0
        const prevIndex = currentIndex - 1;

        if (process.env.DISABLE_DEBUG === 'false') {
            console.log('current index: ' + prevIndex);
        }

        if (prevIndex > 0) {
            selectMenu.setOptions(languageSelectionChunks[prevIndex]);
            nextBtn.setDisabled(false);
        } else {
            selectMenu.setOptions(languageSelectionChunks[0]);
            prevBtn.setDisabled(true);
        }

        await interaction.update({
            embeds: [{
                title: "select language to translate to",
                description: `**${targetMessage}**`,
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

    // when the next button is clicked, add +1 to the index of the language selection and update the select menu while enabling previous button
    newNextCollector.on('collect', async (interaction) => {
        const nextIndex = currentIndex + 1;
        if (process.env.DISABLE_DEBUG === 'false') {
            console.log('current index: ' + nextIndex);
        }

        if (nextIndex < lastIndex) {
            selectMenu.setOptions(languageSelectionChunks[nextIndex]);
            prevBtn.setDisabled(false);
        } else {
            selectMenu.setOptions(languageSelectionChunks[lastIndex]);
            nextBtn.setDisabled(true);
        }

        await interaction.update({
            embeds: [{
                title: "select language to translate to",
                description: `**${targetMessage}**`,
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

    // if user runs the same command again while the select menu is still active or the send to channel button is still active, stop the collectors
    interaction.client.on('interactionCreate', async (i) => {
        if (i.isCommand() && i.commandName === 'translate') {
            selectCollectors.stop();
            newPrevCollector.stop();
            newNextCollector.stop();
            buttonCollector.stop();
        }
    });
}
};