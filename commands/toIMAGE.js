const altnames = ['toimage', 'toimg', '2img', '2image'];
const whatitdo = 'Converts all video frames to images, supports videos';

const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained) {
        const hasAttachment = currentAttachments || message.attachments;
        const firstAttachment = hasAttachment.first();
        const isVideo = firstAttachment && firstAttachment.contentType.includes('video');
        if (message.content.includes('help')) {
            return message.reply({
                content: `**converts all video frames to images**\n` +
                    `**Usage: ${altnames.join(', ')}\n`
            });
        } else if (!isVideo) {
            return message.reply({ content: 'provide a video file to convert.' });
        } else {
            const attachment = firstAttachment;
            const fileUrl = attachment.url;
            const userName = message.author.id;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOIMGCONV-${rnd5dig}.${contentType}`, fileData);

            try {
                await convertToImages(message, userName, contentType, rnd5dig);
            } catch (err) {
                console.error('Error:', err);
                return message.reply({ content: 'Error converting video to gif' });
            } finally {
                fs.unlinkSync(`temp/${userName}-TOIMGCONV-${rnd5dig}.${contentType}`);
                fs.unlinkSync(`temp/${userName}-IMAGES-${rnd5dig}.zip`);
            }
        }
    }
}

async function convertToImages(message, userName, contentType, rnd5dig) {
    const outputDir = `temp/${userName}-IMAGES-${rnd5dig}`;
    const zipPath = `temp/${userName}-IMAGES-${rnd5dig}.zip`;

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    return new Promise((resolve, reject) => {
        let progressMessage = null;
        let lastUpdateTime = 0;
        let startTime = Date.now();
        let firstUpdate = true;

        const ffmpegCommand = ffmpeg(`temp/${userName}-TOIMGCONV-${rnd5dig}.${contentType}`)
            .outputOptions(['-q:v 31']) // Aggressively compress images
            /* .on('start', (commandLine) => console.log('Started FFmpeg with command:', commandLine)) */
            .on('progress', async (progress) => {
                const currentTime = Date.now();
                const percent = progress.percent ? progress.percent.toFixed(1) : 0;
                const elapsedTime = (currentTime - startTime) / 1000;
                const estimatedTotalTime = (elapsedTime / (percent / 100));
                const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
                const eta = Math.round(remainingTime);

                if (currentTime - lastUpdateTime >= 1000) {
                    const progressText = `converting: ${percent}%\nETA: ${eta} seconds`;
                    if (firstUpdate) {
                        progressMessage = await message.reply({ content: progressText });
                        firstUpdate = false;
                    } else if (progressMessage) {
                        progressMessage.edit({ content: progressText }).catch(console.error);
                    }
                    lastUpdateTime = currentTime;
                }
            })
            .on('end', async () => {
                try {
                    await zipImages(outputDir, zipPath);
                    const stats = fs.statSync(zipPath);
                    const fileSizeInBytes = stats.size;
                    const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

                    if (fileSizeInMegabytes > 25) {
                        fs.unlinkSync(zipPath);
                        return reject(new Error('The zip file is too big to be sent (over 25MB).'));
                    }

                    fs.rmdirSync(outputDir, { recursive: true });
                    if (progressMessage) {
                        progressMessage.edit({ content: 'Conversion complete. Downloading...' }).catch(console.error);
                    }
                    await message.reply({ files: [zipPath] });
                    resolve(zipPath);
                } catch (err) {
                    reject(new Error('Zipping images failed: ' + err.message));
                }
            })
            .on('error', (err) => {
                if (progressMessage) {
                    progressMessage.edit({ content: 'Error during conversion!' }).catch(console.error);
                }
                reject(new Error('Image extraction failed: ' + err.message));
            });

        ffmpegCommand.save(`${outputDir}/frame-%04d.jpg`);
    });
}

async function zipImages(sourceDir, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(zipPath));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}
