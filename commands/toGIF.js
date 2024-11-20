const altnames = ['togif', 'gif', '2gif'];
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
        const isVideo = firstAttachment && firstAttachment.contentType.includes('video');
        console.log('hasAttachment:', hasAttachment);
        console.log('isVideo:', isVideo);
        if (message.content.includes('help')) {
            return message.reply({
                content: `**converts a video to a gif**\n` +
                    `**Usage: ${altnames.join(', ')}\n` +
                    `**Arguments:\n**lq** = makes gif lower quality \n`
            });
        } else if (!isVideo) {
            return message.reply({ content: 'provide a video file to convert.' });
        } else {
            const attachment = firstAttachment;
            const fileUrl = attachment.url;
            const userName = userID;
            const actualUsername = message.author.username;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            
            // look for lq argument
            const args = message.content.toLowerCase().split(' ');
            let lq = false;

            // Check for arguments in the command
            for (const arg of args) {
                if (arg.includes('lq')) {
                    lq = true;
                }
            }

            console.log('Low Quality:', lq);
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOGIFCONV.${contentType}`, fileData);

            console.log('Downloaded File:', `${userName}-TOGIFCONV.${contentType}`);
            console.log('file type:', fileType);

            try {
                await convertToGIF(message, userName, actualUsername, contentType, rnd5dig, lq);
            } catch (err) {
                console.error('Error:', err);
                return message.reply({ content: 'Error converting video to gif' });
            } finally {
                fs.unlinkSync(`temp/${userName}-TOGIFCONV.${contentType}`);
            }
        }
    }
}

    async function convertToGIF(message, userName, actualUsername, contentType, rnd5dig, lq) {
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

        const outputPath = path.join(__dirname, '..', 'userMakes', `${userName}-GIF-${rnd5dig}.gif`);

        return new Promise((resolve, reject) => {
            let progressMessage = null;
            let lastUpdateTime = 0;
            let startTime = Date.now();
            let firstUpdate = true;

            const ffmpegCommand = ffmpeg(`temp/${userName}-TOGIFCONV.${contentType}`)
                .toFormat('gif')
                .size('320x240')
                .outputOptions(['-y', '-compression_level', '6']);

            ffmpegCommand.on('progress', async (progress) => {
                const currentTime = Date.now();
                if (currentTime - lastUpdateTime >= 2000) {
                    // If this is the first update and more than 2 seconds have passed
                    if (firstUpdate && (currentTime - startTime >= 2000)) {
                        const percent = progress.percent ? progress.percent.toFixed(1) : 0;
                        const elapsedTime = (currentTime - startTime) / 1000;
                        const estimatedTotalTime = (elapsedTime / (percent / 100));
                        const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
                        const eta = Math.round(remainingTime);

                        const progressText = `converting: ${percent}%\nETA: ${eta} seconds`;
                        progressMessage = await message.reply({ content: progressText });
                        firstUpdate = false;
                    } else if (!firstUpdate && progressMessage) {
                        const percent = progress.percent ? progress.percent.toFixed(1) : 0;
                        const elapsedTime = (currentTime - startTime) / 1000;
                        const estimatedTotalTime = (elapsedTime / (percent / 100));
                        const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
                        const eta = Math.round(remainingTime);

                        const progressText = `converting: ${percent}%\nETA: ${eta} seconds`;
                        progressMessage.edit({ content: progressText }).catch(console.error);
                    }
                    lastUpdateTime = currentTime;
                }
            });

            if (lq) {
                console.log('Reduced quality GIF');
                ffmpegCommand
                    .fps(15)
                    .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine))
                    .on('end', () => {
                        const finalURL = process.env.UPLOADURL + userName + '-GIF-' + rnd5dig + '.gif';
                        if (progressMessage) {
                            progressMessage.edit({ content: finalURL }).catch(console.error);
                        } else {
                            message.reply({ content: finalURL });
                        }
                        console.log('GIF file:', outputPath);
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        if (progressMessage) {
                            progressMessage.edit({ content: 'Error during conversion!' }).catch(console.error);
                        }
                        reject(new Error('GIF conversion failed: ' + err.message));
                    })
                    .save(outputPath);
            } else {
                console.log('Normal quality GIF');
                ffmpegCommand
                    .fps(10)
                    .outputOptions([
                        '-vf', 'scale=320:240,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
                    ])
                    .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine))
                    .on('end', () => {
                        const finalURL = process.env.UPLOADURL + userName + '-GIF-' + rnd5dig + '.gif';
                        if (progressMessage) {
                            progressMessage.edit({ content: finalURL }).catch(console.error);
                        } else {
                            message.reply({ content: finalURL });
                        }
                        console.log('GIF file:', outputPath);
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        if (progressMessage) {
                            progressMessage.edit({ content: 'Error during conversion!' }).catch(console.error);
                        }
                        reject(new Error('GIF conversion failed: ' + err.message));
                    })
                    .save(outputPath);
            }
        });
    }
