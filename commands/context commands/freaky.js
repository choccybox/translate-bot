const freakyAlphabet = require('../../fonts/freaky.json');
const dotenv = require('dotenv');
dotenv.config();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-freakall')
        .setLabel('send to this channel')
        .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
        .setCustomId('remove-emojis')
        .setLabel('remove emojis')
        .setStyle(ButtonStyle.Secondary),
];

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'freaky text') {
        const textContent = interaction.targetMessage.content;
        console.log(textContent);

        // Check if user is admin, owner or one of allowedSTA roles
        const member = interaction.member;
        const guildID = interaction.guild.id;
        // Read server.json file
        const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        const replyAsBot = guildSettings[guildID].members[interaction.user.id] ? guildSettings[guildID].members[interaction.user.id].replyAsBot : false;
        const allowedSTA = guildSettings[guildID].allowedSTA;
        const isAdmin = member.permissions.has('Administrator');

        // Check if user has at least one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id) || isAdmin);

        if (!textContent) {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: 'This message doesn\'t contain any text',
                    ephemeral: true,
                });
            }
            return;
        }

        // Transform the text using the freaky alphabet
        const transformedText = textContent
            .toLowerCase()
            .split('')
            .map(char => freakyAlphabet[char] || char) // Replace characters with freaky alphabet symbols
            .join('');

        const finalText = transformedText + "👅💦";

        if (!hasRole) {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: finalText,
                    ephemeral: true,
                });
            }
        } else if (textContent.length > 2000) {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: 'Sorry, this message is too long..',
                    ephemeral: true,
                });
            }
            return;
        } else {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: finalText,
                    ephemeral: true,
                    components: [new ActionRowBuilder().addComponents(buttons[0].setDisabled(false), buttons[1].setDisabled(false))],
                });
            }
        }

        // Stop any previous collectors for this interaction
        if (interaction.client.sendFreakyToAllCollector) {
            interaction.client.sendFreakyToAllCollector.stop();
        }
        if (interaction.client.removeEmojisCollector) {
            interaction.client.removeEmojisCollector.stop();
        }

        // Create new collectors for the buttons
        const sendFreakyToAllButtonFilter = (i) => i.customId === 'confirm-freakall' && i.user.id === interaction.user.id;
        const sendFreakyToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendFreakyToAllButtonFilter, time: 15000 });

        interaction.client.sendFreakyToAllCollector = sendFreakyToAllCollector;

        sendFreakyToAllCollector.on('collect', async (i) => {
            if (!replyAsBot) {
                if (process.env.DISABLE_DEBUG === 'false') {
                    console.log(`User ${member.user.username} has the required permissions and is configured to send messages as themselves.`);
                }
                const webhook = await interaction.channel.createWebhook({
                    name: interaction.user.globalName,
                    avatar: interaction.user.displayAvatarURL(),
                });
                await webhook.send({
                    content: finalText,
                });
                await webhook.delete();

                await i.update({
                    content: 'Done! :3',
                    components: [],
                });
            } else {
                if (process.env.DISABLE_DEBUG === 'false') {
                    console.log(`User ${member.user.username} has the required permissions and is configured to send messages as a bot.`);
                }
                await interaction.channel.send({
                    content: finalText,
                });

                // Update the interaction message
                await i.update({
                    content: 'Done! :3',
                    components: [],
                });
            }
            sendFreakyToAllCollector.stop();
            removeEmojisCollector.stop();
        });

        const removeEmojisButtonFilter = (i) => i.customId === 'remove-emojis' && i.user.id === interaction.user.id;
        const removeEmojisCollector = interaction.channel.createMessageComponentCollector({ filter: removeEmojisButtonFilter, time: 15000 });

        interaction.client.removeEmojisCollector = removeEmojisCollector;

        removeEmojisCollector.on('collect', async (i) => {
            const finalText = transformedText;
            await i.update({
                content: finalText,
                ephemeral: true,
                components: [new ActionRowBuilder().addComponents(buttons[0].setDisabled(false), buttons[1].setDisabled(true))],
            });
        });

        // If user runs the same command again and doesn't press the button, stop the collector
        interaction.client.on('interactionCreate', async (i) => {
            if (i.isCommand() && i.commandName === 'freaky') {
                sendFreakyToAllCollector.stop();
                removeEmojisCollector.stop();
            }
        });
    }
};
