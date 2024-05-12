import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

const dotenv = require('dotenv');
dotenv.config();

const isoCorrection = require('../database/isoCorrection.json');

async function translateMessageToEnglish(targetMessage, interaction, userLang) {
    const sourceLang = 'auto'; // Detect language automatically

    // check if the message has user mentions
    const userMentions = targetMessage.match(/<@!?\d+>/g);

    if (userMentions) {
        // console.log('mentions found');
        // extract user ids from mentions
        const userIds = userMentions.map(mention => mention.match(/\d+/)[0]);
        // get user objects from ids
        const users = await interaction.guild.members.fetch({ user: userIds });
        // replace mentions with user names
        userMentions.forEach(mention => {
            const userId = mention.match(/\d+/)[0];
            const userName = users.get(userId).displayName;
            targetMessage = targetMessage.replace(mention, `**${userName}**`);
        });
        //console.log(`**MENTIONS** message from ${interaction.guild.name.toUpperCase()}: ${targetMessage}`)
    } else {
        //console.log(`message from ${interaction.guild.name.toUpperCase()}: ${targetMessage}`);
    }

/*     // ignore commas and periods
    targetMessage = targetMessage.replace(/[,\.]/g, '');

    console.log(`target message: ${targetMessage}`); */


    // Fetch translation from Google Translate API
    const response = await fetch(`https://api.datpmt.com/api/v1/dictionary/translate?string=${encodeURIComponent(targetMessage)}&from_lang=${sourceLang}&to_lang=${userLang}`);
    const data = await response.json();
    const translatedMessage = data;

    const targetMessageLang = await fetch(`https://api.datpmt.com/api/v1/dictionary/detection?string=${encodeURIComponent(targetMessage)}`);
    const targetMessageLangData = await targetMessageLang.json();
    const targetMessageLangCode = targetMessageLangData[0];

    console.log(`target message language code: ${targetMessageLangCode}`);

    console.log(`translated message: ${translatedMessage}`);

    // replace certain iso codes (cs -> cz, zh -> zh-CN, etc) using a map
    const sourceLanguageIso = isoCorrection[targetMessageLangCode] || targetMessageLangCode;
    const userLangIso = isoCorrection[userLang] || userLang;
    const selectedLanguage = isoCorrection[userLang] || userLang;

    if (process.env.DISABLE_DEBUG === 'false') {
        console.log(`Detected language: ${sourceLanguageIso}`);
        console.log(`User's preferred language: ${userLangIso}`);
        console.log(`:flag_${sourceLanguageIso}: -> :flag_${userLangIso}: ${translatedMessage}`);
    }

    // if the detected and preferred languages are the same, return the original message
    if (sourceLanguageIso === userLangIso) {
        return `this message is already in your/servers preferred language: :flag_${userLangIso}:`;
    }

    return `:flag_${sourceLanguageIso}: -> :flag_${userLangIso}: ${translatedMessage}`;
}

module.exports = translateMessageToEnglish;