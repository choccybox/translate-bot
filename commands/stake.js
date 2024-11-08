const altnames = ['stake', 'stk'];
const isChainable = true;
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('ffmpeg');
const sharp = require('sharp');

async function addWatermarkToImage(imagePath, logoPath, outputPath) {
    return new Promise((resolve, reject) => {
        const addLogoToImage = new ffmpeg(imagePath);
        addLogoToImage.then((imageProcess) => {
            imageProcess.fnAddWatermark(logoPath, outputPath, {
                position: 'SW',
                margin_sud: 10,
                margin_west: 10,
            }, (error, file) => {
                if (error) {
                    console.error('Error adding watermark:', error);
                    reject('There was an error processing your request.');
                } else {
                    resolve(file);
                }
            });
        }).catch(err => {
            console.log('Error:', err);
            reject('Error processing the image.');
        });
    });
}

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        console.log('stake cur attch:', currentAttachments);

        // Check for attachments
        const attachment = currentAttachments.first() || message.attachments.first();
        if (!attachment) {
            return message.reply({ content: 'Please provide an image or video to process.' });
        }

        console.log('Processing Attachment:', attachment);

        const fileUrl = attachment.url;
        const randomName = userID
        const contentType = attachment.contentType.split('/')[1];
    
        const downloadImage = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const imageData = downloadImage.data;
        await fs.writeFileSync(`userMakes/${userID}/${userID}/.${contentType}`, imageData);

        console.log('Downloaded File:', `${randomName}.${contentType}`);

        console.log('isChained stake:', isChained);

        const args = message.content.split(' ');
        let logoSize = 0.2; // Default logo size

        if (args.length > 1 && args[1].includes(':')) {
            const parts = args[1].split(':');
            logoSize = parseInt(parts[1], 10) / 100 || 0.2;
            console.log('Logo size:', logoSize);
        }

        const isGif = attachment.contentType === 'image/gif';
        const isImage = attachment.contentType.startsWith('image/') && !isGif;
        const videoExtension = isGif ? 'gif' : 'mp4';
        const outputExtension = isGif ? 'gif' : 'mp4';

        try {
            if (isImage) {
                const image = `temp/${randomName}.${contentType}`;
                const logo = 'images/stake_logo.png';

                // Get image metadata using sharp
                const imageMetadata = await sharp(image).metadata();
                const imageWidth = imageMetadata.width;
                const imageHeight = imageMetadata.height;

                // Resize logo using sharp
                const resizedLogoPath = `temp/${randomName}_resized_logo.png`;
                await sharp(logo)
                    .resize({ width: Math.floor(imageWidth * logoSize), height: Math.floor(imageHeight * logoSize) })
                    .toFile(resizedLogoPath);

                // Add watermark to the image
                const outputImagePath = `temp/${randomName}_watermarked.${contentType}`;
                await addWatermarkToImage(image, resizedLogoPath, outputImagePath);
                
                console.log('Watermarked File:', outputImagePath);
                return { attachments: [outputImagePath] };
            } else {
                // Video handling part
                const video = await new ffmpeg(`temp/${randomName}.${videoExtension}`);

                // Resize the logo for the video
                const image = 'images/stake_logo.png';
                await sharp(image)
                    .resize({ width: Math.floor(video.metadata.video.resolution.w * logoSize), height: Math.floor(video.metadata.video.resolution.h * logoSize) })
                    .toFile(`temp/${randomName}.png`);

                // Add watermark to the video
                const watermarkedFile = await addWatermarkToImage(`temp/${randomName}.${videoExtension}`, `temp/${randomName}.png`, `temp/${randomName}_watermarked.${outputExtension}`);
                console.log('Watermarked Video File:', watermarkedFile);
                return { attachments: [watermarkedFile] };
            }
        } catch (error) {
            console.error('Error processing:', error);
            return { attachments: null, error: 'Error processing the file.' };
        }
    }
};
