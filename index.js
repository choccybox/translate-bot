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
  console.log(`wake yo ass up bc it's time to go beast mode`);   
  
});

let storedMessageID = null;
let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'
const allowedRoles = 
['1203293769483685908' /*very active level 10*/, 
'1203044476319440977' /*staff*/, 
'1203057085432995890' /*managers*/, 
'1208815004963315772' /*boosters*/,
'1228329015580954664' /*danny*/,
'1228386248725364798' /*customer*/,
];
const emojiReaction = [
    '<:catthumb:1235660903601541262>',
    '<:catthumb2:1235660901571624971>',
    '<:catthumb3:1235660900057354320>',
    '<:catthumb4:1235660898408992818>',
]

// translate to you
client.on('interactionCreate', async (interaction) => {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate to you') {
        const targetMessage = interaction.targetMessage;
        const targetContent = targetMessage.content;

        translateMessageToEnglish(targetContent)
            .then((translatedMessage) => {
                if (translatedMessage === targetContent) {
                    console.log(`This message is already in English. -> ${targetContent}`)
                    interaction.reply({
                        content: 'This message is already in English.',
                        ephemeral: true,
                    });
                    return;
                } else {
                    console.log(`Original message: ${targetContent}`);
                    console.log(`Translated message: ${translatedMessage}`);
                    interaction.reply({
                        content: `${translatedMessage}`,
                        ephemeral: true,
                    });

                    storedMessageID = targetMessage.id;
                    console.log('Original message ID: ' + storedMessageID);
                }
            })
            .catch((error) => {
                console.error(error);
                interaction.reply({
                    content: errorMsg,
                    ephemeral: true,
                });
            });
    }
});

// translate to all
client.on('interactionCreate', async (interaction) => {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate to all') {
        // before running, check if user has atleast one of the mapped role ids or permissions
        const member = interaction.member;
        const hasRole = member.roles.cache.some(role => allowedRoles.includes(role.id));
        // if one of the conditions is met, continue, otherwise end interaction
        if (!hasRole) {
            console.log('User does not have the required permissions.');
            interaction.reply({
                content: 'You do not have the required permissions to use this command.',
                ephemeral: true,
            });
            return;
        } else {
            console.log('User has the required permissions.');
        }

        const targetMessage = interaction.targetMessage;
        const targetContent = targetMessage.content;

        translateMessageToEnglish(targetContent)
            .then((translatedMessage) => {
                if (translatedMessage === targetContent) {
                    console.log(`This message is already in English. -> ${targetContent}`);
                    interaction.reply({
                        content: 'This message is already in English.',
                        ephemeral: true,
                    });
                    return;
                } else {
                    console.log(`Original message: ${targetContent}`);
                    console.log(`Translated message: ${translatedMessage}`);
                    // reply with translation without mentioning the user
                    targetMessage.reply({
                        content: translatedMessage,
                        allowedMentions: { repliedUser: false },
                    });

                    // end interaction
                    interaction.reply({
                        // randomly select an emoji from the array
                        content: `${emojiReaction[Math.floor(Math.random() * emojiReaction.length)]}`,
                        ephemeral: true,
                    });
                }
            })
            .catch((error) => {
                console.error(error);
                interaction.reply({
                    content: errorMsg,
                    ephemeral: true,
                });
            });
    }
});

/* client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'showtoall') {
        if (storedMessageID) {
            const originalMessage = await interaction.channel.messages.fetch(storedMessageID);
            const translatedMessage = interaction.message.content;

            // reply without mentioning the user
            originalMessage.reply({
                content: translatedMessage,
                allowedMentions: { repliedUser: false },
            });

            // disabled button
            const disabledButton = new ButtonBuilder()
                .setCustomId('showtoall')
                .setLabel('Showed to everyone')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const row = new ActionRowBuilder()
                .addComponents(disabledButton);

            // update interaction message
            interaction.update({
                content: translatedMessage,
                ephemeral: true,
                components: [row],
            });
        } else {
            interaction.reply({
                content: 'There was an issue retrieving the original message.',
                ephemeral: true,
            });
        }
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
