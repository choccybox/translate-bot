const { Client, GatewayIntentBits, ContextMenuCommandBuilder, SlashCommandBuilder, ApplicationCommandType, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

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
/*   new ContextMenuCommandBuilder()
  .setName('translate text')
  .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
  .setName('OCR')
  .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
  .setName('flagged')
  .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
  .setName('rio de janeiro')
  .setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
  .setName('freaky text')
  .setType(ApplicationCommandType.Message), */

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
  .addStringOption(option => option.setName('text').setDescription('put🇺🇸your🇺🇸text🇺🇸here').setRequired(true)),

  new SlashCommandBuilder()
  .setName('riodejaneiro')
  .setDescription('instagram type shit')
  .addAttachmentOption(option => option.setName('image').setDescription('your image').setRequired(true))
  .addIntegerOption(option => option.setName('intensity').setDescription('intensity of the filter, 2 is light, 8 is heavy, default is 5')),

  new SlashCommandBuilder()
  .setName('caption')
  .setDescription('adds a caption to an image')
  .addAttachmentOption(option => option.setName('image').setDescription('your image').setRequired(true))
  .addStringOption(option => option.setName('caption').setDescription('your caption').setRequired(true))
  .addStringOption(option => 
    option.setName('position')
    .setDescription('position of the caption')
    .setRequired(false)
    .addChoices(
      { name: 'Top', value: 'top' },
      { name: 'Bottom', value: 'bottom' }
    )),

  new SlashCommandBuilder()
  .setName('audio-analyze')
  .setDescription('AI - uses OpenAI Whisper audio model to transcribe audio to text')
  .addAttachmentOption(option => option.setName('audio').setDescription('audio file').setRequired(true))
  .addStringOption(option =>
    option.setName('output')
      .setDescription('what kind of an output do you need')
      .setRequired(true)
      .addChoices(
        { name: 'segmented', value: 'segments_only' },
        { name: 'pure text', value: 'raw_only' },
      )),

  new SlashCommandBuilder()
  .setName('summarize-user')
  .setDescription('AI - uses Llama v3 text model to generate a summary of user\'s last 100 messages')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('user to summarize')
      .setRequired(true)),

  new SlashCommandBuilder()
  .setName('togif')
  .setDescription('converts an video to gif')
  .addAttachmentOption(option => option.setName('video').setDescription('video to convert').setRequired(true)),
];

function getAllCommandsFromFolders() {
  const contextCommandsDir = './commands/context commands';
  const slashCommandsDir = './commands/slash commands';
  const ignoreList = ['rioDeJaneiro', 'toGif']; // ignore these commands when writing to .json

  // get all files and subfolders and their files
  const contextCommands = getAllCommandsFromFoldersHelper(contextCommandsDir);
  const slashCommands = getAllCommandsFromFoldersHelper(slashCommandsDir);

  // get all files in the subfolders
  const contextCommandFiles = contextCommands.map(file => path.basename(file));
  const slashCommandFiles = slashCommands.map(file => path.basename(file));

  // write to a json file
  const commandsJson = {
    contextCommands: {
      normal: contextCommandFiles.map(file => file.replace('.js', '')),
      lowercase: convertNamesToLowerCase(contextCommandFiles.map(file => file.replace('.js', '')))
    },
    slashCommands: {
      normal: slashCommandFiles.map(file => file.replace('.js', '')),
      lowercase: convertNamesToLowerCaseAndRename(slashCommandFiles.map(file => file.replace('.js', '')))
    }
  };

  fs.writeFileSync('defaults/commands.json', JSON.stringify(commandsJson, null, 2));

  // import the commands
  contextCommands.forEach(command => {
    const commandName = path.basename(command, '.js').toLowerCase();
    global[commandName + "Context"] = require(command);
    //console.log('adding:', commandName + "Context")
    //console.log('path:', command)
  });

  slashCommands.forEach(command => {
    const commandName = path.basename(command, '.js').toLowerCase();
    global[commandName + "Slash"] = require(command);
    //console.log('adding:', commandName + "Slash")
    //console.log('path:', command)
  });

  function getAllCommandsFromFoldersHelper(dir) {
    const files = [];
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
  
    for (const dirent of dirents) {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        files.push(...getAllCommandsFromFoldersHelper(res));
      } else {
        files.push(res);
      }
    }
  
    return files;
  }

  function convertNamesToLowerCase(files) {
    return files.map(file => file.toLowerCase());
  }

  function convertNamesToLowerCaseAndRename(files) {
    return files.map(file => {
      if (ignoreList.includes(file)) {
        return file.toLowerCase();
      }
      return file.replace(/([A-Z])/g, '-$1').toLowerCase();
    });
  }
}

client.on('interactionCreate', async (interaction) => {
    const commandsJson = JSON.parse(fs.readFileSync('defaults/commands.json'));
    // only read the lowercase commands
    const contextCommands = commandsJson.contextCommands.lowercase;
    const slashCommands = commandsJson.slashCommands.lowercase;

    //console.log('contextCommands:', contextCommands);
    //console.log('slashCommands:', slashCommands);

    // determine if the command is a context command or a slash command
    if (interaction.isMessageContextMenuCommand()) {
      const commandName = interaction.commandName;
      if (contextCommands.includes(commandName)) {
        const contextCommand = global[commandName + "Context"];
        if (typeof contextCommand === 'function') {
          await contextCommand(interaction);
        } else {
          console.log(`Context command ${commandName} is not a function`);
        }
      }
    } else if (interaction.isCommand()) {
      const commandName = interaction.commandName;
      if (slashCommands.includes(commandName)) {
        const slashCommand = global[commandName + "Slash"];
        if (typeof slashCommand === 'function') {
          await slashCommand(interaction);
        } else {
          console.log(`Slash command ${commandName} is not a function`);
        }
      }
    }
});

const rest = new REST().setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    getAllCommandsFromFolders();
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

function resetAIuses() {
  try {
      // Load the guilds.json file
      const guildsData = fs.readFileSync(path.join(__dirname, 'database', 'guilds.json'), 'utf8');
      const guilds = JSON.parse(guildsData);

      // Iterate through each guild
      for (const guildId in guilds) {
          const guild = guilds[guildId];
          
          // Iterate through each member in the guild
          for (const memberId in guild.members) {
              const member = guild.members[memberId];
              
              if (member.AIuses < 10) {
                  // Reset the user's AIuses
                  member.AIuses = 10;
              }
          }
      }

      // Save the updated guilds.json file
      fs.writeFileSync(path.join(__dirname, 'database', 'guilds.json'), JSON.stringify(guilds, null, 2));
      console.log('AIuses have been reset.');
  } catch (error) {
      console.error('Error reading or writing guilds.json file:', error);
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
  } catch (error) {
    console.error('Error saving guild settings:', error);
  }
}

async function updateGuildNames() {
  const guildSettings = readGuildSettings();

  for (const guild of client.guilds.cache.values()) {
    const guildID = guild.id;
    const guildName = guild.name;

    if (!guildSettings[guildID]) {
      guildSettings[guildID] = JSON.parse(fs.readFileSync('./defaults/guildSettingDefaults.json'));
    }

    guildSettings[guildID].name = guildName; // Update the guild name

    try {
      const owner = await guild.fetchOwner();
      guildSettings[guildID].owner = owner.id; // Update the owner ID
      guildSettings[guildID].ownerName = owner.user.username; // Update the owner name
    } catch (error) {
      console.error(`Error fetching owner for guild ${guildID}:`, error);
      guildSettings[guildID].owner = null;
      guildSettings[guildID].ownerName = null;
    }
  }

  saveGuildSettings(guildSettings);
}

function updateUserSetting() {
  const guildSettings = readGuildSettings();

  client.guilds.cache.forEach(async guild => {
    guild.members.cache.forEach(async member => {
      const userID = member.user.id;

      if (guildSettings[guild.id] && guildSettings[guild.id].members[userID]) {
        const userSettings = guildSettings[guild.id].members[userID];

        const defaultSettings = JSON.parse(fs.readFileSync('./defaults/userSettingDefaults.json'));

        if (userSettings.managed) {
          userSettings.managed = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
        }

        userSettings.name = member.user.username;

        Object.keys(userSettings).forEach(key => {
          if (defaultSettings[key] === undefined) {
            delete userSettings[key];
          }
        });

        Object.keys(defaultSettings).forEach(key => {
          if (userSettings[key] === undefined) {
            userSettings[key] = defaultSettings[key];
          }
        });

        guildSettings[guild.id].members[userID] = userSettings;
      }
    });

    saveGuildSettings(guildSettings);
  });
}

function clearTemp() {
  fs.rmSync('./temp', { recursive: true, force: true });
  fs.mkdirSync('./temp');
}

client.once('ready', async () => {
  await clearTemp();
  await registerCommands();
  console.log(`wake yo ass up bc it's time to go beast mode`);

  const guildSettings = readGuildSettings();

  client.guilds.cache.forEach(guild => {
    const guildID = guild.id;
    if (!guildSettings[guildID]) {
      guildSettings[guildID] = JSON.parse(fs.readFileSync('./defaults/guildSettingDefaults.json'));
      saveGuildSettings(guildSettings);
    }
  });

  await updateGuildNames(); // Update the guild names
  updateUserSetting(); // Update user settings
});

client.on('guildCreate', async (guild) => {
  console.log(`Joined a new guild: ${guild.name}`);
  await registerCommands();

  // Check if guild is already registered
  const guildSettings = readGuildSettings();
  if (guildSettings[guild.id]) {
    console.log('Guild is already registered.');
    return;
  }

  // Read guildSettingDefaults.json
  const defaultSettings = JSON.parse(fs.readFileSync('./defaults/guildSettingDefaults.json'));

  // Update the default settings with guild-specific information
  defaultSettings[guild.id].name = guild.name;
  defaultSettings[guild.id].owner = guild.ownerId;

  try {
    const owner = await guild.fetchOwner();
    defaultSettings[guild.id].ownerName = owner.user.username;
  } catch (error) {
    console.error(`Error fetching owner for guild ${guild.id}:`, error);
    defaultSettings[guild.id].ownerName = null;
  }

  // Save the updated guild settings
  guildSettings[guild.id] = defaultSettings;
  saveGuildSettings(guildSettings);
});

client.login(process.env.TOKEN);