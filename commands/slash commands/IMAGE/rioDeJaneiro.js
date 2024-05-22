const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const sharp = require('sharp');

dotenv.config();

let timer;
let timerExpired = false;

const ongoingInteractions = new Map();

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

async function changeOpacity(interaction, imagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize) {
    // Resize the riodejaneiro image and change its opacity
    try {
        const data = await sharp('images/riodejaneiro.png')
            .resize(width, height)
            .toBuffer();

        const dataWithOpacity = await sharp(data)
            .composite([{
                input: Buffer.from(
                    `<svg width="${width}" height="${height}">
                        <rect x="0" y="0" width="${width}" height="${height}" fill="black" fill-opacity="${intensityDecimal}"/>
                    </svg>`
                ),
                blend: 'dest-in'
            }])
            .toBuffer();

        const textMeta = await sharp('images/rioDeJaneiroText.png').metadata();
        const textWidth = textMeta.width;
        const textHeight = textMeta.height;

        const left = Math.round((width - textWidth) / 2);
        const top = Math.round((height - textHeight) / 2);

        const finalOverlayData = await sharp(dataWithOpacity)
            .composite([{ input: 'images/rioDeJaneiroText.png', top, left }])
            .toBuffer();

        await sharp(imagePath)
            .composite([{ input: finalOverlayData, blend: 'over' }])
            .toFile(overlaidImagePath);

        console.log(`Final image saved as: ${overlaidImagePath}`);
        sharp.cache(false);
        return overlaidImagePath;
    } catch (error) {
        console.error('Error processing the image:', error);
        throw error;
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

        const userId = interaction.user.id;
        const commandName = interaction.commandName;

        if (ongoingInteractions.has(userId)) {
            const previousInteraction = ongoingInteractions.get(userId);
            previousInteraction.collector.stop('new interaction');
            console.log('Stopped previous interaction for user:', userId);
        }

        const randomName = Math.floor(Math.random() * 100000000);
        const originalImagePath = `temp/${randomName}-RIO.png`;
        const overlaidImagePath = `temp/${randomName}-RIO-OVERLAID.png`;
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

            const originalImageMetadata = await sharp(originalImagePath).metadata();

            const { width, height } = originalImageMetadata;
            const fontSize = Math.min(Math.floor(width * fontSizePercent), Math.floor(height * fontSizePercent));
            console.log('Font size:', fontSize);

            await changeOpacity(interaction, originalImagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize);

            if (fs.existsSync(overlaidImagePath)) {
                await interaction.followUp({ files: [overlaidImagePath], components: [createButtonRow(intensityDecimal)] });
            } else {
                setTimeout(() => {
                    interaction.followUp({ files: [overlaidImagePath], components: [createButtonRow(intensityDecimal)] });
                }, 1000);
            }

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

                await changeOpacity(interaction, originalImagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, fontSize);

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
                    if (fs.existsSync(overlaidImagePath)) {
                        fs.unlinkSync(overlaidImagePath);
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
                        if (fs.existsSync(overlaidImagePath)) {
                            fs.unlinkSync(overlaidImagePath);
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

            ongoingInteractions.set(userId, { interaction, collector });

        } catch (error) {
            console.error('Error processing the image:', error);
            await interaction.followUp('There was an error processing the image. Please try again later.');
        }
    }
}
