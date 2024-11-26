const altnames = ['toaudio', '2audio', 'toaud', '2aud']
const whatitdo = 'Converts a video to a mp3, supports videos';

const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained) {
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isVideo = firstAttachment && firstAttachment.contentType.includes('video');
        if (message.content.includes('help')) {
            return message.reply({
                content: `**converts a video to a mp3**\n` +
                    `**Usage: ${altnames.join(', ')}\n`
            });
        } else if (!isVideo) {
            return message.reply({ content: 'provide a video file to convert.' });
        } else {
            const attachment = firstAttachment;
            const fileUrl = attachment.url;
            const userName = message.author.id;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOMP3CONV-${rnd5dig}.${contentType}`, fileData);

            try {
                message.react('<a:pukekospin:1311021344149868555>').catch(() => message.react('👍'));
                await convertToAudio(message, userName, contentType, rnd5dig);
            } catch (err) {
                console.error('Error:', err);
                return message.reply({ content: 'Error converting video to gif' });
            } finally {
                fs.unlinkSync(`temp/${userName}-TOMP3CONV-${rnd5dig}.${contentType}`);
                fs.unlinkSync(`temp/${userName}-AUDIOFINAL-${rnd5dig}.mp3`);
            }
        }
    }
}

    async function convertToAudio(message, userName, contentType, rnd5dig) {
        const outputPath = `temp/${userName}-AUDIOFINAL-${rnd5dig}.mp3`;

        return new Promise((resolve, reject) => {
            const ffmpegCommand = ffmpeg(`temp/${userName}-TOMP3CONV-${rnd5dig}.${contentType}`)
                .toFormat('mp3')
                .outputOptions(['-y']);

            ffmpegCommand
                /* .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine)) */
                .on('end', () => {
                    message.reply({
                        files: [{
                            attachment: outputPath
                        }]
                    }).then(() => {
                        resolve(outputPath);
                        // check if the bot has replied to the message
                        if (message.channel.messages.cache.get(message.id)) {
                            message.reactions.removeAll().catch(console.error);
                        }
                    }).catch(reject);
                })
                .on('error', (err) => {
                    reject(new Error('Audio conversion failed: ' + err.message));
                })
                .save(outputPath);
        });
    }
