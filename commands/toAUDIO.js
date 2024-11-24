const altnames = ['toaudio', '2audio', 'toaud', '2aud']
const isChainable = false;
const whatitdo = 'Converts a video to a mp3, supports videos';

const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isVideo = firstAttachment && firstAttachment.contentType.includes('video');
        console.log('hasAttachment:', hasAttachment);
        console.log('isVideo:', isVideo);
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
            const userName = userID;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOMP3CONV-${rnd5dig}.${contentType}`, fileData);

            console.log('Downloaded File:', `${userName}-TOMP3CONV-${rnd5dig}.${contentType}`);
            console.log('file type:', fileType);

            try {
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
                .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine))
                .on('end', () => {
                    message.reply({
                        files: [{
                            attachment: outputPath
                        }]
                    }).then(() => {
                        console.log('Audio file:', outputPath);
                        resolve(outputPath);
                    }).catch(reject);
                })
                .on('error', (err) => {
                    reject(new Error('Audio conversion failed: ' + err.message));
                })
                .save(outputPath);
        });
    }
