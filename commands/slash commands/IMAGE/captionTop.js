const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const sharp = require('sharp');
const TextToSVG = require('text-to-svg');

dotenv.config();

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

            const originalImageMetadata = await sharp(originalImagePath).metadata();

            const { width, height } = originalImageMetadata;

            const FONT_SIZE = Math.min(Math.max(width / 10, MIN_FONT_SIZE), MAX_FONT_SIZE);
            console.log('Font size:', FONT_SIZE);

            const maxCharsPerLine = Math.floor(width / (FONT_SIZE / 1.75));
            const lines = [];
            let line = '';
            for (const word of overlayText.split(' ')) {
                if (word.length > maxCharsPerLine) {
                    let remainingWord = word;
                    while (remainingWord.length > maxCharsPerLine) {
                        const splitWord = remainingWord.slice(0, maxCharsPerLine);
                        lines.push(splitWord.trim());
                        remainingWord = remainingWord.slice(maxCharsPerLine);
                    }
                    line += remainingWord + ' ';
                } else if (line.length + word.length <= maxCharsPerLine) {
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

                const imageMetadata = await sharp(`temp/line${i}.png`).metadata();

                console.log('original image width:', width);
                console.log('imageMetadata width:', imageMetadata.width);
                console.log('imageMetadata height:', imageMetadata.height);

                const leftOffset = Math.round((width - imageMetadata.width) / 2);
                console.log('left offset:', leftOffset);

                const boxHeight = Math.round(imageMetadata.height);
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
                })
                .toFile(`temp/box${i}-white.png`);

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
            fs.unlinkSync(`temp/line${lines.length - 1}-composite.png`);

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
