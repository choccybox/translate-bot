const altnames = ['convert', 'conv'];
const isChainable = false;
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const attachment = currentAttachments.first() || message.attachments.first();
        if (message.content.includes('help')) {
            return message.reply({
                content: '**Converts a file** to a desired format *(video to audio)*\n' +
                    'Usage: `convert:<format>` where format is what you want to convert the file to *(mp4 file to mp3)*\n' +
                    `note that some formats may not be supported or can't be converted *(e.g. gif to mp3)*\n` +                
                    'Available alt names: `' + `${altnames.join(', ')}` + '`',
            });
        } else if (!attachment) {
            return message.reply({ content: 'Please provide an audio or video file to process.' });
        }
        const fileUrl = attachment.url;
        const userName = userID;
        const actualUsername = message.author.username;
        const fileType = attachment.contentType;
        const contentType = attachment.contentType.split('/')[1];
        const rnd5dig = Math.floor(Math.random() * 90000) + 10000;

        const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const fileData = downloadFile.data;
        await fs.writeFileSync(`temp/${userName}.${contentType}`, fileData);

        console.log('Downloaded File:', `${userName}.${contentType}`);
        console.log('file type:', fileType);

        const conversionOptions = {
            video: 'mp4',
            audio: 'mp3',
            image: 'png',
            gif: 'gif'
        };

        try {
            const rawType = message.content.split(':')[1]?.toLowerCase().trim();
            let conversionType;

            if (rawType === 'vid' || rawType === 'video') conversionType = 'video';
            else if (rawType === 'aud' || rawType === 'audio') conversionType = 'audio';
            else if (rawType === 'img' || rawType === 'image') conversionType = 'image';
            else if (rawType === 'gif') conversionType = 'gif';

            if (!conversionType) {
            return message.reply({ 
                content: 'Please specify conversion type. Example: `convert:video` or `convert:audio` or `convert:image`' 
            });
            }

            console.log(`converting ${contentType} to ${conversionType}`);
            const outputFormat = conversionOptions[conversionType];
            console.log('Output format:', outputFormat);

            let imageURL;
            switch (conversionType) {
            case 'video':
            case 'vid':
                await convertToVideo(userName, outputFormat, contentType, rnd5dig);
                break;
            case 'gif':
                await convertToGIF(userName, outputFormat, contentType, rnd5dig);
                break;

            case 'audio':
            case 'aud':
                await convertToAudio(userName, outputFormat, contentType, rnd5dig);
                break;

            case 'image':
            case 'img':
                await convertToImage(userName, outputFormat, contentType, rnd5dig);
                break;
            }

            if (conversionType === 'audio') {
                const originalPath = `temp/${userName}-${outputFormat.toUpperCase()}-${rnd5dig}.${outputFormat}`;
                const newPath = `temp/${actualUsername}-${rnd5dig}.${outputFormat}`;
                fs.renameSync(originalPath, newPath);
                return message.reply({ 
                    files: [newPath]
                });
            } else {
                imageURL = process.env.UPLOADURL + userName + `-${outputFormat.toUpperCase()}-${rnd5dig}.${outputFormat}`;
                console.log('Final URL:', imageURL);
                return message.reply({ content: imageURL });
            }

        } catch (error) {
            console.error('Error converting file:', error);
            return message.reply({ content: 'An error occurred while converting the file.' });
        } finally {
            // delete the temp file
            fs.unlinkSync(`temp/${userName}.${contentType}`);
        }
        }
    };

    async function convertToVideo(userName, outputFormat, contentType, rnd5dig) {
        const process = new ffmpeg(`temp/${userName}.${contentType}`);
        return new Promise((resolve, reject) => {
            process.then(function (video) {
                // Convert any video format to MP4
                if (contentType.startsWith('video')) {
                    console.log('Converting to MP4');
                    video
                        .setVideoFormat('mp4')
                        .addCommand('-vf', 'scale=1280:-1')
                        .addCommand('-b:v', '1000k')
                        .save(`temp/${userName}-MP4-${rnd5dig}.mp4`, function (error, file) {
                            if (!error) {
                                console.log('Video file:', file);
                                resolve(file);
                            } else {
                                reject(error);
                            }
                        });
                }
            }).catch(reject);
        });
    }

    async function convertToGIF(userName, _, contentType, rnd5dig) {
        const outputPath = `temp/${userName}-GIF-${rnd5dig}.gif`;

        return new Promise((resolve, reject) => {
            ffmpeg(`temp/${userName}.${contentType}`)
                .toFormat('gif')
                .fps(10)  // Reduced FPS for smaller file size
                .size('320x240')
                .outputOptions([
                    '-y',
                    '-vf', 'split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
                    '-compression_level', '8'
                ])
                .on('end', () => {
                    console.log('GIF file:', outputPath);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    reject(new Error('GIF conversion failed: ' + err.message));
                })
                .save(outputPath);
        });
    }

    async function convertToAudio(userName, outputFormat, contentType, rnd5dig) {
        const process = new ffmpeg(`temp/${userName}.${contentType}`);
        return new Promise((resolve, reject) => {
        process.then(function (audio) {
            audio.fnExtractSoundToMP3(`temp/${userName}-${outputFormat.toUpperCase()}-${rnd5dig}.${outputFormat}`, function (error, file) {
            if (!error) {
                console.log('Audio file:', file);
                resolve(file);
            } else {
                reject(error);
            }
            });
        }).catch(reject);
        });
    }

    async function convertToImage(userName, outputFormat, contentType, rnd5dig) {
        const process = new ffmpeg(`temp/${userName}.${contentType}`);
        return new Promise((resolve, reject) => {
        process.then(function (image) {
            image
            .addCommand('-vframes', '1')  // Extract first frame for image
            .setVideoFormat(outputFormat)
            .save(`temp/${userName}-${outputFormat.toUpperCase()}-${rnd5dig}.${outputFormat}`, function (error, file) {
                if (!error) {
                console.log('Image file:', file);
                resolve(file);
                } else {
                reject(error);
                }
            });
        }).catch(reject);
        });
    }