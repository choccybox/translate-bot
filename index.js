const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
    // Skip messages sent by the bot
    if (message.author.bot) return;

    // use translate function to translate the message content to English
    translateMessageToEnglish(message)
        .then((translatedMessage) => {
            console.log('Translated message:', translatedMessage);
            // If the translated message is different from the original message, it means it's not in English
            if (translatedMessage.toLowerCase() !== message.content.toLowerCase()) {
                // get channel where the message was sent
                const channel = message.channel;

                // Create a webhook
                channel.createWebhook({
                    // user's name and avatar
                    name: message.author.username,
                    avatar: message.author.displayAvatarURL({ format: 'png', dynamic: true }),
                })
                .then(webhook => {
                    console.log(`Created webhook for ${webhook.name}`);
                    
                    // Send the translated message using the created webhook
                    webhook.send(message.content + ' -> ' + `**${translatedMessage}**`, {
                        username: message.author.username,
                        avatarURL: message.author.displayAvatarURL({ format: 'png', dynamic: true }),
                    })
                    .then(() => {
                        console.log('Translated message sent successfully!');
                        
                        // Delete the webhook after sending the message
                        webhook.delete()
                        .then(() => console.log('Webhook deleted successfully!'))
                        .catch(console.error);
                        
                        // Delete the original message from the user
                        message.delete()
                        .then(() => console.log('Original message deleted successfully!'))
                        .catch(console.error);
                    })
                    .catch(console.error);
                })
                .catch(console.error);
            }
        })
        .catch((error) => {
            console.error('Error translating message:', error);
        });
});


async function translateMessageToEnglish(message) {
    const sourceText = message.content;
    const sourceLang = 'auto'; // Auto-detect source language
    const targetLang = 'en';   // Translate to English
    
    // Fetch translation from Google Translate API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURI(sourceText)}`);
    const data = await response.json();
    const translatedMessage = data[0][0][0]; // Extract translated text from the response
    
    return translatedMessage;
}

client.login(process.env.TOKEN);
