import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

const ocrWorker = require('./OCRWorker.js');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const fs = require('fs');
const axios = require('axios');

const dotenv = require('dotenv');
dotenv.config();

async function ocrVideoFrame(imageUrl) {
    // download the video and save it to a folder and name it a random 8 digit number
    const randomName = Math.floor(Math.random() * 100000000);
    const videoBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const fileExtension = imageUrl.split('.').pop().split('?')[0];
    fs.writeFileSync(`temp/${randomName}-VID.${fileExtension}`, videoBuffer.data);
    console.log(`video saved as: temp/${randomName}-VID.${fileExtension}`);

    // get the first frame of the video
    const frameImage = `temp/${randomName}-VIDFRAME.jpg`;
    await new Promise((resolve, reject) => {
      ffmpeg(`temp/${randomName}-VID.${fileExtension}`)
        .outputOptions('-vframes 1')
        .output(frameImage)
        .on('end', () => {
            console.log(`frame image saved as: ${frameImage}`);
            fs.unlinkSync(`temp/${randomName}-VID.${fileExtension}`);
            console.log(`deleted: temp/${randomName}-VID.${fileExtension}`);
        
            const frameSize = fs.statSync(frameImage).size / 1024;
            console.log(`frame image size: ${frameSize} KB`);
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return ocrWorker(frameImage, randomName, 'VIDFRAME');
}

module.exports = ocrVideoFrame;