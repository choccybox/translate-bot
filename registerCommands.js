require('dotenv').config();
const { ContextMenuCommandBuilder, ApplicationCommandType, REST, Routes } = require('discord.js');

const commandsData = [
    new ContextMenuCommandBuilder()
    .setName('translate to you')
    .setType(ApplicationCommandType.Message),

    new ContextMenuCommandBuilder()
    .setName('translate to all')
    .setType(ApplicationCommandType.Message),

/*     new ContextMenuCommandBuilder()
    .setName('translate to language')
    .setType(ApplicationCommandType.Message), */

/*      new ContextMenuCommandBuilder()
     .setName('translate to brainrot')
     .setType(ApplicationCommandType.Message), */
];

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing context menu commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commandsData },
        )

        console.log('Successfully reloaded context menu commands.');
    } catch (error) {
        console.error(error);
    }
})();

module.exports = commandsData;