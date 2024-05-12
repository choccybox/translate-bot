const freakyAlphabet = require('../../fonts/freaky.json');

const dotenv = require('dotenv');
dotenv.config();

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

const buttons = [
    new ButtonBuilder()
        .setCustomId('confirm-freakall')
        .setLabel('send to this channel')
        .setStyle(ButtonStyle.Danger),
];

module.exports = async function handleSlashCommand(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'freaky') {
        const textInput = interaction.options.getString('text');
        // Get the boolean value directly from the options, defaulting to false
        const disableEmojis = interaction.options.getBoolean('disable-emojis') || false;

        // check if user is admin, owner or one of allowedSTA roles
        const member = interaction.member;
        const guildID = interaction.guild.id;
        // read server.json file
        const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        const replyAsBot = guildSettings[guildID].members[interaction.user.id] ? guildSettings[guildID].members[interaction.user.id].replyAsBot : false;
        const allowedSTA = guildSettings[guildID].allowedSTA;
        const isAdmin = member.permissions.has('Administrator');

        // check if user has atleast one of the allowed roles
        const hasRole = member.roles.cache.some(role => allowedSTA.includes(role.id) || isAdmin);

        //console.log('textInput:', textInput);
        //console.log('disableEmojis:', disableEmojis);

        // Transform the text using the freaky alphabet
        const transformedText = textInput
            .toLowerCase()
            .split('')
            .map(char => freakyAlphabet[char] || char) // Replace characters with freaky alphabet symbols
            .join('');

        // Add the 👅 and 💦 emojis at the end if disableEmojis is false
        const finalText = disableEmojis ? transformedText : transformedText + "👅💦";

        if (!hasRole) {
            await interaction.reply({
                content: finalText,
                ephemeral: true,
            });
        } else if (textInput.length > 2000) {
            await interaction.reply({
                content: 'sorry, this message is too long..',
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

        // Create a collector for the button
        const sendFreakyToAllButtonFilter = (i) => i.customId === 'confirm-freakall' && i.user.id === interaction.user.id;
        const sendFreakyToAllCollector = interaction.channel.createMessageComponentCollector({ filter: sendFreakyToAllButtonFilter, time: 15000 });

        sendFreakyToAllCollector.on('collect', async (i) => {

            if (!replyAsBot) {
                if (process.env.DISABLE_DEBUG === 'false') {
                    console.log(`user ${member.user.username} has the required permissions and configured to send messages as them.`);
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
                    content: 'done! :3',
                    components: [],
                });
            } else {
                if (process.env.DISABLE_DEBUG === 'false') {
                    console.log(`user ${member.user.username} has the required permissions and configured to send messages as bot.`);
                }
                await interaction.channel.send({
                    content: finalText,
                });
   
                // Update the interaction message
                await i.update({
                    content: 'done! :3',
                    components: [],
                });
            }
         })

         // if user runs the same command again and doesn't press the button stop the collector
         interaction.client.on('interactionCreate', async (i) => {
            if (i.isCommand() && i.commandName === 'freaky') {
                sendFreakyToAllCollector.stop();

            }
        });
    }
}