const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const axios = require('axios');

module.exports = async function handleInteraction(interaction) {
    if (interaction.isCommand() && interaction.commandName === 'imagegeneration') {
        const prompt = interaction.options.getString('image-prompt');
        const imgnum = interaction.options.getInteger('num-images') ?? 2;
        const guidance = interaction.options.getString('guidance') ?? '7.5';

        // if user inputs more than 4 images, set it to 4
        if (imgnum > 4) {
            imgnum = 4;
        }

        interaction.deferReply({ ephemeral: true });

        try {
            const deepInfraPrediction = await axios.post(
                'https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-1-schnell',
                {
                    prompt: prompt,
                    num_images: imgnum,
                    guidance_scale: guidance,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
                    },
                }
            );
            
            console.log(deepInfraPrediction.data.images);

            const imageGenDuration = Math.ceil(deepInfraPrediction.data.inference_status.runtime_ms / 1000); // Convert duration to seconds and round up

            let formattedDuration;
            if (imageGenDuration < 60) {
                formattedDuration = `${imageGenDuration}s`;
            } else {
                const predictionSeconds = Math.floor(imageGenDuration % 60);
                const predictionMinutes = Math.floor(imageGenDuration / 60);
                formattedDuration = `${predictionMinutes}m ${predictionSeconds}s`;
            }

            // get all images and download them to temp folder
            const randomID = Math.floor(1000 + Math.random() * 9000);
            deepInfraPrediction.data.images.forEach(async (imageUrl, i) => {
                const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imagePath = `temp/imagegen-${randomID}-${i + 1}.png`;
                fs.writeFileSync(imagePath, imageBuffer.data);
            });

            // wait for all images to be saved
            await Promise.all(deepInfraPrediction.data.images.map(async (imageUrl, i) => {
                const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imagePath = `temp/imagegen-${randomID}-${i + 1}.png`;
                fs.writeFileSync(imagePath, imageBuffer.data);
            }));

            // send images as reply
            const imageFiles = [];
            for (let i = 1; i <= imgnum; i++) {
                imageFiles.push(`temp/imagegen-${randomID}-${i}.png`);
            }

            // reply with images
            await interaction.followUp({
                files: imageFiles,
                content: `The prediction took ${formattedDuration} to complete.`,
            });

            // delete images after sending
            imageFiles.forEach((imagePath) => {
                fs.unlinkSync(imagePath);
            });
        } catch (error) {
            console.error(error);
        }
    }
};