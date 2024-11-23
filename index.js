const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const index = express();
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);


index.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});
// Serve static files from the "public" directory
index.use('/images', express.static(path.join(__dirname, 'temp')));

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

const commandsList = require('./database/commands.json');
const getUnchainableCommands = () => {
  return Object.keys(commandsList).filter(command => !commandsList[command].isChainable);
};
console.log('Unchainable commands:', getUnchainableCommands());
const unchainableCommands = getUnchainableCommands();

client.on('messageCreate', async (message) => {
  if (message.mentions.has(client.user)) {
    const messageWords = message.content.split(/[\s,]+/);
    const commandWords = messageWords.filter(word => commandsList[word.split(':')[0]]);
    const uniqueCommands = [...new Set(commandWords.map(word => word.split(':')[0]))];
    const userID = message.author.id;

    // write the current userID into database/users.json, add key with their new command
    const users = require('./database/users.json');
    if (!users[userID]) {
      // create a new user object if it doesn't exist and add what was in the message
      users[userID] = {
        last: commandWords
      };
    } else {
      // if the user exists, add the new command to the last key
      users[userID].last = commandWords;
    }
    fs.writeFileSync('./database/users.json', JSON.stringify(users, null, 2));

    let currentAttachments = message.attachments.size > 0 ? message.attachments : null;

    if (!currentAttachments && message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      currentAttachments = repliedMessage.attachments.size > 0 ? repliedMessage.attachments : null;
      // if it doesnt have an attachment, check if it is unchainable command
    } else if (!currentAttachments && uniqueCommands.length === 1 && unchainableCommands.includes(uniqueCommands[0])) {
      console.log('No attachment found, but command is unchainable.');
    } else if (!currentAttachments && message.content.includes('help')) {
      console.log('No attachment found, but help command.');
      const commands = require('./database/commands.json');
      
    } else if (!currentAttachments) {
      message.reply({ content: 'Please provide an audio or video file to process.' });
      return;
    }

    if (uniqueCommands.length > 1) {
      const foundNoChainCommand = uniqueCommands.find(command => unchainableCommands.includes(command));
      if (foundNoChainCommand) {
        return message.reply({ content: `You cannot chain the command \`${foundNoChainCommand}\` with other commands.` });
      }
    }

    let isChained = false;
    console.log('isChained index:', isChained);

    for (const commandName of uniqueCommands) {
      console.log(`Command name: ${commandName}`);
      const commandInfo = commandsList[commandName];

      if (!commandInfo) {
        console.log(`Command ${commandName} not found in commands list.`);
        continue;
      }

      try {
        const commandFile = require(path.join(__dirname, 'commands', commandInfo.file));
        console.log(`Executing command: ${commandName}`);

        const result = await commandFile.run(message, client, currentAttachments, isChained, userID);

        if (!unchainableCommands.includes(commandName)) {
          if (result && typeof result === 'string') {
            await message.reply({ content: result }).catch(console.error);
          } else {
            console.log(`Command ${commandName} did not produce a valid result. Stopping process.`);
          }
        } else {
          console.log(`Command ${commandName} is in noChainList, so no attachment check needed.`);
          if (!result) {
            console.log(`Command ${commandName} did not produce a result. Stopping process.`);
          }
        }
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        if (message.content.includes('help')) {
          console.log(`Help command error: ${error.message}`);
        } else {
          return message.reply({ content: `An error occurred while processing the command ${commandName}.` });
        }
      }

      isChained = true;
      console.log('isChained index:', isChained);
    }
  } else if (message.content.trim().toLowerCase() === 'last') {
    const users = require('./database/users.json');
    const userID = message.author.id;

    if (users[userID] && users[userID].last) {
      const lastCommands = users[userID].last;
      const uniqueCommands = [...new Set(lastCommands.map(word => word.split(':')[0]))];

      let isChained = false;
      console.log('isChained index:', isChained);

      for (const commandName of uniqueCommands) {
        console.log(`Command name: ${commandName}`);
        const commandInfo = commandsList[commandName];

        if (!commandInfo) {
          console.log(`Command ${commandName} not found in commands list.`);
          continue;
        }

        try {
          const commandFile = require(path.join(__dirname, 'commands', commandInfo.file));
          console.log(`Executing command: ${commandName}`);

          const result = await commandFile.run(message, client, null, isChained, userID);

          if (!unchainableCommands.includes(commandName)) {
            if (result && typeof result === 'string') {
              await message.reply({ content: result }).catch(console.error);
            } else {
              console.log(`Command ${commandName} did not produce a valid result. Stopping process.`);
            }
          } else {
            console.log(`Command ${commandName} is in noChainList, so no attachment check needed.`);
            if (!result) {
              console.log(`Command ${commandName} did not produce a result. Stopping process.`);
            }
          }
        } catch (error) {
          console.error(`Error executing command ${commandName}:`, error);
          return message.reply({ content: `An error occurred while processing the command ${commandName}.` });
        }

        isChained = true;
        console.log('isChained index:', isChained);
      }
    } else {
      message.reply({ content: 'No previous command found.' });
    }
  }
});

// Read all .js files in commands folder, log them, and get their first line of code altnames and write those as available commands into a .json file
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = {};

commandFiles.forEach(file => {
  console.log(`Found command file: ${file}`);
  const filePath = path.join(__dirname, 'commands', file);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const firstLine = fileContent.split('\n')[0];
  const secondLine = fileContent.split('\n')[1];
  const altnameMatch = firstLine.match(/const altnames = \[(.*)\]/);
  const isChainableMatch = secondLine.match(/const isChainable = (true|false)/);
  console.log(`First line: ${firstLine}`);
  console.log(`Second line: ${secondLine}`);

  if (altnameMatch) {
    const altnames = altnameMatch[1].split(',').map(name => name.trim().replace(/'/g, '')) || [];
    const isChainable = isChainableMatch ? isChainableMatch[1] === 'true' : false;
    
    altnames.forEach(altname => {
      commands[altname] = {
        file: file,
        isChainable: isChainable
      };
    });
  }
});

// Write the commands to a .json file
fs.writeFileSync('./database/commands.json', JSON.stringify(commands, null, 2));

async function purgeAllCommands() {
  try {
      // Wait for client to be ready
      await new Promise(resolve => {
          client.once('ready', resolve);
          client.login(process.env.TOKEN);
      });

      console.log('Started removing all commands...');

      // Get all guilds the bot is in
      const guilds = await client.guilds.fetch();

      // Remove commands from each guild
      for (const [guildId] of guilds) {
          try {
              console.log(`Removing commands from guild ${guildId}...`);
              await rest.put(
                  Routes.applicationGuildCommands(client.user.id, guildId),
                  { body: [] }
              );
              console.log(`✓ Removed all commands from guild ${guildId}`);
          } catch (error) {
              console.error(`Error removing commands from guild ${guildId}:`, error);
          }
      }

      // Remove global commands
      try {
          console.log('Removing global commands...');
          await rest.put(
              Routes.applicationCommands(client.user.id),
              { body: [] }
          );
          console.log('✓ Removed all global commands');
      } catch (error) {
          console.error('Error removing global commands:', error);
      }

      console.log('Command purge complete!');
      process.exit(0);
  } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
  }
}

client.once('ready', async () => {
  const tempDir = './temp';
  
  // Read files in temp directory
  const files = fs.readdirSync(tempDir);
  console.log('Files in temp directory:', files);

  // Delete files that don't include 'FINAL'
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    if (!file.includes('FINAL')) {
      fs.rmSync(filePath, { force: true });
    }
  });

  purgeAllCommands();
  console.log(`wake yo ass up bc it's time to go beast mode`);
});


client.login(process.env.TOKEN);