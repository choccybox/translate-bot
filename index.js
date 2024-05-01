const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
});

const translatedMessages = new Set();

client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
    // Skip messages sent by the bot
    if (message.author.bot) return;

    // Check if message is in a different language than English
    const sourceLang = await detectLanguage(message.content);
    if (sourceLang !== 'en') {
        const translatedMessage = await translateMessageToEnglish(message);
        console.log('Translated message:', translatedMessage);
        // React with globe and x
        message.react('🌐');
    }
});

// If someone reacts to a message with a globe, check if it's in the .json file and console log true or false
client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.emoji.name === '🌐' && !user.bot) {
        const message = reaction.message;
        // Check if the message has already been translated
        if (!translatedMessages.has(message.id)) {
            // Translate the message
            const translatedMessage = await translateMessageToEnglish(message);

            // get the iso code of the language
            const sourceLang = await detectLanguage(message.content);
            console.log('Sending translated message:', translatedMessage);
            // replace certain iso codes with different flags (cs -> cz, zh -> cn, etc.)
            const flag = sourceLang.replace('cs', 'cz').replace('zh', 'cn').replace('tl', 'ph');

            // Remove all reactions from the message
            message.reactions.removeAll();

            // Send the translated message
            message.channel.send(`:flag_${flag}: ${message.content} -> **${translatedMessage}**`);
            // Add the message to the set of translated messages
            translatedMessages.add(message.id);
        } else {
            console.log('Message already translated');
        }
    }
});

async function detectLanguage(text) {
    // Remove channel mentions from the text
    text = text.replace(/<@![0-9]+>/g, '').replace(/<#[0-9]+>/g, '');
    
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

    const text = sourceText.replace(/<@![0-9]+>/g, '').replace(/<#[0-9]+>/g, '');
    
    // Fetch translation from Google Translate API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURI(text)}`);
    const data = await response.json();
    const translatedMessage = data[0][0][0]; // Extract translated text from the response
    
    return translatedMessage;
}

client.login(process.env.TOKEN);
