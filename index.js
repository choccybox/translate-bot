const { Client, GatewayIntentBits, ContextMenuCommandBuilder, SlashCommandBuilder, ApplicationCommandType, REST, Routes, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

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
    // Register commands
    await registerCommands();
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

const commandsData = [
    new ContextMenuCommandBuilder()
    .setName('translate')
    .setType(ApplicationCommandType.Message),

    new SlashCommandBuilder()
    .setName('server')
    .setDescription('modify server settings'),

    new SlashCommandBuilder()
    .setName('user')
    .setDescription('modify user settings'),

    new SlashCommandBuilder()
    .setName('freaky')
    .setDescription('make text 𝓯𝓻𝓮𝓪𝓴𝔂👅💦')
    .addStringOption(option => option.setName('text').setDescription('text to make 𝓯𝓻𝓮𝓪𝓴𝔂👅💦').setRequired(true))
    .addBooleanOption(option => option.setName('disable-emojis').setDescription('disable 👅💦 emojis').setRequired(false)),

    new SlashCommandBuilder()
    .setName('translate')
    .setDescription('translate a message to a specific language')
    .addStringOption(option => option.setName('text').setDescription('text to translate').setRequired(true))
    .addStringOption(option => option.setName('language').setDescription('language to translate to').setRequired(true)
        .addChoices(
            {name: 'english', value: 'en', "emoji": "🇺🇸"},
            {name: 'german', value: 'de'},
            {name: 'french', value: 'fr'},
            {name: 'spanish', value: 'es'},
            {name: 'italian', value: 'it'},
            {name: 'dutch', value: 'nl'},
            {name: 'russian', value: 'ru'},
            {name: 'japanese', value: 'ja'},
            {name: 'chinese', value: 'zh'},
            {name: 'korean', value: 'ko'},
            {name: 'arabic', value: 'ar'},
            {name: 'turkish', value: 'tr'},
            {name: 'romanian', value: 'ro'},
            {name: 'polish', value: 'pl'},
            {name: 'norwegian', value: 'no'},
            {name: 'swedish', value: 'sv'},
            {name: 'danish', value: 'da'},
            {name: 'finnish', value: 'fi'},
            {name: 'greek', value: 'el'},
            {name: 'hungarian', value: 'hu'},
            {name: 'czech', value: 'cs'},
            {name: 'slovak', value: 'sk'},
            {name: 'croatian', value: 'hr'},
            {name: 'serbian', value: 'sr'},
            {name: 'slovenian', value: 'sl'}
        )
    ),
];

const rest = new REST().setToken(process.env.TOKEN);

async function registerCommands() {
    try {
        console.log('Started refreshing application commands.');

        // Get existing commands from the server
        const existingCommands = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID),
        );

        // Remove commands that are not present in commandsData
        const commandsToRemove = existingCommands.filter(command => {
            return !commandsData.some(newCommand => newCommand.name === command.name);
        });

        if (commandsToRemove.length > 0) {
            await Promise.all(commandsToRemove.map(command => {
                return rest.delete(
                    Routes.applicationCommand(process.env.CLIENT_ID, command.id),
                );
            }));

            console.log('Successfully removed commands:', commandsToRemove.map(command => command.name));
        }

        const registeredCommands = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commandsData },
        );

        // Log the added commands
        console.log('Added commands:');
        registeredCommands.forEach(command => {
            console.log(`Command Name: ${command.name} | Command ID: ${command.id} | Command Type: ${command.type}`);
        });

        // Register commands to all guilds and console log the guilds
        const guilds = client.guilds.cache;
        await Promise.all(guilds.map(async guild => {
            await guild.commands.set(commandsData);
            console.log(`Registered commands to guild: ${guild.name}`);
        }));

        console.log('Successfully reloaded context and slash commands.');
    } catch (error) {
        console.error('Error refreshing application commands:', error);
    }
}

client.login(process.env.TOKEN);
