const ocrVideo= require('../../../backbone/ocr/OCRVideo.js');
const ocrImage = require('../../../backbone/ocr/OCRImage.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const embedColor = 2829617;

let errorMsg = 'well, it broke... maybe try later :3?';

module.exports = async function handleContextMenuCommand(interaction) {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'OCR') {
        const targetMessage = interaction.targetMessage;
        const hasAttachment = targetMessage.attachments.size > 0;

        if (!hasAttachment) {
            interaction.reply({
                embeds: [{
                    title: 'couldn\'t find an image in the message! did you mean to use "translate text"?',
                    color: embedColor,
                }],
                ephemeral: true,
            });
            return;
        }

        const attachmentURL = targetMessage.attachments.map((attachment) => attachment.url);
        const attachmentInfo = targetMessage.attachments.map((attachment) => {
            const contentType = attachment.contentType;
            const [videoType, extension] = contentType.split('/');
            return { videoType, extension };
        });

        const imageUrl = attachmentURL[0];
        if (!imageUrl) {
            interaction.reply({
                embeds: [{
                    title: 'No valid image URL found!',
                    color: embedColor,
                }],
                ephemeral: true,
            });
            return;
        }

        try {
            console.log(`file type: ${attachmentInfo[0].videoType}`);
            console.log(`file extension: ${attachmentInfo[0].extension}`);

            if (attachmentInfo[0].videoType === 'video') {
                interaction.reply({
                    embeds: [{
                        title: `this is a video/gif, do you want to extract the first frame from it and OCR the text?`,
                        color: embedColor,
                    }],
                    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('extract_frame').setLabel('Extract Frame').setStyle(ButtonStyle.Danger))],
                    ephemeral: true,
                });

                const filter = (i) => i.customId === 'extract_frame' && i.user.id === interaction.user.id;
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

                collector.on('collect', async (i) => {
                    interaction.editReply({
                        embeds: [{
                            title: 'received your request! :3',
                            color: embedColor,
                            image: { url: imageUrl },
                        }],
                        components: [],
                        ephemeral: true,
                    });
                    i.deferUpdate();

                    try {
                        const ocrText = await ocrVideo(imageUrl);
                        const image = ocrText[0].imgbbOverlayURL;
                        const text = ocrText[0].ocrText;
                        const timeTook = ocrText[0].timeTook;

                        interaction.editReply({
                            embeds: [{
                                title: text ? text : 'no text detected',
                                color: embedColor,
                                image: { url: image },
                                footer: { text: timeTook },
                            }],
                            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('plain_text').setLabel('show plain text').setStyle(ButtonStyle.Primary))],
                            ephemeral: true,
                        });

                        const plainFilter = (i) => i.customId === 'plain_text' && i.user.id === interaction.user.id;
                        const plainCollector = interaction.channel.createMessageComponentCollector({ plainFilter, time: 600000 });
                        
                        plainCollector.on('collect', async (i) => {
                            try {
                                // Update conversation, not edit
                                await interaction.editReply({
                                    content: text ? text : 'no text detected',
                                    embeds: [{
                                        title: '',
                                        color: embedColor,
                                        image: { url: image },
                                        footer: { text: timeTook },
                                    }],
                                    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('plain_text').setLabel('show plain text').setStyle(ButtonStyle.Primary).setDisabled(true))],
                                    ephemeral: true,
                                });
                        
                                // If i.deferUpdate() fails, log the error to the console
                                await i.deferUpdate();
                                plainCollector.stop();
                            } catch (error) {
                                console.error('Error while handling interaction:', error);
                            }
                        });
                        
                    } catch (error) {
                        console.error(error);
                        interaction.editReply({ embeds: [{ title: errorMsg, color: embedColor }], ephemeral: true });
                    }
                    collector.stop();
                });
                return;
            } else {
                interaction.reply({
                    embeds: [{
                        title: 'received your request! :3',
                        color: embedColor,
                        image: { url: imageUrl },
                    }],
                    ephemeral: true,
                });

                try {
                    const ocrText = await ocrImage(imageUrl);
                    const image = ocrText[0].imgbbOverlayURL;
                    const text = ocrText[0].ocrText;
                    const timeTook = ocrText[0].timeTook;

                    if (text === "no text detected") {
                        interaction.editReply({
                            embeds: [{
                                title: text ? text : 'no text detected',
                                color: embedColor,
                                image: { url: image },
                                footer: { text: timeTook },
                            }],
                            ephemeral: true,
                        });
                        return;
                    }

                    interaction.editReply({
                        embeds: [{
                            title: text ? text : 'no text detected',
                            color: embedColor,
                            image: { url: image },
                            footer: { text: timeTook },
                        }],
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('plain_text').setLabel('show plain text').setStyle(ButtonStyle.Primary))],
                        ephemeral: true,
                    });

                    const plainFilter = (i) => i.customId === 'plain_text' && i.user.id === interaction.user.id;
                        const plainCollector = interaction.channel.createMessageComponentCollector({ plainFilter, time: 600000 });
                        
                        plainCollector.on('collect', async (i) => {
                            try {
                                // Update conversation, not edit
                                await interaction.editReply({
                                    content: text ? text : 'no text detected',
                                    embeds: [{
                                        title: '',
                                        color: embedColor,
                                        image: { url: image },
                                        footer: { text: timeTook },
                                    }],
                                    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('plain_text').setLabel('show plain text').setStyle(ButtonStyle.Primary).setDisabled(true))],
                                    ephemeral: true,
                                });
                        
                                // If i.deferUpdate() fails, log the error to the console
                                await i.deferUpdate();
                                plainCollector.stop();
                            } catch (error) {
                                console.error('Error while handling interaction:', error);
                            }
                        });
                } catch (error) {
                    console.error(error);
                    interaction.editReply({
                        embeds: [{
                            title: errorMsg,
                            color: embedColor,
                        }],
                        ephemeral: true,
                    });
                }
            }
        } catch (error) {
            console.error(error);
            interaction.reply({
                embeds: [{
                    title: errorMsg,
                    color: embedColor,
                }],
                ephemeral: true,
            });
        }
    }
};
