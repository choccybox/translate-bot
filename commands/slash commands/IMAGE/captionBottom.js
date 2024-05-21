const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const ffprobePath = require('ffprobe-static').path;
const sharp = require('sharp');

const path = require('path');

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'caption-bottom') {
        const caption = interaction.options.getString('caption');
        console.log('bottom caption')

        const randomName = Math.floor(Math.random() * 100000000);
        const originalImagePath = `temp/${randomName}-CAPTION.jpg`;
        const overlaidImagePath = `temp/${randomName}-CAPTION-OVERLAID.jpg`;
        const overlayText = caption;

        // Constants for configuration
        const MAX_FONT_SIZE = 60;
        const MIN_FONT_SIZE = 20;

        try {
            const image = interaction.options.getAttachment('image');
            const imageUrl = image.url;
            const contentType = image.contentType;
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

            // Adjust the font size based on the image width
            const FONT_SIZE = Math.min(Math.max(width / 10, MIN_FONT_SIZE), MAX_FONT_SIZE);

            console.log('Font size:', FONT_SIZE);

            // Dynamically determine the maximum number of characters per line
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

            const TextToSVG = require('text-to-svg');

            const textToSVG = TextToSVG.loadSync("fonts/Futura.ttf");

            // Create a new image for each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Create the overlay SVG for the current line
                const lineNew = textToSVG.getSVG(line, {
                    fontSize: FONT_SIZE,
                    anchor: "centre top",
                    attributes: {
                        fill: "black",
                    },
                });

                void sharp(Buffer.from(lineNew)).toFile(`temp/line${i}.png`);   
                
                // get the width and height of the image using ffprobe
                const imageMetadata = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(`temp/line${i}.png`, (err, metadata) => {
                        if (err) reject(err);
                        else resolve(metadata);
                    });
                });

                console.log('original image width:', width);
                console.log('imageMetadata width:', imageMetadata.streams[0].width);
                console.log('imageMetadata height:', imageMetadata.streams[0].height);

                // calculate the left offset for each text image
                const leftOffset = Math.round((width - imageMetadata.streams[0].width) / 2);
                console.log('left offset:', leftOffset);

                // create a white box with the height of the text image and width of the original image
                const boxHeight = Math.round(imageMetadata.streams[0].height);
                const boxWidth = width;
                const totalBoxHeight =  Math.round(boxHeight * (i + 1) + (boxHeight / 2));
                console.log('total box height:', totalBoxHeight);

                await sharp({
                    create: {
                        width: boxWidth,
                        height: boxHeight,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 0 }
                    }
                })
                .toFile(`temp/box${i}-white.png`);

                // composite the text image on top of the white box
                await sharp(`temp/box${i}-white.png`)
                .composite([{
                    input: `temp/line${i}.png`,
                    top: 0,
                    left: leftOffset
                }])
                .toFile(`temp/line${i}-composite.png`);
                sharp.cache(false);
                 fs.unlinkSync(`temp/line${i}.png`);
                fs.unlinkSync(`temp/box${i}-white.png`);

                // get all of the images and composite them together by stacking them vertically
                const images = [];
                for (let j = 0; j <= i; j++) {
                    images.push(`temp/line${j}-composite.png`);
                }

                // get the original image, extend it by the height of the box, and composite the text images on top
                await sharp(originalImagePath)
                .extend({
                    top: 0,
                    bottom: totalBoxHeight,
                    left: 0,
                    right: 0,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .composite(images.map((image) => ({
                    input: image,
                    top: Math.round((height + (boxHeight/4)) + (images.indexOf(image) * boxHeight)),
                    left: 0,
                }))
                )
                .toFile(overlaidImagePath);
            }
        
            await interaction.followUp({
                files: [overlaidImagePath]
            });
             fs.unlinkSync(originalImagePath);

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
