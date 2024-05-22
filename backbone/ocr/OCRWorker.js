import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});

const fs = require('fs');
const axios = require('axios');

const sharp = require('sharp');

const dotenv = require('dotenv');
dotenv.config();

async function uploadToImbggAndOCR(imageOCR, randomName, OCRtype) {
    const urlConfig = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    }

    console.log('got image: ' + imageOCR);
    // modify the image to base64 and upload it to imgbb
    const base64Image = fs.readFileSync(imageOCR, { encoding: 'base64' });
    console.log(`image converted to base64`);

    // upload to https://api.imgbb.com/1/upload
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    const imgbbUrl = 'https://api.imgbb.com/1/upload';
    const imgbbParams = new URLSearchParams();
    imgbbParams.append('key', imgbbApiKey);
    imgbbParams.append('image', base64Image);
    imgbbParams.append('expiration', '600');

    const imgbbConfig = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    const imgbbResponse = await axios.post(imgbbUrl, imgbbParams.toString(), imgbbConfig);
    const imgbbData = imgbbResponse.data;
    const imgbbURL = imgbbData.data.url;
    console.log(`image uploaded to: ${imgbbURL}`);
    
    const ocrApiKey = process.env.OCR_SPACE_API_KEY;
    const ocrUrl = 'https://api.ocr.space/parse/image';

    const ocrParams = new URLSearchParams();
    ocrParams.append('apikey', ocrApiKey);
    ocrParams.append('isOverlayRequired', 'true');
    ocrParams.append('url', imgbbURL);
    ocrParams.append('OCREngine', '2');
    
    // locally count the time it takes to process the image
    const startTime = new Date().getTime();
    console.log(`OCR request started: ${startTime}`);

    const ocrResponse = await axios.post(ocrUrl, ocrParams.toString(), urlConfig);

    // once the response is received, count the time again
    const endTime = new Date().getTime();
    console.log(`OCR response received: ${endTime}`);

    // round timeDiff to the 2 decimal places
    const timeDiff = Math.round((endTime - startTime) * 100) / 100;
    console.log(`OCR took ${timeDiff / 1000} milliseconds to process the image.`);

    // format timeDiff to human readable format, round to the 2 decimal places
    const timeTook = 'OCR time: ' + timeDiff / 1000 + 's\nfile size: ' + Math.round(fs.statSync(imageOCR).size / 1024) + 'KB';

    const ocrData = ocrResponse.data;

    // get the textoverlay left and top coordinates and console.log them
    const textOverlay = ocrData.ParsedResults[0].TextOverlay;

    // if no text is detected, throw an error
    if (!ocrData.ParsedResults[0].ParsedText) {
        return [{ ocrText: 'no text detected', imgbbOverlayURL: imgbbURL, timeTook: timeTook }];
    }
    // remove line breaks from the text
    const ocrText = ocrData.ParsedResults[0].ParsedText;

    const boxes = [];
    for (const line of textOverlay.Lines) {
      for (const word of line.Words) {
        const box = {
          left: word.Left,
          top: line.MinTop,
          width: word.Width,
          height: line.MaxHeight,
          // You can add additional properties here like color or text content
        };
        boxes.push(box);
      }
    }
    
    console.log("Word bounding boxes:");
    console.log(boxes);

    const overlayPath = `temp/${randomName}-${OCRtype}-OVER.png`;
    
    // Create the overlay image using sharp
    const overlaySVG = `
    <svg width="${boxes.reduce((max, box) => Math.max(max, box.left + box.width), 0)}" height="${boxes.reduce((max, box) => Math.max(max, box.top + box.height), 0)}">
        ${boxes.map(box => `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="rgba(255,250,205, 0.3)" />`).join('')}
    </svg>`;
    await sharp(Buffer.from(overlaySVG))
        .toFile(overlayPath);
    
    console.log(`Overlay image created at ${overlayPath}`);

    // put overlay on the original image
    const originalImagePath = imageOCR;
    const finalImagePath = `temp/${randomName}-FINAL.png`;

    // put the overlay at 0 0 coordinates on the original image
    await sharp(originalImagePath)
        .composite([
            { input: overlayPath, top: 0, left: 0 }
        ])
        .toFile(finalImagePath);


    // upload the final image with overlay to imgbb
    const base64FinalImage = fs.readFileSync(finalImagePath, { encoding: 'base64' });
    const imgbbOverlayParams = new URLSearchParams();
    imgbbOverlayParams.append('key', imgbbApiKey);
    imgbbOverlayParams.append('image', base64FinalImage);
    imgbbOverlayParams.append('expiration', '600');

    const imgbbOverlayResponse = await axios.post(imgbbUrl, imgbbOverlayParams.toString(), urlConfig);
    const imgbbOverlayData = imgbbOverlayResponse.data;
    const imgbbOverlayURL = imgbbOverlayData.data.url;
    console.log(`Final image with overlay uploaded to: ${imgbbOverlayURL}`);

    sharp.cache(false);
    // Delete the final image
    fs.unlinkSync(finalImagePath);
    fs.unlinkSync(overlayPath);
    fs.unlinkSync(imageOCR);
    console.log(`Deleted final image: ${finalImagePath}`);

    return [{ ocrText, imgbbOverlayURL, timeTook }];
}

module.exports = uploadToImbggAndOCR;
