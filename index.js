const { Client, GatewayIntentBits, ContextMenuCommandBuilder, SlashCommandBuilder, ApplicationCommandType, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');

const translateContext = require('./commands/context commands/translate.js');
const flaggedContext = require('./commands/context commands/getFlagged.js');

const translateSlash = require('./commands/slash commands/translate.js');
const freakySlash = require('./commands/slash commands/freaky.js');

const serverSlash = require('./settings/serversettings.js');
const userSlash = require('./settings/usersettings.js');

const flaggedSlash = require('./commands/slash commands/getFlagged.js');

const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessageReactions,
    ],
    fetchAllMembers: true
});

const commandsData = [
    new ContextMenuCommandBuilder()
    .setName('translate')
    .setType(ApplicationCommandType.Message),

    new ContextMenuCommandBuilder()
    .setName('flagged')
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
    .addStringOption(option => option.setName('text').setDescription('text to translate').setRequired(true)),

    new SlashCommandBuilder()
    .setName('help')
    .setDescription('get help with the bot'),

    new SlashCommandBuilder()
    .setName('flagged')
    .setDescription(`YOU'RE🇺🇸NOT🇺🇸IMMUNE🇺🇸TO🇺🇸THE🇺🇸PROPAGANDA!`)
    .addStringOption(option => option.setName('text').setDescription('put🇺🇸your🇺🇸text🇺🇸here').setRequired(true))

];

client.on('interactionCreate', async (interaction) => {
    // get what context menu reaction it was and use the appropriate function
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'translate') {
        await translateContext(interaction);
    } else if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'flagged') {
        await flaggedContext(interaction);
    } else
    
    
    if (interaction.isCommand() && interaction.commandName === 'server') {
        await serverSlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'user') {
        await userSlash(interaction)
    } else if (interaction.isCommand() && interaction.commandName === 'freaky') {
        await freakySlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'translate') {
        await translateSlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'help') {
        await helpSlash(interaction);
    } else if (interaction.isCommand() && interaction.commandName === 'flagged') {
        await flaggedSlash(interaction);
    }
});

const rest = new REST().setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    console.log('Started refreshing application commands.');

    // Get existing global commands
    const existingGlobalCommands = await rest.get(
      Routes.applicationCommands(process.env.CLIENT_ID),
    );

    // Remove global commands that are not present in commandsData
    const commandsToRemove = existingGlobalCommands.filter(command => {
      return !commandsData.some(newCommand => newCommand.name === command.name);
    });

    // Remove global commands that are not present in commandsData
    if (commandsToRemove.length > 0) {
      await Promise.all(commandsToRemove.map(command => {
        return rest.delete(
          Routes.applicationCommand(process.env.CLIENT_ID, command.id),
        );
      }));

      console.log('Successfully removed global commands:', commandsToRemove.map(command => command.name));
    }

    // Register new commands
    const registeredGlobalCommands = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandsData },
    );

    // Log the added global commands
    console.log('Added global commands:');
    registeredGlobalCommands.forEach(command => {
      console.log(`Command Name: ${command.name} | Command ID: ${command.id} | Command Type: ${command.type}`);
    });

    console.log('Successfully reloaded global commands.');
  } catch (error) {
    console.error('Error refreshing global commands:', error);
  }
}

function readGuildSettings() {
  try {
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json'));
    return guildSettings;
  } catch (error) {
    console.error('Error reading guild settings:', error);
    return {};
  }
}

function saveGuildSettings(guildSettings) {
  try {
    fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
    console.log('Guild settings saved.');
  } catch (error) {
    console.error('Error saving guild settings:', error);
  }
}

client.once('ready', async () => {
  // Register commands
  await registerCommands();
  console.log(`wake yo ass up bc it's time to go beast mode`);

  const guildSettings = readGuildSettings();

  // Check guilds and register commands globally if necessary
  client.guilds.cache.forEach(async guild => {
    if (!guildSettings[guild.id]) {
      guildSettings[guild.id] = {
        name: guild.name,
        members: {},
        allowedSTA: [],
        guildTranslateLanguage: 'en',
        guildTranslateLanguageCorrectedForDiscord: 'us',
        owner: guild.ownerId
      };
      saveGuildSettings(guildSettings);
      await registerCommands();
    }
  });
});

client.on('guildCreate', async (guild) => {
    console.log(`Joined a new guild: ${guild.name}`);
    await registerCommands();

    // check if guild is already registered
    const guildSettings = readGuildSettings();
    if (guildSettings[guild.id]) {
        console.log('Guild is already registered.');
        return;
    }

    // Initialize guild settings
    guildSettings[guild.id] = {
        name: guild.name,
        members: {},
        allowedSTA: [],
        guildTranslateLanguage: 'en',
        guildTranslateLanguageCorrectedForDiscord: 'us',
        owner: guild.ownerId
    };
    saveGuildSettings(guildSettings);
});

client.login(process.env.TOKEN);