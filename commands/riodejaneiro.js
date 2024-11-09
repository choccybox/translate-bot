const altnames = ['rj', 'rio', 'riodejaneiro', 'rjd', 'rdj'];
const isChainable = true;

const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv').config();
const sharp = require('sharp');

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

async function overlayImageAndText(fontPath, originalImagePath, overlaidImagePath, intensityDecimal) {
    try {
        return new Promise((resolve, reject) => {
            ffmpeg(originalImagePath)
                .input(path.resolve(__dirname, 'images/riodejaneiro.png'))  // Correct path for overlay image
                .output(overlaidImagePath)
                .outputOptions([
                    // Apply filter to overlay the image with opacity and then add text in the middle
                    `-filter_complex`,
                    `[0:v][1:v]overlay=(W-w)/2:(H-h)/2,drawtext=text='Rio De Janeiro':fontfile=${fontPath}:x=(w-text_w)/2:y=(h-text_h)/2:fontsize=30:fontcolor=white@1.0`
                ])
                .on('stderr', console.log) // Debug output for errors
                .on('end', function() {
                    console.log('Image processed:', overlaidImagePath);
                    resolve(overlaidImagePath);
                })
                .on('error', function(err) {
                    console.error('Error:', err);
                    reject(err);
                })
                .run();
        });
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}


module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const userName = userID;
        const args = message.content.split(' ');
        let intensityDecimal = 0.5; // Default intensity

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
        const imageUrl = image.url;

        try {
            // Download the base image
            const downloadImage = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const originalImagePath = `temp/${userName}-RIO.png`;
            fs.writeFileSync(originalImagePath, downloadImage.data);

            // Get image dimensions using sharp for text positioning
            const metadata = await sharp(originalImagePath).metadata();
            const width = metadata.width;
            const height = metadata.height;

            const fontPath = 'fonts/InstagramSans.ttf'; // Path to custom font file

            // Create overlayed image path
            const overlaidImagePath = `temp/${userName}-RIO-OVERLAID.png`;

            // Call function to overlay image and text
            await overlayImageAndText(width, height, fontPath, originalImagePath, overlaidImagePath, intensityDecimal);

            const imageURL = process.env.UPLOADURL + userName + '/' + userName + '-RIO-OVERLAID.png';
            console.log('Final Image:', imageURL);
            return imageURL;

        } catch (error) {
            console.error('Error processing the image:', error);
            return message.reply({ content: 'Error processing the image.' });
        }
    }
};
