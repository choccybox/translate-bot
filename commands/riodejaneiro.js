const altnames = ['rj', 'rio', 'riodejaneiro', 'rjd', 'rdj'];
const whatitdo = 'Adds a Rio De Janeiro instagram filter over an image, supports images and videos';

const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const { generate } = require('text-to-image');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained) {
        if (message.content.includes('help')) {
            return message.reply({
                content: 'Adds a **Rio De Janeiro** instagram filter over an image\n' +
                    'Arguments: `rio:intesity` where intensity is a number between 2 and 8. (default is 5)\nrio:customtext` where customtext is any different text you want (can be combined with intesity)\n' +
                    'Available alt names:`' + `${altnames.join(', ')}` + '`',
            });
        }
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isImage = firstAttachment && firstAttachment.contentType.includes('image') || firstAttachment.contentType.includes('video');
        if (!isImage || !firstAttachment) {
            return message.reply({ content: 'Please provide an audio or video file to process.' });
            // else if its a gif
        } else if (firstAttachment.contentType.includes('gif')) {
            return message.reply({ content: 'gifs will be converted to mp4, fuck you thats why' })
        }
        const args = message.content.split(' ');
        let intensityDecimal = 0.5; // Default intensity
        let customText = 'Rio De Janeiro'; // Default text

        if (args.length > 1 && args[1].includes(':')) {
            const parts = message.content.split(':');
            if (parts.length === 2) {
                if (isNaN(parts[1])) {
                    customText = parts.slice(1).join(':');
                } else {
                    intensityDecimal = parseInt(parts[1], 10) / 10 || 0.5;
                }
            } else if (parts.length >= 3) {
                if (isNaN(parts[1])) {
                    customText = parts.slice(1, -1).join(':');
                    intensityDecimal = parseInt(parts[parts.length - 1], 10) / 10 || 0.5;
                } else {
                    intensityDecimal = parseInt(parts[1], 10) / 10 || 0.5;
                    customText = parts.slice(2).join(':');
                }
            }
        }

        const attachmentURL = firstAttachment.url;

        try {
            const userName = message.author.id;
            const opacity = intensityDecimal;
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            const customizedText = customText ? customText : 'Rio De Janeiro';

            // Download the base attachment, convert gifs to mp4
            const downloadAttachment = await axios.get(attachmentURL, { responseType: 'arraybuffer' });
            let originalAttachmentPath = `temp/${userName}-RIO-${rnd5dig}.${attachmentURL.split('.').pop().split('?')[0]}`;
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

            let extension = originalAttachmentPath.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
                extension = 'png';
            } else if (['mkv', 'webm', 'mp4'].includes(extension)) {
                extension = 'mp4';
            }

            const fontPath = 'fonts/InstagramSans.ttf'; // Path to custom font file
            const overlaidAttachmentPath = `temp/${userName}-RIOOVERLAID-${rnd5dig}.png`;
            const finalPath = `temp/${userName}-RIOFINAL-${rnd5dig}.${extension}`;

            // set the font size to 1/10th of the image entire size
            const fontSize = Math.floor(Math.min(width, height) / 10);

            // Call function to overlay image and text
            message.react('<a:pukekospin:1311021344149868555>').catch(() => message.react('👍'));
            await overlayImageAndText(width, height, fontSize, fontPath, originalAttachmentPath, overlaidAttachmentPath, opacity, userName, rnd5dig, customizedText, extension);

            await message.reply({
                files: [{
                    attachment: finalPath
                }]
            });
            message.reactions.removeAll().catch(console.error);
            return

        } catch (error) {
            console.error('Error processing the image:', error);
            return message.reply({ content: `Error processing the image: ${error}`, ephemeral: true });
        }
    }
};

async function overlayImageAndText(width, height, fontSize, fontPath, originalAttachmentPath, overlaidAttachmentPath, opacity, userName, rnd5dig, customizedText, extension) {
    try {
        sharp.cache(false);
        // Resize 'riodejaneiro.png' to match the specified width and height and set opacity
        const overlayImage = await sharp(`images/riodejaneiro.png`)
            .resize(width, height)
            .ensureAlpha(opacity)
            .toBuffer();
            fs.writeFileSync(`temp/${userName}-RIOSTRETCH-${rnd5dig}.png`, overlayImage);

        // Generate text image using 'text-to-image' module
        const dataUri = await generate(customizedText, {
            debug: true,
            maxWidth: width,
            customHeight: height,
            fontSize: fontSize,
            fontPath: fontPath,
            fontFamily: 'InstagramSans',
            lineHeight: fontSize * 1.2,
            bgColor: 'transparent',
            textColor: 'white',
            textAlign: 'center',
            verticalAlign: 'center',
        });
        const base64Data = dataUri.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(`temp/${userName}-RIOTEXT-${rnd5dig}.png`, base64Data, 'base64');

        // overlay the text image on the resized overlay image
        const overlayedImage = await sharp(`temp/${userName}-RIOSTRETCH-${rnd5dig}.png`)
            .composite([{ input: `temp/${userName}-RIOTEXT-${rnd5dig}.png` }])
            .toBuffer();
            fs.writeFileSync(overlaidAttachmentPath, overlayedImage);
        
        // if file is a video, use ffmpeg to overlay the image over the video
        if (originalAttachmentPath.includes('mp4')) {
            console.log('Overlaying image on video');
            const videoOutputPath = `temp/${userName}-RIOFINAL-${rnd5dig}.mp4`;
            await new Promise((resolve, reject) => {
                ffmpeg(originalAttachmentPath)
                    .input(overlaidAttachmentPath)
                    .complexFilter([
                        {
                            filter: 'overlay',
                            options: {
                                x: '(main_w-overlay_w)/2',
                                y: '(main_h-overlay_h)/2',
                            },
                        },
                    ])
                    .outputOptions(['-c:a copy'])
                    .output(videoOutputPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
            return videoOutputPath;
        } else {
            // overlay the image on the original image
            const overlayedImage = await sharp(originalAttachmentPath)
                .composite([{ input: overlaidAttachmentPath }])
                .toBuffer();
            fs.writeFileSync(`temp/${userName}-RIOFINAL-${rnd5dig}.png`, overlayedImage);
            return `temp/${userName}-RIOFINAL-${rnd5dig}.png`;
        }

    } catch (error) {
        console.error('Error overlaying image and text:', error);
        throw new Error('Error overlaying image and text');
    } finally {
        fs.unlinkSync(`temp/${userName}-RIOSTRETCH-${rnd5dig}.png`);
        fs.unlinkSync(`temp/${userName}-RIOTEXT-${rnd5dig}.png`);
        fs.unlinkSync(`temp/${userName}-RIOOVERLAID-${rnd5dig}.png`);
        setTimeout(() => {
            fs.unlinkSync(`temp/${userName}-RIOFINAL-${rnd5dig}.${extension}`);
        }, 10000);
        fs.unlinkSync(originalAttachmentPath);
    }
}