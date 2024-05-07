const { Client, GatewayIntentBits, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const registerCommands = require('./bot/registerCommands.js');
const translateToYou = require('./commands/translatetoyou.js');
const translateToAll = require('./commands/translatetoall.js');
const serverSettings = require('./settings/serversettings.js');
const userSettings = require('./settings/usersettings.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
  ],
  fetchAllMembers:true
});

client.once('ready', async () => {
    console.log(`wake yo ass up bc it's time to go beast mode`);

    const guildData = {};

    client.guilds.cache.forEach(guild => {
        const guildId = guild.id;
        const guildName = guild.name;
        const adminAndOwnerMembers = guild.members.cache.filter(member => !member.user.bot && (member.id === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator))).map(member => {
            member.replyAsBot = true; // Set replyAsBot to true for each member
            return {
                id: member.id,
                name: member.user.username,
                replyAsBot: member.replyAsBot,
                translateLanguage: 'en',
                translateLanguageCorrectedForDiscord: 'us',
            };
        });

        let guildSettings = {};
        try {
            guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error reading guilds.json:', error.message);
            }
        }
        
        const existingSettings = guildSettings[guildId];

        if (existingSettings) {
            // Merge the existing settings with the new settings
            const updatedSettings = {
                ...existingSettings,
                members: adminAndOwnerMembers,
                name: guildName
            };

            guildData[guildId] = updatedSettings;
        } else {
            guildData[guildId] = {
                name: guildName,
                members: adminAndOwnerMembers,
                allowedTTA: [],
                allowedBrainrot: [],
                guildTranslateLanguage: 'en',
                translateLanguageCorrectedForDiscord: 'us',
                owner: guild.ownerId
            };
        }
    });

    fs.writeFileSync('./database/guilds.json', JSON.stringify(guildData, null, 2));
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined a new guild: ${guild.name}`);
    const guildId = guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    if (!guildSettings[guildId]) {
        guildSettings[guildId] = {
            name: guild.name,
            members: adminAndOwnerMembers,
            allowedTTA: [],
            allowedBrainrot: [],
            guildTranslateLanguage: 'en',
            guildTranslateLangCorrectedForDiscord: 'us'
        };

        fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
    }

    // Add the code here to write the guild data as when the bot starts
    const nonBotMembers = guild.members.cache.filter(member => !member.user.bot).map(member => {
        member.replyAsBot = true; // Set replyAsBot to true for each member
        return {
            id: member.id,
            name: member.user.username,
            replyAsBot: member.replyAsBot
        };
    });

    const existingSettings = guildSettings[guildId];

    if (existingSettings && (existingSettings.allowedTTA.length > 0 || existingSettings.allowedBrainrot.length > 0 || nonBotMembers.some(member => member.replyAsBot))) {
        guildSettings[guildId] = existingSettings;
    } else {
        guildSettings[guildId] = {
            name: guild.name,
            members: nonBotMembers,
            allowedTTA: [],
            allowedBrainrot: []
        };
    }

    fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
});

let errorMsg = 'oopsie woopsie, something went fucky wucky owo!'
const allowedRoles = [
    '1203293769483685908' /*very active level 10*/, 
    '1203044476319440977' /*staff*/, 
    '1203057085432995890' /*managers*/, 
    '1208815004963315772' /*boosters*/,
    '1228329015580954664' /*danny*/,
    '1228386248725364798' /*customer*/,
];

client.on('interactionCreate', async (interaction) => {
    // get what context menu reaction it was and use the appropriate function
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate to you') {
        await translateToYou(interaction);
    } else if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate to all') {
        await translateToAll(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'server') {
        await serverSettings(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'user') {
        await userSettings(interaction)
    }
    
});

// translate to all
/* client.on('interactionCreate', async (interaction) => {
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
}); */


client.login(process.env.TOKEN);
