import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

const ocrWorker = require('./OCRWorker.js');

const fs = require('fs');
const axios = require('axios');

const dotenv = require('dotenv');
const sharp = require('sharp');
dotenv.config();

async function ocrImage(imageUrl) {
  // Generate random names for image paths
  const randomName = Math.floor(Math.random() * 100000000);
  const originalImagePath = `temp/${randomName}-IMG.jpg`;
  const compressedImagePath = `temp/${randomName}-IMGCOMP.jpg`;

  // Download the image from the URL
  const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  fs.writeFileSync(originalImagePath, imageBuffer.data);
  console.log(`Downloaded image to ${originalImagePath}`);

  // use sharp to compress the image
    await sharp(originalImagePath)
        .jpeg({ quality: 80 })
        .toFile(compressedImagePath);
    console.log(`Compressed image to ${compressedImagePath}`);
    sharp.cache(false);
    fs.unlinkSync(originalImagePath);

    return ocrWorker(compressedImagePath, randomName, 'IMG');
}

module.exports = ocrImage;

