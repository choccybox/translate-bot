import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

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
            targetMessage = targetMessage.replace(mention, userName);
        });
        console.log(`**MENTIONS** message from ${interaction.guild.name.toUpperCase()}: ${targetMessage}`)
    } else {
        console.log(`message from ${interaction.guild.name.toUpperCase()}: ${targetMessage}`);
    }

    // Fetch translation from Google Translate API
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${userLang}&dt=t&q=${encodeURIComponent(targetMessage)}`);
    const data = await response.json();
    const translatedMessage = data[0][0][0]; // Extract translated text from the response */

/*     // ignore disabled languages and return the original message
    if (disabledLanguages.includes(data[2])) {
        return targetMessage;
    } */

    // get what language the message was translated from
    const sourceLanguage = data[2];
    // replace certain iso codes (cs -> cz, zh -> zh-CN, etc) using a map
    const sourceLanguageIso = isoCorrection[sourceLanguage] || sourceLanguage;
    const userLangIso = isoCorrection[userLang] || userLang;

    // console log what the auto language detection is
    console.log(`Detected language: ${sourceLanguageIso}`);
    console.log(`User's preferred language: ${userLangIso}`);
    console.log(`:flag_${sourceLanguageIso}: -> :flag_${userLangIso}: ${translatedMessage}`);

    // if the detected and preferred languages are the same, return the original message
    if (sourceLanguageIso === userLangIso) {
        return `this message is already in your/servers preferred language: :flag_${userLangIso}:`;
    }

    return `:flag_${sourceLanguageIso}: -> :flag_${userLangIso}: ${translatedMessage}`;
}

module.exports = translateMessageToEnglish;