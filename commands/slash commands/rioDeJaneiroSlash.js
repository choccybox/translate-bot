const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'riodejaneiro') {
    console.log('using slash command')
    // make the interaction ephemeral
    await interaction.deferReply({ ephemeral: true });

    const randomName = Math.floor(Math.random() * 100000000);
    const originalImagePath = `temp/${randomName}-RIO.jpg`;
    const overlaidImagePath = `temp/${randomName}-RIO-OVERLAID.jpg`;
    const overlayImagePath = 'images/riodejaneiro.png';
    const overlayText = 'Rio De Janeiro';
    const fontPath = 'fonts/InstagramSans.ttf'; // Path to your custom font file
    const fontSizePercent = 0.075; // Set the font size as a percentage of the image width and height

    try {
        // Get the attachment
        const targetMessage = interaction.options.getAttachment('image');
        // Get the attachment URL
        const imageUrl = targetMessage.url;
        // get contenttype and splice it to image or video
        const contentType = targetMessage.contentType;
        const [attachmentType, extension] = contentType.split('/');

        if (attachmentType === 'video') {
            await interaction.followUp({
                embeds: [{
                    title: 'This command is not available for videos',
                    color: 0xff0000
                }],
                ephemeral: true
            })

            return;
        }

        // Download the image from the URL
        const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(originalImagePath, imageBuffer.data);

        // Get the dimensions of the original image
        const originalImageMetadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(originalImagePath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata);
            });
        });

        const { width, height } = originalImageMetadata.streams[0];

        // Calculate font size as 10% of the image width and height
        const fontSize = Math.min(Math.floor(width * fontSizePercent), Math.floor(height * fontSizePercent));

        // Overlay the image and text using FFmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(originalImagePath)
                .input(overlayImagePath)
                .complexFilter([
                    `[1:v]scale=${width}:${height},format=rgba,colorchannelmixer=aa=0.55[ovrl];[0:v][ovrl]overlay,drawtext=fontfile=${fontPath}:text='${overlayText}':fontcolor=white:fontsize=${fontSize}:shadowcolor=black:shadowx=0:shadowy=0:x=(w-text_w)/2:y=(h-text_h)/2`
                ])
                .output(overlaidImagePath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // Send the final image
        const attachment = {
            files: [overlaidImagePath]
        };
        await interaction.followUp(attachment);
    } catch (error) {
        console.error('Error processing the image:', error);
        await interaction.followUp('There was an error processing the image. Please try again later.');
    } finally {
        // Clean up the temporary files
        try {
            if (fs.existsSync(originalImagePath)) {
                fs.unlinkSync(originalImagePath);
            }
            if (fs.existsSync(overlaidImagePath)) {
                fs.unlinkSync(overlaidImagePath);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up files:', cleanupError);
        }
    }
    }
}