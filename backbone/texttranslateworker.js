const dotenv = require('dotenv');
dotenv.config();

const isoCorrection = require('../defaults/isoCorrection.json');
const { translate } = require('bing-translate-api');

async function translateMessageToEnglish(targetMessage, interaction, userLang) {
    // check if the message has user mentions
    const userMentions = targetMessage.match(/<@!?\d+>/g);

    if (userMentions) {
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
    }

    try {
        const res = await translate(targetMessage, null, userLang);
        // replace certain iso codes (cs -> cz, zh -> zh-CN, etc) using a map
        const detectedSource = isoCorrection[res.language.from] || res.language.from;
        const userLangIso = isoCorrection[userLang] || userLang;

        if (detectedSource === userLangIso) {
            console.log('message already in preferred language');
            const alreadyInLang = `this message is already in your/servers preferred language: :flag_${userLangIso}:`;
            const inLang = true;
            return [{ alreadyInLang, inLang }];
        } else {
            console.log('message translated');
            const alreadyInLang = `:flag_${detectedSource}: -> :flag_${userLangIso}: ${res.translation}`;
            const inLang = false;
            return [{ alreadyInLang, inLang }];
        }
    } catch (err) {
        console.error(err);
        return [{ errorMsg }];
    }
}

module.exports = translateMessageToEnglish;
