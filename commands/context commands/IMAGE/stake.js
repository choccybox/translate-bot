const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('ffmpeg');
const sharp = require('sharp');

module.exports = async function handleInteraction(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'stake') {
        const file = interaction.targetMessage.attachments.first();

        interaction.deferReply({ ephemeral: true });
        
        const fileUrl = file.url;
        const randomName = Math.random().toString(36).substring(7);

        // Download file
        const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const fileData = downloadFile.data;
        const contentType = file.contentType.split('/')[1];
        await fs.writeFileSync(`temp/${randomName}.${contentType}`, fileData);

        const isGif = file.contentType === 'image/gif';
        const isImage = file.contentType.startsWith('image/') && !isGif;
        const videoExtension = isGif ? 'gif' : 'mp4';
        const outputExtension = isGif ? 'gif' : 'mp4';
        const imageExtension = file.contentType.split('/')[1];

        if (isImage) {
            const image = `temp/${randomName}.${contentType}`;
            const logo = 'images/stake_logo.png';
            const twentypercentlogosize = 0.2;

            // Get image metadata using ffmpeg
            const getImageMetadata = new ffmpeg(image);
            getImageMetadata.then(async function (imageFile) {
            const imageWidth = imageFile.metadata.video.resolution.w;

            // Resize logo using ffmpeg
            const resizedLogoPath = `temp/${randomName}_resized_logo.png`;
            await sharp(logo)
                .resize({ width: Math.floor(imageWidth * twentypercentlogosize) })
                .toFile(resizedLogoPath);

            // Overlay logo on the image using ffmpeg
            const outputImagePath = `temp/${randomName}_watermarked.${imageExtension}`;
            const addLogoToImage = new ffmpeg(`temp/${randomName}.${imageExtension}`);
            addLogoToImage.then(function (imageProcess) {
                imageProcess.fnAddWatermark(resizedLogoPath, outputImagePath, {
                position: 'SW',
                margin_sud: 10,
                margin_west: 10,
                }, function (error, file) {
                if (!error) {
                    interaction.editReply({
                    files: [file],
                    ephemeral: true,
                    }).then(() => {
                    // Delete all temporary files
                    fs.unlinkSync(image);
                    fs.unlinkSync(resizedLogoPath);
                    fs.unlinkSync(file);
                    });
                } else {
                    console.error('Error adding watermark:', error);
                    interaction.editReply({
                    content: 'There was an error processing your request.',
                    ephemeral: true,
                    });
                }
                });
            }, function (err) {
                console.log('Error:', err);
                interaction.editReply({
                content: 'There was an error processing your request.',
                ephemeral: true,
                });
            });
            }, function (err) {
            console.log('Error:', err);
            interaction.editReply({
                content: 'There was an error processing your request.',
                ephemeral: true,
            });
            });
        } else {
            const setLogoSize = new ffmpeg(`temp/${randomName}.${videoExtension}`);
            setLogoSize.then(async function (video) {
                const image = 'images/stake_logo.png';
                const twentypercentlogosize = 0.2;
                await sharp(image)
                .resize({ width: Math.floor(video.metadata.video.resolution.w * twentypercentlogosize) })
                .toFile(`temp/${randomName}.png`);
    
                // Add the image to the right bottom corner of the video
                const addImageToVideo = new ffmpeg(`temp/${randomName}.${videoExtension}`);
                addImageToVideo.then(function (video) {
                video.fnAddWatermark(`temp/${randomName}.png`, `temp/${randomName}_watermarked.${outputExtension}`, {
                    position: 'SW',
                    margin_sud: 10,
                    margin_west: 10,
                }, function (error, file) {
                    if (!error) {
                    interaction.editReply({
                        files: [file],
                        ephemeral: true,
                    }).then(() => {
                        // Delete all temporary files
                        fs.unlinkSync(`temp/${randomName}.${videoExtension}`);
                        fs.unlinkSync(`temp/${randomName}.png`);
                        fs.unlinkSync(file);
                    });
                    } else {
                    console.error('Error adding watermark:', error);
                    interaction.editReply({
                        content: 'There was an error processing your request.',
                        ephemeral: true,
                    });
                    }
                });
                }, function (err) {
                console.log('Error:', err);
                interaction.editReply({
                    content: 'There was an error processing your request.',
                    ephemeral: true,
                });
                });
            }, function (err) {
                console.log('Error:', err);
                interaction.editReply({
                content: 'There was an error processing your request.',
                ephemeral: true,
                });
            });
        }
        }
    }