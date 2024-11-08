const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const index = express();
const PORT = process.env.PORT || 3001;

index.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// Serve static files from the "public" directory
index.use('/images', express.static(path.join(__dirname, 'userMakes')));

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

const commandsList = require('./commands/commands.json');
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
      // create a folder in userMakes with the user id (if it doesn't exist)
      if (!fs.existsSync(`./userMakes/${userID}`)) {
          fs.mkdirSync(`./userMakes/${userID}`);
      }

      let currentAttachments = message.attachments.size > 0 ? message.attachments : null;

      if (!currentAttachments && message.reference) {
          const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
          currentAttachments = repliedMessage.attachments.size > 0 ? repliedMessage.attachments : null;
      }

      if (!currentAttachments) {
          return message.reply({ content: 'I need an audio file, idiot.' });
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
                  if (result && result.attachments && result.attachments.length > 0) {
                      const uploadedMessage = await message.reply({
                          files: [result.attachments[0]],
                      });
                      console.log(`Uploaded attachment: ${result.attachments[0]}`);

                      currentAttachments = new Collection();
                      currentAttachments.set(uploadedMessage.attachments.first().id, uploadedMessage.attachments.first());
                      console.log(`Current Attachments updated with new attachment: ${uploadedMessage.attachments.first().url}`);
                  } else {
                      console.log(`Command ${commandName} did not produce an attachment. Stopping process.`);
                      return message.reply({ content: `something fucked up` });
                  }
              } else {
                  console.log(`Command ${commandName} is in noChainList, so no attachment check needed.`);
                  if (!result) {
                      const replyMessage = await message.reply({ content: `working on ${commandName}` });
                      setTimeout(async () => {
                        await replyMessage.edit({ content: `finished ${commandName}` }).catch(console.error);
                      }, 500);
                      return;
                  }
              }
          } catch (error) {
              console.error(`Error executing command ${commandName}:`, error);
              return message.reply({ content: `An error occurred while processing the command ${commandName}.` });
          }

          isChained = true;
          console.log('isChained index:', isChained);
      }

      const files = fs.readdirSync('./temp');
      files.forEach(file => {
          if (file.startsWith(userID)) {
              fs.unlinkSync(`./temp/${file}`);
          }
      });
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
fs.writeFileSync('./commands/commands.json', JSON.stringify(commands, null, 2));

client.once('ready', async () => {
  // clear temp
  fs.rmSync('./temp', { recursive: true, force: true });
  fs.mkdirSync('./temp');
  console.log(`wake yo ass up bc it's time to go beast mode`);
});

client.login(process.env.TOKEN);