const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle, SelectMenuBuilder } = require('discord.js');
const ffmpeg = require('fluent-ffmpeg');
const videoLib = require('node-video-lib');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// define ffmpeg path
ffmpeg
  .setFfmpegPath(ffmpegPath)

dotenv.config();

let timer;
let timerExpired = false;

function createButtonRow() {
    return new ActionRowBuilder().addComponents(
        new SelectMenuBuilder()
            .setCustomId('dropdown')
            .setPlaceholder('edit gif')
            .addOptions([
                {
                    label: 'speed',
                    value: 'speed',
                },
                {
                    label: 'caption',
                    value: 'caption',
                },
            ])
    );
}

const ongoingInteractions = new Map();


async function convertToGif(videoPath, randomName, width, height, bitrate) {
    const gifPath = `temp/${randomName}-TOGIF.gif`;
    const palettePath = `temp/${randomName}-TOGIFPALLETTE.png`;

    return new Promise((resolve, reject) => {
        // Step 1: Generate the palette
        ffmpeg(videoPath)
            .output(palettePath)
            .videoFilters('palettegen')
            .on('end', () => {
                // Step 2: Use the generated palette to create the GIF
                let ffmpegCommand = ffmpeg(videoPath)
                    .input(palettePath)
                    .complexFilter([
                        '[0:v]scale=' + width + ':' + height + '[scaled]',
                        '[scaled][1:v]paletteuse'
                    ])
                    .output(gifPath)
                    .fps(15) // Set the FPS limit to 15
                    .on('end', () => {
                        resolve(gifPath);
                    })
                    .on('error', (error) => {
                        reject(error);
                    });

                const fileSizeInBytes = fs.statSync(videoPath).size;
                const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

                if (fileSizeInMB > 25) {
                    width /= 2;
                    height /= 2;
                    bitrate /= 2;
                    ffmpegCommand = ffmpegCommand
                        .complexFilter([
                            '[0:v]scale=' + width + ':' + height + '[scaled]',
                            '[scaled][1:v]paletteuse'
                        ])
                        .videoBitrate(bitrate)
                        .fps(10);

                    if (fileSizeInMB > 25) {
                        width /= 2;
                        height /= 2;
                        bitrate /= 2;
                        ffmpegCommand = ffmpegCommand
                            .complexFilter([
                                '[0:v]scale=' + width + ':' + height + '[scaled]',
                                '[scaled][1:v]paletteuse'
                            ])
                            .videoBitrate(bitrate)
                            .fps(5);
                    }
                }

                ffmpegCommand.run();
            })
            .on('error', (error) => {
                reject(error);
            })
            .run();
    });
}
function getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
        try {
            // Get the file size
            const stats = fs.statSync(videoPath);
            const fileSizeInBytes = stats.size;

            // Open the video file
            const fd = fs.openSync(videoPath, 'r');
            // Parse the video file to extract metadata
            const movie = videoLib.MovieParser.parse(fd);
            // Close the file descriptor
            fs.closeSync(fd);

            // Extract relevant metadata
            const durationInSeconds = Math.round(movie.relativeDuration());
            const bitrate = Math.round((fileSizeInBytes * 8) / durationInSeconds / 1000);

            const metadata = {
                length: durationInSeconds,
                width: movie.tracks[0].width,
                height: movie.tracks[0].height,
                bitrate: bitrate,
            };

            // Resolve the promise with the metadata
            resolve(metadata);
        } catch (error) {
            // Reject the promise in case of any error
            reject(error);
        }
    });
}

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'togif') {
        const userId = interaction.user.id;

        if (ongoingInteractions.has(userId)) {
            const previousInteraction = ongoingInteractions.get(userId);
            previousInteraction.collector.stop('new interaction');
            console.log('Stopped previous interaction for user:', userId);
        }

        const randomName = Math.floor(Math.random() * 100000000);
        // buffer the reply
        await interaction.deferReply({ ephemeral: true });

        const targetMessage = interaction.options.getAttachment('video');
        const contentType = targetMessage.contentType;
        const [attachmentType] = contentType.split('/');

        if (attachmentType !== 'video') {
            await interaction.followUp({
                embeds: [{
                    title: 'This command is only available for videos',
                    color: 0xff0000
                }],
                ephemeral: true
            });
            return;
        }

        // get the video and save it
        const videoUrl = targetMessage.url;
        const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });
        const videoPath = `temp/${randomName}-TOGIF.mp4`;

        fs.writeFileSync(videoPath, videoBuffer.data);

        // Get video information
        try {
            const videoInfo = await getVideoInfo(videoPath);
            console.log('Video information:', videoInfo);

            if (videoInfo.lenght > 30) {
                await interaction.followUp({
                    embeds: [{
                        title: 'The video must be less than 30 seconds',
                        color: 0xff0000
                    }],
                    ephemeral: true
                });
                return;
            }
            
            const bitrate = videoInfo.bitrate / 2;
            const width = videoInfo.width / 2;
            const height = videoInfo.height / 2;

            const gifPath = await convertToGif(videoPath, randomName, width, height, bitrate);
                
            const gifFinal= fs.readFileSync(gifPath);

            await interaction.followUp({
                files: [{
                    attachment: gifFinal,
                    name: `${randomName}-TOGIFFINAL.gif`
                }],
                components: [
                    createButtonRow()
                ]
            });

                function startTimer() {
                    timerExpired = false;
                    clearTimeout(timer);

                    timer = setTimeout(() => {
                        try {
                            const tempDirectory = 'temp/';
                            const files = fs.readdirSync(tempDirectory);
                            const filesToDelete = files.filter(file => file.includes(randomName));
                            
                            filesToDelete.forEach(file => {
                                const filePath = `${tempDirectory}${file}`;
                                fs.unlinkSync(filePath);
                            });
                            
                            collector.stop('timeout');
                            timerExpired = true;
                            //console.log('Timer expired');
                        } catch (cleanupError) {
                            console.error('Error cleaning up files:', cleanupError);
                        }
                    }, 60000);
                }
    
                function restartTimer() {
                    startTimer();
                }
    
                startTimer();

        } catch (error) {
            console.error('Error converting video to gif:', error);
            await interaction.followUp('There was an error converting the video to gif. Please try again later.');
        }

        ongoingInteractions.set(userId, { interaction });
    }
}
