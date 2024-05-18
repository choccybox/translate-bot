const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-flagall')
        .setLabel('send to this channel')
        .setStyle(ButtonStyle.Danger),
];

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'flagged') {
        const targetMessage = interaction.targetMessage.content;

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

        const transformedText = targetMessage
            .toLowerCase()
            .split('') 
            .map(char => char === ' ' ? ':flag_us:' : char) // Replace spaces with flag emoji
            .join('');

        // Add the flag emojis at the start and end
        const finalText = ':flag_us:' + transformedText + ':flag_us:';

        if (!targetMessage) {
            await interaction.reply({
                content: 'No text in the message!',
                ephemeral: true,
            });
            return;
        } else if (!hasRole) {
            await interaction.reply({
                content: finalText,
                ephemeral: true,
            });
        } else if (targetMessage.length > 2000) {
            await interaction.reply({
                content: 'Sorry, this message is too long..',
                ephemeral: true,
            });
            return;
        } else {
            await interaction.reply({
                content: finalText,
                ephemeral: true,
                components: [new ActionRowBuilder().addComponents(buttons)],
            });
        }

        // Stop any previous collectors for this interaction
        if (interaction.client.sendFlaggedToAllCollector) {
            interaction.client.sendFlaggedToAllCollector.stop();
        }

        // Create new collector for the button
        const sendFlaggedToAllButtonFilter = (i) => i.customId === 'confirm-flagall' && i.user.id === interaction.user.id;
        const sendFlaggedToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendFlaggedToAllButtonFilter, time: 15000 });

        interaction.client.sendFlaggedToAllCollector = sendFlaggedToAllCollector;

        sendFlaggedToAllCollector.on('collect', async (i) => {
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
        });

        // If user runs the same command again and doesn't press the button, stop the collector
        interaction.client.on('interactionCreate', async (i) => {
            if (i.isCommand() && i.commandName === 'flagged') {
                sendFlaggedToAllCollector.stop();
            }
        });
    }
};
