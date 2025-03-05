const axios = require('axios');
const fs = require('fs');
const { twitter, igdl } = require('btch-downloader');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const https = require('https');

async function downloadYoutube(message, downloadLink, randomName, rnd5dig, identifierName) {
    return new Promise((resolve, reject) => {
        ytdl.getInfo(downloadLink).then(info => {
            // Log all available video formats with their languages and details
            const videoFormats = ytdl.filterFormats(info.formats, 'videoandaudio');
        
            // Filter video formats with "English" in the language or display name
            const englishVideo = videoFormats.filter(format => {
            return format.audioTrack && format.audioTrack.displayName.toLowerCase().includes('english');
            });
        
            if (englishVideo.length === 0) {
            const selectedFormat = ytdl.filterFormats(info.formats, 'videoandaudio')[0];
                    
            const videoStream = ytdl(downloadLink, {
                format: selectedFormat,
                requestOptions: {
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9'
                }
                },
                highWaterMark: 1 << 25 // Fixes buffering issues
            });
        
            const output = `temp/${randomName}-${identifierName}-${rnd5dig}.mp4`;
            const writeStream = fs.createWriteStream(output);
            videoStream.pipe(writeStream);
            writeStream.on('finish', () => {
                console.log('Video download finished successfully');
                resolve({ success: true }); // Resolve the promise on success
            });
            writeStream.on('error', (err) => {
                console.error('Error writing video file:', err);
                message.reply({ content: 'Error downloading video.' });
                reject(err); // Reject the promise on error
            });
            } else {
            // If English video exists, use it
            const selectedFormat = englishVideo[0];
        
            const videoStream = ytdl(downloadLink, {
                format: selectedFormat,
                requestOptions: {
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9'
                }
                },
                highWaterMark: 1 << 25 // Fixes buffering issues
            });
        
            const output = `temp/${randomName}-${identifierName}-${rnd5dig}.mp4`;
            const writeStream = fs.createWriteStream(output);
            videoStream.pipe(writeStream);
            writeStream.on('finish', () => {
                console.log('Video download finished successfully');
                resolve({ success: true }); // Resolve the promise on success
            });
            writeStream.on('error', (err) => {
                console.error('Error writing video file:', err);
                message.reply({ content: 'Error downloading video.' });
                reject(err); // Reject the promise on error
            });
            }
        }).catch(err => {
            console.error('Error fetching video info:', err);
            reject(err);
        });
    });
}
async function convertToMP3(input, output) {
    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', reject)
            .save(output);
    });
}
async function downloadURL(message, downloadLink, randomName, rnd5dig, identifierName, convertArg) {
    console.log('dl manager:' + convertArg);
    try {
        if (/youtube\.com|youtu\.be|music\.youtube\.com/.test(downloadLink)) {
            message.react('🔽').catch()
            if (downloadLink.includes('music.youtube.com')) {
            downloadLink = downloadLink.replace('music.', '');
            }
            await downloadYoutube(message, downloadLink, randomName, rnd5dig, identifierName);
            if (!convertArg) {
                await convertToMP3(`temp/${randomName}-${identifierName}-${rnd5dig}.mp4`, `temp/${randomName}-${identifierName}-${rnd5dig}.mp3`);
                return { success: true };
            }
            return { success: true };
            
        } else if (/twitter\.com|t\.co|x\.com/.test(downloadLink)) {
            message.react('🔽').catch();
            const data = await twitter(downloadLink);
            const downloadUrl = data.url[0].sd || data.url[0].hd;
            if (!downloadUrl) {
                return { success: false, message: `couldn't find a video or it's marked as NSFW.` };
            }
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });
            const downloadStream = fs.createWriteStream(`temp/${randomName}-${identifierName}-${rnd5dig}.mp4`);
            response.data.pipe(downloadStream);
            await new Promise((resolve, reject) => {
                downloadStream.on('finish', resolve);
                downloadStream.on('error', reject);
            });
            if (!convertArg) {
                await convertToMP3(`temp/${randomName}-${identifierName}-${rnd5dig}.mp4`, `temp/${randomName}-${identifierName}-${rnd5dig}.mp3`);
                return { success: true };
            }
            return { success: true };
        } else if (/instagram\.com/.test(downloadLink)) {
            message.react('🔽').catch();
            const data = await igdl(downloadLink);
            const downloadUrl = data[0].url;
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });
            const downloadStream = fs.createWriteStream(`temp/${randomName}-${identifierName}-${rnd5dig}.mp4`);
            response.data.pipe(downloadStream);
            await new Promise((resolve, reject) => {
                downloadStream.on('finish', resolve);
                downloadStream.on('error', reject);
            });
            if (!convertArg) {
                console.log('downloading as mp3');
                await convertToMP3(`temp/${randomName}-${identifierName}-${rnd5dig}.mp4`, `temp/${randomName}-${identifierName}-${rnd5dig}.mp3`);
                return { success: true };
            }
            console.log('downloading as mp4');
            return { success: true };
        } else {
            throw new Error('Unsupported URL');
        }
    } catch (error) {
        console.error('Error downloading:', error);
        return { success: false };
    }
}

module.exports = { downloadURL };