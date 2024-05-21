const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');

module.exports = async function handleSlashCommand(interaction) {
  if (interaction.isCommand() && interaction.commandName === 'summarize-user') {
    const summarizeUserChoice = interaction.options.getUser('user');
    const guildSettings = JSON.parse(fs.readFileSync('./database/guilds.json', 'utf8'));

    const userAIuses = guildSettings[interaction.guild.id].members[interaction.user.id].AIuses;

    console.log(userAIuses);

    if (userAIuses < 1) {
        return interaction.reply({
          embeds: [{
              title: 'AI uses depleted',
              description: 'you have ran out of uses for AI related commands\nAI uses reset each midnight, which is in **' + fs.readFileSync('./database/AIResetIn.txt', 'utf8') + '**',
              color: 0xFF0000
          }],
          ephemeral: true,
          });
    } else {
        interaction.deferReply({ ephemeral: true });
    }

    const messages = [];
    let after = null; // Stores the message ID to use for pagination
    let totalMessagesFetched = 0; // Tracks total messages retrieved

    const urlRegex = /(?:https?|ftp):\/\/[\w\-]+(?:\.[\w\-]+)*[:\/]\S*/gi; // Regular expression for URLs

    async function fetchMessages(channel, limit = 100) {
      const fetchedMessages = await channel.messages.fetch({ limit, after });
      totalMessagesFetched += fetchedMessages.size; // Update total count

      const userMessages = fetchedMessages
        .filter((message) => message.content) // Filter out empty messages
        .filter((message) => !message.attachments.size && message.author.id === summarizeUserChoice.id) // Filter out attachments and messages from other users
        .map((message) => message.content.replace(urlRegex, '')); // Filter attachments, user ID, remove URLs and map to content

      messages.push(...userMessages);

      after = fetchedMessages.last()?.id; // Update the after value for next iteration (check for undefined)

      return messages.length >= 100 || !fetchedMessages.size; // Stops fetching when 100 user messages or channel end is reached
    }

    // Loop for pagination with 100 message limit
    let keepFetching = true;
    while (keepFetching && messages.length < 100) {
      keepFetching = await fetchMessages(interaction.channel);
    }

    // Usage in handleSlashCommand
    console.log(`Total messages paginated: ${totalMessagesFetched}`);
    messages.reverse(); // Reverse the messages array for oldest to newest order
    //console.log(messages); // This will contain up to 100 reversed message contents without attachments or URLs from the requested user

    // return a message if user requested is a bot
    if (summarizeUserChoice.bot) {
      return interaction.editReply({
        content: 'The user you requested is a bot.',
        ephemeral: true,
      });
    } else {
        // deduct 1 from user's AI uses
        guildSettings[interaction.guild.id].members[interaction.user.id].AIuses = userAIuses - 1;
        fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2));
        console.log('removed 1 AI use from user: ' + interaction.user.id + ', remaining uses: ' + guildSettings[interaction.guild.id].members[interaction.user.id].AIuses);
        try {
            LLAMA = await axios.post('https://api.deepinfra.com/v1/openai/chat/completions?version=c9231f629c54de150fe4cca99a98034f32fb589e', {
                model: "meta-llama/Meta-Llama-3-8B-Instruct",
                authorization: process.env.DEEPINFRA_API_KEY,
                messages: [
                    {
                    role: "user",
                    content: 'summarize this user\'s (' + summarizeUserChoice.username + ') messages: ' + messages
                    },
                    {
                    role: "system",
                    content: `make your response as easy to understand as possible, use only lowercase letters. you'\re not allowed to introduce yourself or say that you're an AI, saying stuff like "here's what I found", "here's what I think", "here's a summary of..." or "here's a summary of xxx messages". you're have to make bullet points.`
                    }
                ]
            });
    
            interaction.editReply({
                embeds: [{
                    title: 'summary of ' + summarizeUserChoice.username,
                    description: LLAMA.data.choices[0].message.content,
                    footer: { text: `prompt tokens: ${LLAMA.data.usage.prompt_tokens}, completion tokens: ${LLAMA.data.usage.completion_tokens}, total tokens: ${LLAMA.data.usage.total_tokens}` },
                    color: 0x00FF00
                }],
                
                ephemeral: true
            });
                  
        } catch (error) {
            console.error(error);
        }
    }
  }
};
