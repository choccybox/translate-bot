const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
});

client.once('ready', () => {
    console.log('Bot is ready!');
});

// Store timestamps of users' reactions
const reactionTimestamps = new Map();

client.on('messageCreate', async (message) => {
    // Skip messages sent by the bot
    if (message.author.bot) return;
    if (message.mentions.channels.size || message.mentions.users.size) {
        console.log('Message contains mentions:', message.content);
        return;
    }
    // check if message is in a different language than English
    const sourceLang = await detectLanguage(message.content);
    if (sourceLang !== 'en') {
        const translatedMessage = await translateMessageToEnglish(message);
        console.log('Translated message:', translatedMessage);
        message.react('🌐'); // Add a reaction to the original message
    } else {
        return;
    }
});

// if someone reacts to a message that wasn't in English, send a message with the translation to the user
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;
    if (message.author.bot) return;
    const sourceLang = await detectLanguage(message.content);
    if (sourceLang !== 'en') {
        const translatedMessage = await translateMessageToEnglish(message);
        reaction.users.remove(user); // Remove the user's reaction
        
        // Check if the user reacted within the last 10 seconds
        if (reactionTimestamps.has(user.id)) {
            const lastReactionTime = reactionTimestamps.get(user.id);
            const currentTime = Date.now();
            if (currentTime - lastReactionTime < 10000) {
                // Remove the reaction
                reaction.users.remove(user);
                return;
            }
        }
        
        // Store the timestamp of the user's reaction
        reactionTimestamps.set(user.id, Date.now());
        
        // get 2 letter ISO code of the language
        const langCode = sourceLang.split('-')[0];
        // make a flag emoji :flag_xx:
        const flag = `:flag_${langCode}:`;
        // send to channel and delete after 10 seconds
        message.channel.send(`${flag} ${message.content} -> **${translatedMessage}**`)
            .then((msg) => {
                setTimeout(() => {
                    msg.delete();
                }, 10000);
            });
    }
});

async function detectLanguage(text) {
    // Fetch language detection from Google Translate API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURI(text)}`);
    const data = await response.json();
    const sourceLang = data[2]; // Extract source language from the response
    
    return sourceLang;
}

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
