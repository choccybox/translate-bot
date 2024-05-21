const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const ffprobePath = require('ffprobe-static').path;
const sharp = require('sharp');
const path = require('path');
const TextToSVG = require('text-to-svg');

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'caption-top') {
        const caption = interaction.options.getString('caption');
        console.log('Top caption:', caption);

        const randomName = Math.floor(Math.random() * 100000000);
        const originalImagePath = `temp/${randomName}-CAPTION.jpg`;
        const overlaidImagePath = `temp/${randomName}-CAPTION-OVERLAID.jpg`;
        const overlayText = caption;

        const MAX_FONT_SIZE = 60;
        const MIN_FONT_SIZE = 20;

        try {
            const image = interaction.options.getAttachment('image');
            const imageUrl = image.url;
            const contentType = image.contentType;
            const [attachmentType, extension] = contentType.split('/');

            if (attachmentType === 'video') {
                await interaction.followUp({
                    embeds: [{ title: 'This command is not available for videos', color: 0xff0000 }],
                    ephemeral: true
                });
                return;
            } else {
                await interaction.deferReply({ ephemeral: true });
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

            const FONT_SIZE = Math.min(Math.max(width / 10, MIN_FONT_SIZE), MAX_FONT_SIZE);
            console.log('Font size:', FONT_SIZE);

            const maxCharsPerLine = Math.floor(width / (FONT_SIZE / 2));
            const lines = [];
            let line = '';
            for (const word of overlayText.split(' ')) {
                if (line.length + word.length <= maxCharsPerLine) {
                    line += word + ' ';
                } else {
                    lines.push(line.trim());
                    line = word + ' ';
                }
            }
            lines.push(line.trim());
            console.log('Max characters per line:', maxCharsPerLine);
            console.log('Lines:', lines);

            const textToSVG = TextToSVG.loadSync("fonts/Futura.ttf");

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const lineNew = textToSVG.getSVG(line, {
                    fontSize: FONT_SIZE,
                    anchor: "centre top",
                    attributes: { fill: "black" },
                });

                await sharp(Buffer.from(lineNew)).toFile(`temp/line${i}.png`);

                const imageMetadata = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(`temp/line${i}.png`, (err, metadata) => {
                        if (err) reject(err);
                        else resolve(metadata);
                    });
                });

                console.log('original image width:', width);
                console.log('imageMetadata width:', imageMetadata.streams[0].width);
                console.log('imageMetadata height:', imageMetadata.streams[0].height);

                const leftOffset = Math.round((width - imageMetadata.streams[0].width) / 2);
                console.log('left offset:', leftOffset);

                const boxHeight = imageMetadata.streams[0].height;
                const boxWidth = width;
                const totalBoxHeight = Math.round(boxHeight * (i + 1) + (boxHeight / 2));
                console.log('total box height:', totalBoxHeight);

                await sharp({
                    create: {
                        width: boxWidth,
                        height: boxHeight,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 0 }
                    }
                }).toFile(`temp/box${i}-white.png`);

                await sharp(`temp/box${i}-white.png`)
                    .composite([{ input: `temp/line${i}.png`, top: 0, left: leftOffset }])
                    .toFile(`temp/line${i}-composite.png`);
                sharp.cache(false);
                fs.unlinkSync(`temp/line${i}.png`);
                fs.unlinkSync(`temp/box${i}-white.png`);

                const images = [];
                for (let j = 0; j <= i; j++) {
                    images.push(`temp/line${j}-composite.png`);
                }

                await sharp(originalImagePath)
                    .extend({
                        top: totalBoxHeight,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    })
                    .composite(images.map((image, idx) => ({
                        input: image,
                        top: idx * boxHeight + Math.round((boxHeight / 4)),
                        left: 0,
                    })))
                    .toFile(overlaidImagePath);
            }

            await interaction.followUp({ files: [overlaidImagePath] });
            fs.unlinkSync(originalImagePath);
            fs.unlinkSync(`temp/line0-composite.png`);

        } catch (error) {
            console.error('Error processing the image:', error);
            if (!interaction.deferred) {
                await interaction.followUp('There was an error processing the image. Please try again later.');
            }
        } finally {
            try {
                fs.unlinkSync(overlaidImagePath);
            } catch (error) {
                console.error('Error deleting files:', error);
            }
        }
    }
};
