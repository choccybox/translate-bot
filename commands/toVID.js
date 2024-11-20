const altnames = ['tovid', 'tovideo', 'vid', 'video', '2vid', '2video'];
const isChainable = false;
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isVideo = firstAttachment && firstAttachment.contentType.includes('gif');
        console.log('hasAttachment:', hasAttachment);
        console.log('isVideo:', isVideo);
        if (message.content.includes('help')) {
            return message.reply({
                content: `**converts a gif to a video**\n` +
                    `**Usage: ${altnames.join(', ')}\n`
            });
        } else if (!isVideo) {
            return message.reply({ content: 'provide a gif file to convert.' });
        } else {
            const attachment = firstAttachment;
            const fileUrl = attachment.url;
            const userName = userID;
            const actualUsername = message.author.username;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            message.react ('👍');
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}.${contentType}`, fileData);

            console.log('Downloaded File:', `${userName}-TOVIDCONV.${contentType}`);
            console.log('file type:', fileType);

            try {
                await convertToVid(message, userName, actualUsername, contentType, rnd5dig);
            } catch (err) {
                console.error('Error:', err);
                return message.reply({ content: 'Error converting gif to video' });
            } finally {
                fs.unlinkSync(`temp/${userName}-TOVIDCONV.${contentType}`);
            }
        }
    }
}


    function convertToVid(message, userName, actualUsername, contentType, rnd5dig) {
        let progressMessage = null;
        let startTime = Date.now();

        const userMakesDir = path.join(__dirname, 'userMakes');
        try {
            fs.mkdirSync(userMakesDir, { recursive: true, mode: 0o777 });
        } catch (err) {
            console.error('Error creating userMakes directory:', err);
        }

        try {
            fs.accessSync(userMakesDir, fs.constants.W_OK);
        } catch (err) {
            console.error('Cannot write to userMakes directory:', err);
            return message.reply({ content: 'Error: Cannot write output file' });
        }

        const outputPath = path.join(__dirname, '..', 'userMakes', `${userName}-GIF-${rnd5dig}.mp4`);

        return new Promise((resolve, reject) => {
            ffmpeg(`temp/${userName}-TOVIDCONV.${contentType}`)
                .toFormat('mp4')
                .videoCodec('libx264')
                .outputOptions([
                    '-pix_fmt yuv420p',
                    '-movflags +faststart'
                ])
                .on('progress', async (progress) => {
                    const currentTime = Date.now();
                    const elapsedSeconds = (currentTime - startTime) / 1000;
                    
                    if (elapsedSeconds > 2) {
                        const eta = progress.percent ? ((elapsedSeconds / progress.percent) * (100 - progress.percent)).toFixed(1) : 'calculating...';
                        
                        if (!progressMessage) {
                            progressMessage = await message.reply(`Converting: ${progress.percent.toFixed(1)}% (ETA: ${eta}s)`);
                        } else if (currentTime - lastUpdate >= 2000) {
                            await progressMessage.edit(`Converting: ${progress.percent.toFixed(1)}% (ETA: ${eta}s)`);
                            lastUpdate = currentTime;
                        }
                    }
                })
                .on('end', async () => {
                    console.log('Video file:', outputPath);
                    const finalURL = process.env.UPLOADURL + userName + '-VID-' + rnd5dig + '.mp4';
                    if (progressMessage) {
                        await progressMessage.edit(`Done! ${finalURL}`);
                    } else {
                        await message.reply(finalURL);
                    }
                    resolve(outputPath);
                })
                .on('error', async (err) => {
                    if (progressMessage) {
                        await progressMessage.edit('Conversion failed!');
                    }
                    reject(new Error('Video conversion failed: ' + err.message));
                })
                .save(outputPath);
        });
    }
