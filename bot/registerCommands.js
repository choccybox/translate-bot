const { ContextMenuCommandBuilder, ApplicationCommandType, SlashCommandBuilder, REST, Routes } = require('discord.js');

require('dotenv').config();

const commandsData = [
    new ContextMenuCommandBuilder()
    .setName('translate to you')
    .setType(ApplicationCommandType.Message),

    new ContextMenuCommandBuilder()
    .setName('translate to all')
    .setType(ApplicationCommandType.Message),

    new SlashCommandBuilder()
    .setName('server')
    .setDescription('modify server settings'),

    new SlashCommandBuilder()
    .setName('user')
    .setDescription('modify user settings'),
];

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

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
        } else {
            console.log('No commands to remove.');
        }

        // Register new commands
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commandsData },
        );

        console.log('Successfully reloaded context and slash commands.');
    } catch (error) {
        console.error(error);
    }
})();