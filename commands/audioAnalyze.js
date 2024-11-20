const altnames = ['audio', 'aa', 'audioanalyze', 'speech2text', 's2t', 'stt'];
const isChainable = false;
const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
    run: async function handleMessage(message, client, currentAttachments, isChained, userID) {
        const attachment = currentAttachments.first() || message.attachments.first();
        if (!attachment) {
            return message.reply({ content: 'Please provide an audio or video file to process.' });
        }
        const fileUrl = attachment.url;
        const randomName = userID;
        const contentType = attachment.contentType.split('/')[1];

        const downloadFile = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const fileData = downloadFile.data;
        await fs.writeFileSync(`temp/${randomName}.${contentType}`, fileData);

        console.log('Downloaded File:', `${randomName}.${contentType}`);

        try {
            // if file is a video, convert it to audio
            if (!attachment.contentType.startsWith('audio/') && !attachment.contentType.startsWith('video/')) {
                message.reply({ content: 'this aint an audio/video file' });
            } else if (attachment.contentType.startsWith('video/') && attachment.contentType !== 'video/gif') {
                const process = new ffmpeg(`temp/${randomName}.${contentType}`);
                process.then(function (video) {
                    video.fnExtractSoundToMP3(`temp/${randomName}.mp3`, function (error, file) {
                        if (!error) {
                            console.log('Audio file:', file);
                            // convert it to a base64 string, make sure to include the data type
                            const audioData = fs.readFileSync(`temp/${randomName}.mp3`);
                            const base64Audio = `data:audio/mp3;base64,${audioData.toString('base64')}`;
                            processAudio(base64Audio, message, randomName, attachment.name);
                        }
                    });
                }, function (err) {
                    console.log('Error:', err);
                });
            } else {
                const audioData = fs.readFileSync(`temp/${randomName}.${contentType}`);
                const base64Audio = `data:audio/${contentType};base64,${audioData.toString('base64')}`;
                processAudio(base64Audio, message, randomName, attachment.name);
            }
        } catch (error) {
            console.error('Error processing:', error);
            return { attachments: null, error: 'Error processing the file.' };
        }
    }
};

async function processAudio(base64Audio, message, randomName, fileName) {
    try {
        const deepInfraPrediction = await axios.post('https://api.deepinfra.com/v1/inference/openai/whisper-large-v3-turbo', {
            audio: base64Audio,
            authorization: process.env.DEEPINFRA_TOKEN,
        });
        const runtimeDuration = deepInfraPrediction.data.inference_status.runtime_ms;
        console.log(`The prediction took ${runtimeDuration}ms to complete.`);

        // convert the prediction to a human-readable format
        const predictionDuration = Math.ceil(deepInfraPrediction.data.inference_status.runtime_ms / 1000); // Convert duration to seconds and round up

        const predictionSeconds = Math.floor(predictionDuration % 60);
        const predictionMinutes = Math.floor((predictionDuration / 60) % 60);
        const predictionHours = Math.floor(predictionDuration / 3600);

        let formattedDuration = '';

        if (predictionHours > 0 || predictionMinutes > 0) {
            formattedDuration = `${predictionMinutes.toString()}:${predictionSeconds.toString().padStart(2, '0')}s`;
        } else {
            formattedDuration = `${predictionSeconds.toString()}s`;
        }

        console.log(`The prediction took ${formattedDuration} to complete.`);
        const segments = deepInfraPrediction.data.segments;
        const totalDuration = deepInfraPrediction.data.duration; // Total duration of the audio file in seconds
        const totalHours = Math.floor(totalDuration / 3600);

        // Calculate whether to display hours or minutes
        const useHours = totalHours > 0;

        segments.forEach(segment => {
            const startTime = segment.start;
            const endTime = segment.end;

            const startSeconds = Math.floor(startTime % 60);
            const startMinutes = Math.floor((startTime / 60) % 60);
            const startHours = Math.floor(startTime / 3600);

            const endSeconds = Math.floor(endTime % 60);
            const endMinutes = Math.floor((endTime / 60) % 60);
            const endHours = Math.floor(endTime / 3600);

            // Adjust timestamp format based on duration
            if (useHours) {
                segment.start = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}`;
                segment.end = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;
            } else {
                segment.start = `${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')}`;
                segment.end = `${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;
            }
        });

        const predictionString = segments.map(segment => `\`${segment.start} - ${segment.end}\` ${segment.text}`).join('\n');
        const predictionRawText = deepInfraPrediction.data.text;

        // Conditional logic for handling different cases
        if (predictionRawText.length > 2000) {
            console.log('raw text too long, sending as a file');
            fs.writeFileSync(`./temp/${randomName}.txt`, predictionRawText);
            message.reply({
                content: 'Output is too long to be displayed as a message, it has been compressed into a text file.',
                files: [`./temp/${randomName}.txt`],
            });
        } else {
            console.log('raw text short, sending as a message');
            message.reply({
                content: predictionRawText,
            });
        }
    } catch (error) {
        console.error(error);
    } finally {
        // Clean up temp files
        fs.unlinkSync(`temp/${randomName}.mp3`);
        fs.unlinkSync(`temp/${randomName}.${fileName.split('.')[1]}`);
    }
}
