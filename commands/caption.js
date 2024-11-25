const altnames = ['caption', 'cap', 'text', 'txt'];
const whatitdo = 'Adds a caption to an image, supports images and videos';

const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const { generate } = require('text-to-image');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained) {
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isImage = firstAttachment && firstAttachment.contentType.includes('image') || firstAttachment.contentType.includes('video');
        if (message.content.includes('help')) {
            return message.reply({
                content: 'Adds a **caption** to an image\n' +
                    'Arguments: `caption:text` where text is the caption you want to add\n' +
                    'Available alt names:`' + `${altnames.join(', ')}` + '`',
            });
        } else if (!isImage) {
            return message.reply({ content: 'Please provide an audio or video file to process.' });
        }
        const args = message.content.split(' ');

        if (args.length > 1 && args[1].includes(':')) {
            const parts = message.content.split(':');
            if (parts.length >= 2) {
                customText = parts.slice(1).join(':');
            }
        } else {
            return message.reply({ content: 'Please provide a caption in the format `caption:text`.' });
        }

        const attachmentURL = firstAttachment.url;

        try {
            const userName = message.author.id;
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            const customizedText = customText;

            // Download the base image
            const downloadAttachment = await axios.get(attachmentURL, { responseType: 'arraybuffer' });
            const originalAttachmentPath = `temp/${userName}-CAP-${rnd5dig}.${attachmentURL.split('.').pop().split('?')[0]}`;
            fs.writeFileSync(originalAttachmentPath, downloadAttachment.data);

            // Get image/video dimensions using ffprobe for text positioning
            const getDimensions = () => {
                return new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(originalAttachmentPath, (err, metadata) => {
                        if (err) return reject(err);
                        const stream = metadata.streams.find(s => s.width && s.height);
                        if (stream) {
                            resolve({ width: stream.width, height: stream.height });
                        } else {
                            reject(new Error('No stream with width and height found'));
                        }
                    });
                });
            };

            const { width, height } = await getDimensions();
            const fontPath = 'fonts/Impact.ttf';
            const overlaidAttachmentPath = `temp/${userName}-CAPFINAL-${rnd5dig}.png`;

            // get the lenght of the text to calculate the font size
            const textLength = customizedText.length;

            // calculate the font size based on the length of the words to fit them in, minimum size is 26px max is 60px
            const fontSize = Math.max(Math.min(60, (width / textLength) * 1.5), 26);

            // Call function to overlay image and text
             await overlayImageAndText(width, height, fontSize, fontPath, originalAttachmentPath, overlaidAttachmentPath, userName, rnd5dig, customizedText);

            return message.reply ({
                files: [{
                    attachment: overlaidAttachmentPath
                }]
            });

        } catch (error) {
            console.error('Error processing the image:', error);
            return message.reply({ content: `Error processing the image: ${error}`, ephemeral: true });
        }
    }
};

async function overlayImageAndText(width, height, fontSize, fontPath, originalAttachmentPath, overlaidAttachmentPath, userName, rnd5dig, customizedText) {
    try {
        // Generate text image using 'text-to-image' module
        const dataUri = await generate(customizedText, {
            debug: true,
            maxWidth: width,
            fontSize: fontSize,
            fontPath: fontPath,
            fontFamily: 'Impact',
            lineHeight: fontSize * 1.4,
            bgColor: 'white',
            textColor: 'black',
            textAlign: 'center',
            verticalAlign: 'center',
            margin: 10,
        });
        const base64Data = dataUri.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(`temp/${userName}-CAPTEXT-${rnd5dig}.png`, base64Data, 'base64');

        // use ffprobe to get the text image height and extend the attachment height to fit the text image (both video/image)
        const getDimensions = () => {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(`temp/${userName}-CAPTEXT-${rnd5dig}.png`, (err, metadata) => {
                    if (err) return reject(err);
                    const stream = metadata.streams.find(s => s.height);
                    if (stream) {
                        resolve(stream.height);
                    } else {
                        reject(new Error('No stream with height found'));
                    }
                });
            });
        };

        const height = await getDimensions();

        // use ffmpeg for video and add a white box above the video witt the height of "const height"
        const extendedAttachmentPath = `temp/${userName}-CAPSTRETCH-${rnd5dig}.png`;
        if (originalAttachmentPath.includes('mp4')) {
            await ffmpeg(originalAttachmentPath)
                .input(`temp/${userName}-CAPTEXT-${rnd5dig}.png`)
                .complexFilter([
                    // Pad the video with white box on top
                    `[0:v]pad=iw:ih+${height}:0:${height}:color=white[padded]`,
                    // Overlay the text/image on the padded video
                    `[padded][1:v]overlay=0:0`
                ])
                .output(`temp/${userName}-CAPFINAL-${rnd5dig}.mp4`)
                .run();
        } else {
            sharp.cache(false);
            // use sharp to extend the attachment height
            await sharp(originalAttachmentPath)
                .extend({ top: height, bottom: 0, left: 0, right: 0, background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .toFile(extendedAttachmentPath);

            // get CAPTEXT and overlay on top of extendedAttachment
            await sharp(extendedAttachmentPath)
                .composite([{ input: `temp/${userName}-CAPTEXT-${rnd5dig}.png`, gravity: 'north' }])
                .toFile(overlaidAttachmentPath);
        }
    } catch (error) {
        console.error('Error overlaying image and text:', error);
        return message.reply({ content: `Error overlaying image and text: ${error}`, ephemeral: true });
    } finally {
        setTimeout(() => {
            fs.unlinkSync(`temp/${userName}-CAPTEXT-${rnd5dig}.png`);
            fs.unlinkSync(originalAttachmentPath);
        }, 2000);
        if (!originalAttachmentPath.includes('mp4')) {
            fs.unlinkSync(`temp/${userName}-CAPSTRETCH-${rnd5dig}.png`);
        }
    }
}