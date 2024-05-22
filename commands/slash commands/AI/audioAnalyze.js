const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('ffmpeg');

module.exports = async function handleSlashCommand(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'audio-analyze') {
        const audioFile = interaction.options.getAttachment('audio');
        const audioOutput = interaction.options.getString('output');

        const audioUrl = audioFile.url;
        const randomName = Math.random().toString(36).substring(7);

/*         if (audioFile.contentType.startsWith('video/') && audioFile.contentType !== 'video/gif') {
            const downloadVideo = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            const videoData = downloadVideo.data;
            await fs.writeFileSync(`./temp/${randomName}.mp4`, videoData);

            // convert to audio
            try {
                var process = new ffmpeg(`./temp/${randomName}.mp4`);
                process.then(function (video) {
                    // Callback mode
                    video.fnExtractSoundToMP3(`./temp/${randomName}.mp3`, function (error, file) {
                        if (!error)
                            console.log('Audio file: ' + file);
                    });
                }, function (err) {
                    console.log('Error: ' + err);
                });
            } catch (e) {
                console.log(e.code);
                console.log(e.msg);
            }
            
            interaction.reply({
                content: 'The file you uploaded is a video file. It has been converted to an audio file.',
                ephemeral: true,
            });
                
        } else if (!audioFile.contentType.startsWith('audio/')) {
            return interaction.reply({
                content: 'The file you uploaded is not an audio file. Please upload an audio file.',
                ephemeral: true,
            });
        } else {
            await interaction.deferReply({ ephemeral: true });
        } */

        // if file is a video, convert it to audio
        if (audioFile.contentType.startsWith('video/') && audioFile.contentType !== 'video/gif') {
            const downloadVideo = await axios.get(audioUrl, { responseType: 'arraybuffer' });
            const videoData = downloadVideo.data;
            await fs.writeFileSync(`temp/${randomName}.mp4`, videoData);

            const process = new ffmpeg(`temp/${randomName}.mp4`);
            process.then(function (video) {
                video.fnExtractSoundToMP3(`temp/${randomName}.mp3`, function (error, file) {
                    if (!error) {
                        console.log('Audio file:', file);
                        // convert it to a base64 string, make sure to include the data type
                        const audioData = fs.readFileSync(`temp/${randomName}.mp3`);
                        const base64Audio = `data:audio/mp3;base64,${audioData.toString('base64')}`;
                    }
                });
            }, function (err) {
                console.log('Error:', err);
            });
        }

        interaction.deferReply({ ephemeral: true });

        const downloadAudio = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        const audioData = downloadAudio.data;
        await fs.writeFileSync(`./temp/${randomName}.mp3`, audioData);

        // convert it to a base64 string, make sure to include the data type
        const base64Audio = `data:audio/mp3;base64,${audioData.toString('base64')}`;

        try {
            deepInfraPrediction = await axios.post('https://api.deepinfra.com/v1/inference/openai/whisper-large?version=9065fbc87cc7164fda86caa00cdeec40f846dbca', {
                audio: base64Audio,
                authorization: process.env.DEEPINFRA_TOKEN,
            });
            const runtimeDuration = deepInfraPrediction.data.inference_status.runtime_ms;
            console.log(`The prediction took ${runtimeDuration}ms to complete.`);

            // convert the prediction to a human-readable format
            const predictionDuration = Math.ceil(deepInfraPrediction.data.inference_status.runtime_ms / 1000); // Convert duration to seconds and round up

            const predictionSeconds = Math.floor(predictionDuration % 60);
            const predictionMinutes = Math.floor((predictionDuration / 60) % 60);
            const predictionHours = Math.floor(predictionDuration / 3600);

            let formattedDuration = '';

            if (predictionHours > 0) {
                formattedDuration = `${predictionHours.toString().padStart(2, '0')}:${predictionMinutes.toString().padStart(2, '0')}:${predictionSeconds.toString().padStart(2, '0')}s`;
            } else {
                formattedDuration = `${predictionMinutes.toString().padStart(2, '0')}:${predictionSeconds.toString().padStart(2, '0')}s`;
            }

            console.log(`The prediction took ${formattedDuration} to complete.`);
            const segments = deepInfraPrediction.data.segments;
            const totalDuration = deepInfraPrediction.data.duration; // Total duration of the audio file in seconds
            const totalHours = Math.floor(totalDuration / 3600);
            
            // Calculate whether to display hours or minutes
            const useHours = totalHours > 0;
            
            segments.forEach(segment => {
                const startTime = segment.start;
                const endTime = segment.end;
            
                const startSeconds = Math.floor(startTime % 60);
                const startMinutes = Math.floor((startTime / 60) % 60);
                const startHours = Math.floor(startTime / 3600);
            
                const endSeconds = Math.floor(endTime % 60);
                const endMinutes = Math.floor((endTime / 60) % 60);
                const endHours = Math.floor(endTime / 3600);
            
                // Adjust timestamp format based on duration
                if (useHours) {
                    segment.start = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}`;
                    segment.end = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;
                } else {
                    segment.start = `${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}`;
                    segment.end = `${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;
                }
            });

            const predictionString = segments.map(segment => `\`${segment.start} - ${segment.end}\` ${segment.text}`).join('\n');
            const predictionRawText = deepInfraPrediction.data.text;

            // Function to split text into chunks
            const splitTextIntoChunks = (text, limit) => {
                const lines = text.split('\n');
                const chunks = [];
                let currentChunk = '';

                for (const line of lines) {
                    if ((currentChunk + line).length > limit) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }

                if (currentChunk) {
                    chunks.push(currentChunk);
                }

                return chunks;
            };

            // Conditional logic for handling different cases
            if (predictionRawText.length > 2000 && audioOutput === 'raw_only') {
                console.log('raw text too long, sending as a file');
                fs.writeFileSync(`./temp/${randomName}.txt`, predictionRawText);
                interaction.editReply({
                    embeds: [{
                        title: 'output is too long to be displayed as a message, it has been compressed into a text file.',
                        footer: { text: `model took ${formattedDuration} to generate your request` },
                    }],
                    files: [`./temp/${randomName}.txt`],
                    ephemeral: true,
                });

/*                 guildSettings[interaction.guild.id].members[interaction.user.id].AIuses = userAIuses - 1;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2)); */
            } else if (predictionRawText.length < 2000 && audioOutput === 'raw_only') {
                console.log('raw text short, sending as a message');
                interaction.editReply({
                    content: predictionRawText,
                    ephemeral: true,
                });
            } else if (predictionString.length > 1000 && predictionString.length < 6000) {
                console.log('segmented text too long, splitting into chunks');
                const predictionStringChunks = splitTextIntoChunks(predictionString, 1000);
                const fields = predictionStringChunks.map((chunk, index) => {
                    return {
                        name: index === 0 ? 'segments' : '\u200B',
                        value: chunk,
                    };
                });
                interaction.editReply({
                    embeds: [{
                        title: audioFile.name.replace(/\*/g, ''),
                        fields: fields,
                        footer: { text: `model took ${formattedDuration} to generate your request` },
                        color: 2829617,
                    }],
                    ephemeral: true,
                });

/*                 guildSettings[interaction.guild.id].members[interaction.user.id].AIuses = userAIuses - 1;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2)); */
            } else if (predictionString.length + predictionRawText.length > 6000) {
                console.log('segmented text too long, sending as a file');
                fs.writeFileSync(`./temp/${randomName}.txt`, predictionRawText);
                interaction.editReply({
                    embeds: [{
                        title: 'output is too long to be displayed as a message, it has been compressed into a text file.',
                        footer: { text: `model took ${formattedDuration} to generate your request` },
                    }],
                    files: [`./temp/${randomName}.txt`],
                    ephemeral: true,
                });

/*                 guildSettings[interaction.guild.id].members[interaction.user.id].AIuses = userAIuses - 1;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2)); */
            } else {
                console.log('segmented text short, sending as a message');
                interaction.editReply({
                    embeds: [{
                        title: audioFile.name,
                        description: predictionString,
                        footer: { text: `model took ${formattedDuration} to generate your request` },
                        color: 2829617,
                    }],
                    ephemeral: true,
                });

/*                 guildSettings[interaction.guild.id].members[interaction.user.id].AIuses = userAIuses - 1;
                fs.writeFileSync('./database/guilds.json', JSON.stringify(guildSettings, null, 2)); */
            } 
        } catch (error) {
            console.error(error);
        } finally {
            // Delete the audio file after processing, and the text file if it was created
            await fs.unlinkSync(`./temp/${randomName}.mp3`);
            if (fs.existsSync(`./temp/${randomName}.txt`)) {
                await fs.unlinkSync(`./temp/${randomName}.txt`);
            } else if (fs.existsSync(`./temp/${randomName}.mp4`)) {
                await fs.unlinkSync(`./temp/${randomName}.mp4`);
            }
        }
    }
};