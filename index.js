const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const index = express();const PORT = process.env.PORT || 3000;

index.listen(PORT, () => {});
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

client.on('messageCreate', async (message) => {
  if (message.mentions.has(client.user)) {
    const messageWords = message.content.split(/[\s,]+/);
    const commandWords = messageWords.filter(word => commandsList[word.split(':')[0]]);
    const uniqueCommands = [...new Set(commandWords.map(word => word.split(':')[0]))];
    let currentAttachments = message.attachments.size > 0 ? message.attachments : null;

    if (!currentAttachments && message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      currentAttachments = repliedMessage.attachments.size > 0 ? repliedMessage.attachments : null;
    } else if (!currentAttachments && message.content.includes('youtube')) {
      const youtubeLink = message.content.match(/(https?:\/\/[^\s]+)/g)[0];
      currentAttachments = new Collection();
      currentAttachments.set('youtube', { url: youtubeLink });
    } else if (!currentAttachments && message.content.includes('pukeko')) {
      message.reply({ files: [{ attachment: path.join(__dirname, 'images', 'pukeko.jpg') }] });
      return;
    } else if (!currentAttachments && message.content.trim() === `<@${client.user.id}> help`) {
      // get the file commandsdesc.json and format it correctly into this order: command, whatitdoes, altnames
      const commandsDesc = require('./database/commandsdesc.json');
      const formattedCommands = Object.keys(commandsDesc).map(command => {
        return `**${command}**: ${commandsDesc[command].whatitdoes}\nAliases: ${commandsDesc[command].altnames.join(', ')}`;
      });
      const formattedCommandsString = formattedCommands.join('\n\n');
      message.reply({ content: `${formattedCommandsString}` });
    } else if (!currentAttachments && message.content.trim() === `<@${client.user.id}>`) {
      message.reply({ content: 'Please provide an audio or video file to process.' });
      return;
    }

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

        const result = await commandFile.run(message, client, currentAttachments);

        if (result && typeof result === 'string') {
          await message.reply({ content: result }).catch(console.error);
        }
        
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        return message.reply({ content: `An error occurred while processing the command ${commandName}.` });
      }
    }
  }
});

// Read all .js files in commands folder, log them, and get their first line of code altnames and write those as available commands into a .json file
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = {};
const whatitdo = {};

commandFiles.forEach(file => {
  const filePath = path.join(__dirname, 'commands', file);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const firstLine = fileContent.split('\n')[0];
  const secondLine = fileContent.split('\n')[1];
  const altnameMatch = firstLine.match(/const altnames = \[(.*)\]/);

  if (altnameMatch) {
    const altnames = altnameMatch[1].split(',').map(name => name.trim().replace(/'/g, '')) || [];
    
    altnames.forEach(altname => {
      commands[altname] = {
        file: file,
      };
    });

    const whatitdoesMatch = secondLine.match(/const whatitdo = '(.*)'/);
    if (whatitdoesMatch) {
      const whatitdoes = whatitdoesMatch[1];
      whatitdo[file.split('.')[0].toLowerCase()] = {
        whatitdoes: whatitdoes,
        altnames: altnames,
      };
    }
  }
});

// Write the commands to a .json file
fs.writeFileSync('./database/commands.json', JSON.stringify(commands, null, 2));
fs.writeFileSync('./database/commandsdesc.json', JSON.stringify(whatitdo, null, 2));

client.once('ready', async () => {
  const tempDir = './temp';

  // check if temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // clear all files in temp directory
  fs.readdir(tempDir, (err, files) => {
    if (err) {
      console.error('Error reading temp directory:', err);
      return;
    }

    for (const file of files) {
      fs.unlink(path.join(tempDir, file), err => {
        if (err) {
          console.error('Error deleting file:', err);
          return;
        }
      });
    }
  });

  console.log(`wake yo ass up bc it's time to go beast mode`);
});

client.login(process.env.TOKEN);