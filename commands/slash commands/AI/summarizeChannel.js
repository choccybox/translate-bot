const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs').promises; // Using fs.promises for asynchronous file system operations
const axios = require('axios');

module.exports = async function handleSlashCommand(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'summarize') {
        const summarizeMethod = interaction.options.getString('sum-method');

        
    }
};
