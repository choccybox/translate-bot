const altnames = ['audio', 'aa', 'audioanalyze', 'speech2text', 's2t', 'stt'];
const whatitdo = 'transcribes audio/video to text, supports audio and video';

const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('@distube/ytdl-core');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained) {
        if (message.content.includes('help')) {
            return message.reply({
                content: `*transcribes an audio/video file to text*\n` +
                    `**usage:** ${altnames.join(', ')}\n`,
            });
        }
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isYoutubeLink = message.content.includes('youtube.com') || message.content.includes('youtu.be');
        if (!isYoutubeLink) {
            console.log('is not youtube link');
            const isVideoOrAudio = firstAttachment && (firstAttachment.contentType.includes('video') || firstAttachment.contentType.includes('audio'));
            if (!isVideoOrAudio) {
                return message.reply({ content: 'Please provide an audio or video file to process.' });
            } else {
            const fileUrl = firstAttachment.url;
            const randomName = message.author.id;
            const contentType = firstAttachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;

            // react to the message to show that the bot is processing the audio
            message.react('🔽');
    
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            const fileExtension = contentType === 'mpeg' ? 'mp3' : contentType;
            const fileName = firstAttachment.name;
            await fs.writeFileSync(`temp/${randomName}-S2T-${rnd5dig}.${fileExtension}`, fileData);
        
            try {
                if (firstAttachment.contentType.startsWith('video/') && contentType !== 'mp3') {
                    await new Promise((resolve, reject) => {
                        ffmpeg(`temp/${randomName}-S2T-${rnd5dig}.${contentType}`)
                            .toFormat('mp3')
                            .on('end', resolve)
                            .on('error', reject)
                            .save(`temp/${randomName}-S2T-${rnd5dig}.mp3`);
                    });
                }

                const audioData = fs.readFileSync(`temp/${randomName}-S2T-${rnd5dig}.${contentType === 'mp3' ? 'mp3' : 'mp3'}`);
                message.reactions.removeAll().catch(console.error);
                message.react('<a:pukekospin:1311021344149868555>').catch(() => message.react('👍'));
                await processAudio(audioData.toString('base64'), message, randomName, fileName, rnd5dig);
                message.reactions.removeAll().catch(console.error);

            } catch (error) {
                console.error('Error processing:', error);
                return { attachments: null, error: 'Error processing the file.' };
            }
        }
        } else {
            console.log('is youtube link');
            const youtubeLink = currentAttachments.first().url;
            console.log(youtubeLink);
            const randomName = message.author.id;
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;

            // react to the message to show that the bot is processing the audio
            message.react('🔽');

            try {
                const audioStream = ytdl(youtubeLink, {
                    filter: 'audioonly',
                    quality: 'lowestaudio',
                    highWaterMark: 1 << 25 // Fixes buffering issues
                });

                const output = `temp/${randomName}-S2T-${rnd5dig}.mp3`;
                const ffmpegProcess = ffmpeg(audioStream)
                    .audioCodec('libmp3lame')
                    .toFormat('mp3')
                    .on('end', async () => {
                        console.log('YouTube audio downloaded and converted successfully.');
                        const audioData = fs.readFileSync(output);
                        message.reactions.removeAll().catch(console.error);
                        message.react('<a:pukekospin:1311021344149868555>').catch(() => message.react('👍'));
                        await processAudio(audioData.toString('base64'), message, randomName, rnd5dig);
                        message.reactions.removeAll().catch(console.error);
                    })
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err);
                        message.reply({ content: 'Error processing audio with FFmpeg.' });
                    })
                    .save(output);
                    
            } catch (err) {
                console.error('Error downloading YouTube audio:', err);
                return message.reply({ content: 'Error downloading YouTube audio.' });
            }


        }
    }
};
        

async function processAudio(base64Audio, message, randomName, rnd5dig) {
    try {
        // console.log('using model:', abrmodelstomodelnames[model]);
        const deepInfraPrediction = await axios.post('https://api.deepinfra.com/v1/inference/distil-whisper/distil-large-v3', {
            audio: base64Audio,
            authorization: process.env.DEEPINFRA_TOKEN,
        });

        const predictionRawText = deepInfraPrediction.data.text;

        if (predictionRawText.length > 2000) {
            fs.writeFileSync(`./temp/${randomName}-S2T-${rnd5dig}.txt`, predictionRawText);
            message.reply({
                files: [`./temp/${randomName}-S2T-${rnd5dig}.txt`],
            });
        } else {
            message.reply({
                content: predictionRawText,
            });
        }
    } catch (error) {
        console.error(error);
        return message.reply({ content: 'the model fucking gave up dawg, try again ig' });
    } finally {
        // delete all files including S2T in the name, only target mp3, mp4 and txt files, wait 30s before deleting
        const filesToDelete = fs.readdirSync('./temp/').filter((file) => {
            return file.includes('S2T');
        });

        console.log('Files to delete:', filesToDelete);

        filesToDelete.forEach((file) => {
            console.log(`Deleting file: ${file}`);
            setTimeout(() => {
            fs.unlinkSync(`./temp/${file}`);
            }, 5000);
        });
    }
}
