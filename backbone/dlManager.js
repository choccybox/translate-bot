const axios = require('axios');
const fs = require('fs');
const { twitter, igdl, ttdl } = require('btch-downloader');
const ffmpeg = require('fluent-ffmpeg');
const https = require('https');
const { spawn } = require('child_process');
const YtDlpWrap = require('yt-dlp-wrap').default;

const ytDlp = new YtDlpWrap();

async function downloadYoutube(message, downloadLink, randomName, rnd5dig, identifierName, convertArg) {
    return new Promise(async (resolve, reject) => {
        
        try {
            // Get video info
            const videoInfo = await ytDlp.getVideoInfo(downloadLink);
            const videoTitle = videoInfo.title.replace(/[<>:"/\\|?*.\-]/g, '_').replace(/\s+/g, '_').toLowerCase();
            console.log('Downloading from:', videoTitle);
            
            // Determine output format and options based on convertArg
            const isAudioOnly = !convertArg;
            const outputFile = isAudioOnly 
                ? `temp/${videoTitle}.mp3` 
                : `temp/${videoTitle}.mp4`;
            
            const dlOptions = isAudioOnly 
                ? [
                    '-x', '--audio-format', 'mp3',
                    '--audio-quality', '0'
                  ] 
                : [
                    '--list-formats',
                    '--merge-output-format', 'mp4'
                  ];
            
            // Add common options
            dlOptions.push(
                '--progress',
                '--newline',
                '-o', outputFile
            );
            
            // Download with progress tracking
            const download = ytDlp.exec([downloadLink, ...dlOptions]);
            
            download.on('error', (error) => {
                console.error('Download error:', error);
                statusMessage.edit({ content: `Error downloading: ${error.message}. Please try again.` });
                reject(error);
            });
            
            download.on('close', () => {
                console.log('Download complete');
                
                statusMessage.edit({ 
                    content: `Download complete! ${isAudioOnly ? 'Audio' : 'Video'} from "${videoInfo.title}"` 
                }).catch(err => console.error('Error updating message:', err));
                
                resolve({ success: true, filename: videoTitle, videoTitle });
            });
            
        } catch (err) {
            console.error('Error:', err);
            
            if (statusMessage) {
                statusMessage.edit({ 
                    content: `Error: ${err.message || "Please check the URL"}. Please try again.` 
                }).catch(err => console.error('Error updating message:', err));
            }
            
            reject(err);
        }
    });
}

async function convertToMP3(input, output) {
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    // Ensure temp directory exists
    if (!fs.existsSync('temp')) {
        fs.mkdirSync('temp');
    }

    console.log(`Converting ${input} to ${output}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (!fs.existsSync(input)) {
                console.log(`MP4 file not found, attempt ${attempt}/${maxRetries}. Waiting...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }

            await new Promise((resolve, reject) => {
                ffmpeg(input)
                    .toFormat('mp3')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(output);
            });
            return;
        } catch (error) {
            console.log(`Conversion attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    throw new Error('Failed to convert file after multiple attempts');
}

async function downloadURL(message, downloadLink, randomName, rnd5dig, identifierName, convertArg) {
    console.log('dl manager:' + convertArg);
    try {
        if (/youtube\.com|youtu\.be|music\.youtube\.com/.test(downloadLink)) {
            message.react('🔽').catch()
            if (downloadLink.includes('music.youtube.com')) {
            downloadLink = downloadLink.replace('music.', '');
            }
            const result = await downloadYoutube(message, downloadLink, randomName, rnd5dig, identifierName);
            if (!convertArg) {
                await convertToMP3(`temp/${result.filename}.mp4`, `temp/${result.filename}.mp3`);
                return { success: true, title: result.filename };
            }
            return { success: true, title: result.videoTitle };
            
        } else if (/twitter\.com|t\.co|x\.com|fxtwitter\.com|stupidpenisx\.com/.test(downloadLink)) {
            message.react('🔽').catch();
            // Convert fxtwitter and stupidpenisx URLs to twitter.com
            let twitterUrl = downloadLink;
            if (downloadLink.includes('fxtwitter.com')) {
                twitterUrl = downloadLink.replace('fxtwitter.com', 'twitter.com');
            } else if (downloadLink.includes('stupidpenisx.com')) {
                twitterUrl = downloadLink.replace('stupidpenisx.com', 'twitter.com');
            }
            const data = await twitter(twitterUrl);
            const downloadUrl = data.url[0].sd || data.url[0].hd;
            console.log(data);
            if (!downloadUrl) {
                return { success: false, message: `couldn't find a video or it's marked as NSFW.` };
            }
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });
            const title = `${data.title || 'twitter_video'}`
                .replace(/https?:\/\/\S+/gi, '') // remove URLs
                .split(' ').slice(0, 6).join(' ') // get first 6 words
                .slice(0, 200); // limit length
            
            const downloadStream = fs.createWriteStream(`temp/${title}.mp4`);
            response.data.pipe(downloadStream);
            await new Promise((resolve, reject) => {
                downloadStream.on('finish', resolve);
                downloadStream.on('error', reject);
            });
            if (!convertArg) {
                await convertToMP3(`temp/${title}.mp4`, `temp/${title}.mp3`);
                return { success: true, title };
            }
            return { success: true, title };
        } else if (/instagram\.com/.test(downloadLink)) {
            message.react('🔽').catch();
            const data = await igdl(downloadLink);
            const downloadUrl = data[0].url;
            console.log(data);
            if (!downloadUrl) {
                return { success: false, message: `couldn't find a video or it's marked as private.` };
            }
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });
            const title = `instagram_video_${randomName}`
                .replace(/https?:\/\/\S+/gi, '')
                .split(' ').slice(0, 6).join(' ')
                .slice(0, 200);
            
            const downloadStream = fs.createWriteStream(`temp/${title}.mp4`);
            response.data.pipe(downloadStream);
            await new Promise((resolve, reject) => {
                downloadStream.on('finish', resolve);
                downloadStream.on('error', reject);
            });
            if (!convertArg) {
                await convertToMP3(`temp/${title}.mp4`, `temp/${title}.mp3`);
                return { success: true, title };
            }
            return { success: true, title };
        }  else if (/tiktok\.com/.test(downloadLink)) {
            message.react('🔽').catch();
            const data = await ttdl(downloadLink);
            const downloadUrl = data.video[0];
            console.log(data);
            if (!downloadUrl) {
                return { success: false, message: `couldn't find the video` };
            }
            const response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream'
            });
            const title = `${data.title || 'tiktok_video'}`
                .replace(/https?:\/\/\S+/gi, '')  // remove URLs
                .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/gu, '')  // remove emojis
                .replace(/#\w+\s*/g, '')  // remove hashtags
                .split(' ').slice(0, 6).join(' ')  // limit to 6 words
                .trim().slice(0, 50);  // limit length
            
            const downloadStream = fs.createWriteStream(`temp/${title}.mp4`);
            response.data.pipe(downloadStream);
            await new Promise((resolve, reject) => {
                downloadStream.on('finish', resolve);
                downloadStream.on('error', reject);
            });
            if (!convertArg) {
                await convertToMP3(`temp/${title}.mp4`, `temp/${title}.mp3`);
                return { success: true, title };
            }
            return { success: true, title };
        } else {
            throw new Error('Unsupported URL');
        }
    } catch (error) {
        console.error('Error downloading:', error);
        return { success: false };
    }
}

module.exports = { downloadURL };