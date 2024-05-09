const { ContextMenuCommandBuilder, ApplicationCommandType, SlashCommandBuilder, REST, Routes } = require('discord.js');

require('dotenv').config();

const languageCodes = require('./database/languageSelection.json');

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

(async () => {
    try {
        console.log('started refreshing application commands.');

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

            console.log('successfully removed commands:', commandsToRemove.map(command => command.name));
        } else {
        }

        // Register new commands
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commandsData },
        );

        console.log('successfully reloaded context and slash commands.');
    } catch (error) {
        console.error(error);
    }
})();