const altnames = ['togif', 'gif', '2gif'];
const isChainable = true;
const whatitdo = 'Converts a video to a gif, supports videos';

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
                content: `**converts a video to a gif**\n` +
                    `**Usage: ${altnames.join(', ')}\n` +
                    '**Arguments:**\n' +
                    'tt - removes tiktok outro\n' +
                    'autocrop - automatically crops the video to get rid of black bars\n'
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

            const height = attachment.height / 2;
            const width = attachment.width / 2;

            const args = message.content.split(' ');

            // Check for arguments in the command
            let removeTT = false;
            let autoCrop = false;

            for (const arg of args) {
                const lowerArg = arg.toLowerCase();
                if (lowerArg.includes('tt')) {
                    console.log('Removing TikTok outro');
                    removeTT = true;
                }
                if (lowerArg.includes('autocrop')) {
                    console.log('Auto-cropping video');
                    autoCrop = true;
                }
            }
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOGIFCONV-${rnd5dig}.${contentType}`, fileData);

            console.log('Downloaded File:', `${userName}-TOGIFCONV-${rnd5dig}.${contentType}`);
            console.log('file type:', fileType);

            const duration = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(`temp/${userName}-TOGIFCONV-${rnd5dig}.${contentType}`, (err, metadata) => {
                    if (err) return reject(err);
                    const stream = metadata.streams.find(s => s.duration);
                    if (stream) {
                        resolve(stream.duration);
                    } else {
                        reject(new Error('No stream with duration found'));
                    }
                });
            });
            if (duration > 60) {
                return message.reply({ content: 'Video duration is too long, please provide a video with a duration of 60 seconds or less.' });
            }

            try {
                message.react('<:DAMN:1307816669057388625>').catch(() => message.react('👍'));
                await convertToGIF(message, userName, actualUsername, contentType, rnd5dig, height, width, duration, autoCrop, removeTT);
            } catch (err) {
                console.error('Error:', err);
                return message.reply({ content: 'Error converting video to gif' });
            } finally {
                fs.unlinkSync(`temp/${userName}-TOGIFCONV-${rnd5dig}.${contentType}`);
            }
        }
    }
}


    async function convertToGIF(message, userName, actualUsername, contentType, rnd5dig, height, width, duration, autoCrop, removeTT) {
        const outputPath = `temp/${userName}-GIFFINAL-${rnd5dig}.gif`;

        const autoCropFilter = autoCrop ? ';cropdetect:' : '';
        const removeTTFilter = removeTT ? ';trim=end=' + (Math.round(duration) - 1) : '';

        return new Promise((resolve, reject) => {
            let progressMessage = null;
            let lastUpdateTime = 0;
            let startTime = Date.now();
            let firstUpdate = true;

            const ffmpegCommand = ffmpeg(`temp/${userName}-TOGIFCONV-${rnd5dig}.${contentType}`)
                .toFormat('gif')
                .size(`${width}x${height}`)
                .outputOptions(['-y', '-compression_level', '6' ]);

            ffmpegCommand.on('progress', async (progress) => {
                const currentTime = Date.now();
                if (currentTime - lastUpdateTime >= 1000) {
                    if (firstUpdate && (currentTime - startTime >= 1000)) {
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

            const durfpstable = [
                [10, 10],
                [15, 8],
                [20, 6],
                [30, 4]
            ]
            
            console.log('using this option:', durfpstable.find(([dur]) => duration < dur)[1]);

            ffmpegCommand
                .fps(durfpstable.find(([dur]) => duration < dur)[1])
                .outputOptions([
                    '-vf', `scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`
                ])
                .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine))
                .on('end', () => {
                    const finalURL = process.env.UPLOADURL + userName + '-GIFFINAL-' + rnd5dig + '.gif';
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
        });
    }