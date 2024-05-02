const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();
const registerCommands = require('./registerCommands.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.once('ready', async () => {
  console.log('Bot is ready!');
});

client.on('interactionCreate', (interaction) => {
    if (!interaction.isMessageContextMenuCommand()) return;

    if (interaction.commandName === 'translate') {
        const targetMessage = interaction.targetMessage.content;
        // get the content of the message
        console.log('original message: ' + targetMessage);
        // send the message to translateMessageToEnglish function
        translateMessageToEnglish(targetMessage)
            .then((translatedMessage) => {
                // send the translated message to the channel ephemeraly
                // check if the message is already in English
                if (translatedMessage === targetMessage) {
                    interaction.reply({
                        content: 'This message is already in English.',
                        ephemeral: true,
                    });
                    return;
                } else {
/*                     const showMessage = new ButtonBuilder()
                    .setCustomId('showtoall')
                    .setLabel('Show to all?')
                    .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder()
                    .addComponents(showMessage);
                    interaction.reply({
                        content: `${translatedMessage}`,
                        ephemeral: true,
                        components: [row],
                    }); */

                    interaction.reply({
                        content: `${translatedMessage}`,
                        ephemeral: true,
                    });
                    console.log('translated message: ' + translatedMessage);
                }
            })
            .catch((error) => {
                console.error(error);
                interaction.reply({
                    content: `oopsie woopsie, uwu owo something went wrong!`,
                    ephemeral: true,
                });
            });
    }
});

// when the button is clicked, send the translated message to the channel
/* client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'showtoall') {
        const targetMessage = interaction.message.content;
        const translatedMessage = targetMessage;
        // reply to the message that was interacted with without mentioning the user
        interaction.channel.send(`${interaction.user.username} requested translation from: **${interaction.targetMessage.content}**\n**${targetMessage}**`);
        // update the message, and set the button to showtoallclicked
        interaction.update({
            content: `${translatedMessage}`,
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId('showtoallclicked')
                .setLabel('Show to all?')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            )],
        });
    }
}); */

async function translateMessageToEnglish(targetMessage) {
    const sourceText = targetMessage;
    const sourceLang = 'auto'; // Detect language automatically
    const targetLang = 'en';   // Translate to English

    const text = sourceText.replace(/<@![0-9]+>/g, '').replace(/<#[0-9]+>/g, '');
    
    // Fetch translation from Google Translate API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURI(text)}`);
    const data = await response.json();
    const translatedMessage = data[0][0][0]; // Extract translated text from the response

    // ignore certain languages and pass them through
    const disabledLanguages = ['en', 'so', 'tl', 'vi', 'zh', 'fy'];
    if (disabledLanguages.includes(data[2])) {
        return data[0][0][0];
    } 

    // get what language the message was translated from
    const sourceLanguage = data[2];
    // replace certain iso codes (cs -> cz, zh -> zh-CN, etc) using a map
    const isoMap = {
        'cs': 'cz',
        'zh': 'zh-CN',
    };
    const sourceLanguageIso = isoMap[sourceLanguage] || sourceLanguage;
    // pass to other functions
    return `:flag_${sourceLanguageIso}: -> **${translatedMessage}**`;
}


client.login(process.env.TOKEN);
