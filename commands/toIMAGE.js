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
        const attachment = firstAttachment;
        if (message.content.includes('help')) {
            return message.reply({
                content: `**converts all video frames to images**\n` +
                    `**Usage: ${altnames.join(', ')}\n`
            });
        } else if (!isVideo && !attachment.contentType.includes('gif')) {
            return message.reply({ content: 'provide a video file to convert.' });
        } else {
            const fileUrl = attachment.url;
            const userName = message.author.id;
            const fileType = attachment.contentType;
            const contentType = attachment.contentType.split('/')[1];
            const rnd5dig = Math.floor(Math.random() * 90000) + 10000;
            
            const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const fileData = downloadFile.data;
            await fs.writeFileSync(`temp/${userName}-TOIMGCONV-${rnd5dig}.${contentType}`, fileData);

            try {
                message.react('<a:pukekospin:1311021344149868555>').catch(() => message.react('👍'));
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
        const ffmpegCommand = ffmpeg(`temp/${userName}-TOIMGCONV-${rnd5dig}.${contentType}`)
            .outputOptions(['-q:v 31']) // Aggressively compress images
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
                    await message.reply({ files: [zipPath] });
                    if (message.channel.messages.cache.get(message.id)) {
                        message.reactions.removeAll().catch(console.error);
                    }
                    resolve(zipPath);
                } catch (err) {
                    reject(new Error('Zipping images failed: ' + err.message));
                }
            })
            .on('error', (err) => {
                message.reply({ content: 'Error converting video to images' });
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
