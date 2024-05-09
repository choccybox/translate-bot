const { Client, GatewayIntentBits, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const registerCommands = require('./registerCommands.js');

const translateContext = require('./context commands/translate.js');

const translateSlash = require('./slash commands/translate.js');
const freakySlash = require('./slash commands/freaky.js');

const serverSlash = require('./settings/serversettings.js');
const userSlash = require('./settings/usersettings.js');

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
        member.replyAsBot = false; // Set replyAsBot to true for each member
        return {
          id: member.id,
          name: member.user.username,
          replyAsBot: member.replyAsBot,
          translateLanguage: 'en',
          translateLanguageCorrectedForDiscord: 'us',
          managed: member.permissions.has(PermissionFlagsBits.Administrator) || member.id === guild.ownerId
        };
      });

      // Initialize guild settings
      guildData[guildId] = {
        name: guildName,
        members: {},
        allowedSTA: [],
        allowedBrainrot: [],
        guildTranslateLanguage: 'en',
        guildTranslateLanguageCorrectedForDiscord: 'us',
        owner: guild.ownerId
      };

      // Populate members under the guild
      adminAndOwnerMembers.forEach(member => {
        guildData[guildId].members[member.id] = {
          name: member.name,
          replyAsBot: member.replyAsBot,
          translateLanguage: member.translateLanguage,
          translateLanguageCorrectedForDiscord: member.translateLanguageCorrectedForDiscord,
          managed: member.managed
        };
      });
    });

    try {
      const existingGuildData = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));
      
      // Merge existing guild data with new data, prioritizing existing data
      for (const guildId in guildData) {
        if (existingGuildData[guildId]) {
          // Merge members data
          Object.assign(guildData[guildId].members, existingGuildData[guildId].members);
        }
      }
      
      fs.writeFileSync('./database/guilds.json', JSON.stringify(guildData, null, 2));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading or writing guilds.json:', error.message);
      }
    }
});


client.on('guildCreate', async (guild) => {
    console.log(`Joined a new guild: ${guild.name}`);
    const guildId = guild.id;
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    // Populate non-bot members
    const nonBotMembers = guild.members.cache.filter(member => !member.user.bot).map(member => {
        member.replyAsBot = false; // Set replyAsBot to true for each member
        return {
            id: member.id,
            name: member.user.username,
            replyAsBot: member.replyAsBot,
            translateLanguage: 'en',
            translateLanguageCorrectedForDiscord: 'us',
            managed: member.permissions.has(PermissionFlagsBits.Administrator) || member.id === guild.ownerId
        };
    });

    // Check if guild settings already exist and contain relevant data
    const existingSettings = guildSettings[guildId];

    if (existingSettings && (existingSettings.allowedSTA.length > 0 || existingSettings.allowedBrainrot.length > 0 || Object.keys(existingSettings.members).length > 0)) {
        // Skip writing the guild settings if they already exist and contain relevant data
    } else {
        // Write guild settings if they don't exist or are incomplete
        guildSettings[guildId] = {
            name: guild.name,
            members: {},
            allowedSTA: [],
            allowedBrainrot: [],
            guildTranslateLanguage: 'en',
            guildTranslateLanguageCorrectedForDiscord: 'us',
            owner: guild.ownerId
        };

        // Populate members under the guild
        nonBotMembers.forEach(member => {
            guildSettings[guildId].members[member.id] = {
                name: member.name,
                replyAsBot: member.replyAsBot,
                translateLanguage: member.translateLanguage,
                translateLanguageCorrectedForDiscord: member.translateLanguageCorrectedForDiscord,
                managed: member.managed
            };
        });
    }

    fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
});

client.on('interactionCreate', async (interaction) => {
    // get what context menu reaction it was and use the appropriate function
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate') {
        await translateContext(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'server') {
        await serverSlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'user') {
        await userSlash(interaction)
    } else if (interaction.isCommand() && interaction.commandName === 'freaky') {
        await freakySlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'translate') {
        await translateSlash(interaction);
    } else {
        console.log('interaction not recognized');
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
