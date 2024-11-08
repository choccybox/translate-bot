const altnames = ['rj', 'rio', 'riodejaneiro', 'rjd', 'rdj'];
const isChainable = true;
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const textToSVG = require('text-to-svg');
const path = require('path');
const dotenv = require('dotenv').config();

// Function to change the opacity of the image and overlay text
async function changeOpacity(interaction, imagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, minTextSize, randomName, fontSize, userID) {
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

        const textToSVGInstance = textToSVG.loadSync(fontPath);
        const textToSVGOptions = {
            x: 0,
            y: 0,
            fontSize: fontSize, // Use fontSize to set the size of the text
            anchor: 'top',
            attributes: { fill: 'white' }
        };
        const textSVG = textToSVGInstance.getSVG(overlayText, textToSVGOptions);
        fs.writeFileSync(`temp/${userID}.svg`, textSVG);

        const textMetadata = await sharp(`temp/${userID}.svg`).metadata();
        const textWidth = textMetadata.width;
        const textHeight = textMetadata.height;
        const svgText = `<svg width="${textWidth}" height="${textHeight}">${textSVG}</svg>`;

        const finalOverlayData = await sharp(dataWithOpacity)
            .composite([{ input: Buffer.from(svgText), blend: 'over' }])
            .toBuffer();

        await sharp(imagePath)
            .composite([{ input: finalOverlayData, blend: 'over' }])
            .toFile(overlaidImagePath);

        sharp.cache(false); // Disable caching
        return overlaidImagePath;
    } catch (error) {
        console.error('Error processing the image:', error);
        throw error; // Rethrow error for further handling
    }
}

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const userName = userID;
        const args = message.content.split(' ');
        const intensity = parseInt(args[1], 10);
        let intensityDecimal = intensity / 10 || 0.5; // Default intensity
        const originalImagePath = `userMakes/${userName}/${userName}-RIO.png`;
        const overlaidImagePath = `userMakes/${userName}/${userName}-RIO-OVERLAID.png`;
        const overlayText = 'Rio De Janeiro';
        const minTextSize = 20;
        const fontPath = 'fonts/InstagramSans.ttf'; // Path to custom font file

        if (args.length > 1 && args[1].includes(':')) {
            const parts = args[1].split(':');
            intensityDecimal = parseInt(parts[1], 10) / 10 || 0.5;
            console.log('Intensity:', intensityDecimal);
        }

        // Check for image in currentAttachments or message.attachments
        const image = currentAttachments.first() || message.attachments.first();
        if (!image) {
            return message.reply({ content: 'Please provide an image to process.' });
        }
        console.log('Processing Image:', image.url);
        const imageUrl = image.url;

        try {
            const downloadImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(originalImagePath, downloadImage.data);

            const metadata = await sharp(originalImagePath).metadata();
            const width = metadata.width;
            const height = metadata.height;

            // calculate the font size based on the image dimensions
            const fontSize = Math.max(Math.round(Math.min(width, height) / 20), minTextSize);

            // Call function to change opacity and overlay text
            const finalImage = await changeOpacity(message, originalImagePath, intensityDecimal, overlaidImagePath, width, height, overlayText, fontPath, minTextSize, fontSize, userID);
            await finalImage; // Ensure the final image processing is complete
            const imageURL = process.env.UPLOADURL + userName + '/' + userName + '-RIO-OVERLAID.png';
            console.log('Final Image:', imageURL);
            return imageURL;
            
        } catch (error) {
            console.error('Error processing the image:', error);
            return message.reply({ content: 'Error processing the image.' });
        }
    }
};
