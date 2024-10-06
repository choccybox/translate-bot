const { Client, GatewayIntentBits, ContextMenuCommandBuilder, SlashCommandBuilder, ApplicationCommandType, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

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
	.setName('riodejaneiro')
	.setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
	.setName('audioanalyze')
	.setType(ApplicationCommandType.Message),

  new ContextMenuCommandBuilder()
  .setName('stake')
  .setType(ApplicationCommandType.Message),

  new SlashCommandBuilder()
  .setName('stake')
  .setDescription('adds stake logo to the right bottom corner of the video')
  .addAttachmentOption(option => option.setName('file').setDescription('any image/video format').setRequired(true)),

  new SlashCommandBuilder()
  .setName('freaky')
  .setDescription('make text 𝓯𝓻𝓮𝓪𝓴𝔂👅💦')
  .addStringOption(option => option.setName('text').setDescription('text to make 𝓯𝓻𝓮𝓪𝓴𝔂👅💦').setRequired(true))
  .addBooleanOption(option => option.setName('disable-emojis').setDescription('disable 👅💦 emojis').setRequired(false)),

  new SlashCommandBuilder()
  .setName('imagegeneration')
  .setDescription('generate an image from a text')
  .addStringOption(option => option.setName('image-prompt').setDescription('text to generate an image from').setRequired(true))
  .addIntegerOption(option => option.setName('num-images').setDescription('amount of images (1-4)').setRequired(false))
  .addStringOption(option => option.setName('guidance').setDescription('guidance (how closely to follow the prompt) for the AI (1-25)').setRequired(false)),

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
  .setName('audioanalyze')
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
];

function getAllCommandsFromFolders() {
  const contextCommandsDir = './commands/context commands';
  const slashCommandsDir = './commands/slash commands';
  const ignoreList = ['rioDeJaneiro']; // ignore these commands when writing to .json

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
    console.log('adding:', commandName + "Context")
    console.log('path:', command)
  });

  slashCommands.forEach(command => {
    const commandName = path.basename(command, '.js').toLowerCase();
    global[commandName + "Slash"] = require(command);
    console.log('adding:', commandName + "Slash")
    console.log('path:', command)
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
      return file.replace(/([A-Z])/g, '$1').toLowerCase();
    });
  }
}

client.on('interactionCreate', async (interaction) => {
    const commandsJson = JSON.parse(fs.readFileSync('defaults/commands.json'));
    // only read the lowercase commands
    const contextCommands = commandsJson.contextCommands.lowercase;
    const slashCommands = commandsJson.slashCommands.lowercase;

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

const rest = new REST().setToken(process.env.TOKEN);


client.once('ready', async () => {
  // clear temp
  fs.rmSync('./temp', { recursive: true, force: true });
  fs.mkdirSync('./temp');

  // register commands
  await registerCommands();
  console.log(`wake yo ass up bc it's time to go beast mode`);
});

client.on('guildCreate', async (guild) => {
  console.log(`Joined a new guild: ${guild.name}`);
  await registerCommands();
});

client.login(process.env.TOKEN);