const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('ffmpeg');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

dotenv.config();

let timer;
let timerExpired = false;

function createButtonRow(currentIntensity) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('-0.1')
            .setCustomId('intensity_down')
            .setDisabled(currentIntensity <= 0.2),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('+0.1')
            .setCustomId('intensity_up')
            .setDisabled(currentIntensity >= 0.8)
    );
}

function changeOpacity(imagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize) {
    if (fontSize < 20) {
        return new Promise((resolve, reject) => {
            ffmpeg(imagePath)
                .input('images/riodejaneiro.png')
                .complexFilter([
                    `[1:v]scale=${width}:${height},format=rgba,colorchannelmixer=aa=${intensityDecimal}[ovrl];[0:v][ovrl]overlay,drawtext=fontfile=${fontPath}:text='${overlayText}':fontcolor=white:fontsize=20:shadowcolor=black:shadowx=0:shadowy=0:x=(w-text_w)/2:y=(h-text_h)/2`
                ])
                .output(overlaidImagePath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    } else {
        return new Promise((resolve, reject) => {
            ffmpeg(imagePath)
                .input('images/riodejaneiro.png')
                .complexFilter([
                    `[1:v]scale=${width}:${height},format=rgba,colorchannelmixer=aa=${intensityDecimal}[ovrl];[0:v][ovrl]overlay,drawtext=fontfile=${fontPath}:text='${overlayText}':fontcolor=white:fontsize=${fontSize}:shadowcolor=black:shadowx=0:shadowy=0:x=(w-text_w)/2:y=(h-text_h)/2`
                ])
                .output(overlaidImagePath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    }
}

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'riodejaneiro') {
        console.log('using slash command');
        const intensity = interaction.options.getInteger('intensity');
        let intensityDecimal = intensity / 10 || 0.5;
        console.log(intensityDecimal);

        if (intensityDecimal < 0.2 || intensityDecimal > 0.8) {
            return interaction.reply({
                embeds: [{
                    title: 'Intensity must be between 2 and 8',
                    color: 0xff0000
                }],
                ephemeral: true
            });
        } else {
            await interaction.deferReply({ ephemeral: true });
        }

        const randomName = Math.floor(Math.random() * 100000000);
        const originalImagePath = `temp/${randomName}-RIO.jpg`;
        const overlaidImagePath = `temp/${randomName}-RIO-OVERLAID.jpg`;
        const overlayImagePath = 'images/riodejaneiro.png';
        const overlayText = 'Rio De Janeiro';
        const fontPath = 'fonts/InstagramSans.ttf'; // Path to your custom font file
        const fontSizePercent = 0.075; // Set the font size as a percentage of the image width and height

        try {
            const targetMessage = interaction.options.getAttachment('image');
            const imageUrl = targetMessage.url;
            const contentType = targetMessage.contentType;
            const [attachmentType, extension] = contentType.split('/');

            if (attachmentType === 'video') {
                await interaction.followUp({
                    embeds: [{
                        title: 'This command is not available for videos',
                        color: 0xff0000
                    }],
                    ephemeral: true
                });
                return;
            }

            const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(originalImagePath, imageBuffer.data);

            const originalImageMetadata = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(originalImagePath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata);
                });
            });

            const { width, height } = originalImageMetadata.streams[0];
            const fontSize = Math.min(Math.floor(width * fontSizePercent), Math.floor(height * fontSizePercent));
            console.log('Font size:', fontSize);

            await changeOpacity(originalImagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize);

            await interaction.followUp({
                files: [overlaidImagePath],
                components: [createButtonRow(intensityDecimal)]
            });

            fs.unlinkSync(overlaidImagePath);

            const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;

                if (timerExpired) {
                    await i.reply({ content: 'Timer ran out, please use the command again', ephemeral: true });
                    return;
                }

                if (i.customId === 'intensity_down') {
                    intensityDecimal = Math.max(0.2, Math.round((intensityDecimal - 0.1) * 10) / 10);
                    console.log(intensityDecimal);
                    restartTimer();
                } else if (i.customId === 'intensity_up') {
                    intensityDecimal = Math.min(0.8, Math.round((intensityDecimal + 0.1) * 10) / 10);
                    console.log(intensityDecimal);
                    restartTimer();
                }

                await changeOpacity(originalImagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize);
                setTimeout(() => {
                    fs.unlinkSync(overlaidImagePath);
                }, 1000);

                await i.update({
                    files: [overlaidImagePath],
                    components: [createButtonRow(intensityDecimal)]
                });
            });

            collector.on('end', async () => {
                try {
                    if (fs.existsSync(originalImagePath)) {
                        fs.unlinkSync(originalImagePath);
                    }
                    timerExpired = true;
                } catch (cleanupError) {
                    console.error('Error cleaning up files:', cleanupError);
                }
            });

            function startTimer() {
                timerExpired = false;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    try {
                        if (fs.existsSync(originalImagePath)) {
                            fs.unlinkSync(originalImagePath);
                        }
                        collector.stop('timeout');
                        timerExpired = true;
                        console.log('Timer expired');
                    } catch (cleanupError) {
                        console.error('Error cleaning up files:', cleanupError);
                    }
                }, 60000);
            }

            function restartTimer() {
                startTimer();
                console.log('Timer restarted');
            }

            startTimer();

        } catch (error) {
            console.error('Error processing the image:', error);
            await interaction.followUp('There was an error processing the image. Please try again later.');
        }
    }
}
