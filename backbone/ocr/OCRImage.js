import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

const ocrWorker = require('./OCRWorker.js');

const fs = require('fs');
const axios = require('axios');

const dotenv = require('dotenv');
const { default: ffmpegPath } = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
dotenv.config();

async function ocrImage(imageUrl) {
    const randomName = Math.floor(Math.random() * 100000000);
    const originalImagePath = `temp/${randomName}-IMG.jpg`;
    const compressedImagePath = `temp/${randomName}-IMGCOMP.jpg`;

    // Download the image from the URL
    const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(originalImagePath, imageBuffer.data);
    console.log(`Downloaded image to ${originalImagePath}`);

    // Compress the image using ffmpeg with a Promise
    await new Promise((resolve, reject) => {
        ffmpeg(originalImagePath)
            .outputOptions('-qscale:v 8') // Quality scale for JPEG, 2 is a good balance
            .save(compressedImagePath)
            .on('end', () => {
                console.log(`Compressed image to ${compressedImagePath}`);
                fs.unlink(originalImagePath, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`Deleted original image: ${originalImagePath}`);
                        resolve();
                    }
                });
            })
            .on('error', (err) => {
                reject(err);
            });
    });

    // Return the result of ocrWorker
    return ocrWorker(compressedImagePath, randomName, 'IMGCOMP');
}

module.exports = ocrImage;
