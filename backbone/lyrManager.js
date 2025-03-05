const axios = require('axios');
const fs = require('fs');
const youtubeSearch = require('ytdl-core');
const genius = require("genius-lyrics");
const geniusClient = new genius.Client(process.env.GENIUS_TOKEN);
const spotifySearch = require('isomorphic-unfetch')
const soundCloud = require("soundcloud-scraper");
const soundCloudClient = new soundCloud.Client();
const { getAverageColor } = require('fast-average-color-node');
const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

async function searchForLyrics(message, searchLink) {
    try {
        if (/youtube\.com|youtu\.be|music\.youtube\.com/.test(searchLink)) {
            if (searchLink.includes('music.youtube.com')) {
                searchLink = searchLink.replace('music.', '');
            }
            return new Promise((resolve, reject) => {
                (async () => {
                    try {
                        const info = await youtubeSearch.getInfo(searchLink);
                        const song = info.videoDetails.title
                        const artist = info.videoDetails.author.name.replace(" - Topic", "");
                        const result = await GeniusResult(song, artist);
                        resolve(result);
                    } catch (err) {
                        console.error('Error fetching video info:', err);
                        reject(err);
                    }
                })();
            });
        } else if (/spotify\.com|open\.spotify\.com/.test(searchLink)) {
            return new Promise((resolve, reject) => {
                (async () => {
                    try {
                        const { getData } = require('spotify-url-info')(spotifySearch)
                        const data = await getData(searchLink, {
                            headers: {
                                'user-agent': 'googlebot'
                            }
                        });
                        console.log(data);
                        const song = data.title;
                        const artist = data.artists[0].name;
                        const result = await GeniusResult(song, artist);
                        resolve(result);
                    } catch (err) {
                        console.error('Error fetching video info:', err);
                        reject(err);
                    }
                })();
            });
        } else if (/soundcloud\.com/.test(searchLink)) {
            return new Promise((resolve, reject) => {
            (async () => {
                try {
                    searchLink = searchLink.split('?')[0];
                    const searchSong = await soundCloudClient.getSongInfo(searchLink);
                    const song = searchSong.title;
                    const artist = searchSong.author.name;
                    const result = await GeniusResult(song, artist);
                    resolve(result);
                } catch (err) {
                    console.error('Error fetching song info:', err);
                    reject(err);
                }
            })();
            });
        } else {
            throw new Error('Unsupported URL');
        }
    } catch (error) {
        console.error('Error downloading:', error);
        return { success: false };
    }
}

async function cleanText(nameAndArtist) {
    try {
        const response = await axios.post('https://api.deepinfra.com/v1/openai/chat/completions', {
            model: 'meta-llama/Llama-3.2-11B-Vision-Instruct',
            messages: [
                {
                    role: 'system',
                    content: fs.readFileSync('./database/prompt.txt', 'utf8')
                },
                {
                    role: 'user',
                    content: nameAndArtist
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.DEEPINFRA_TOKEN
            }
        });
    
        console.log(response.data.choices[0].message.content);
    
        // seperate song from artist
        const artist = response.data.choices[0].message.content.split(' - ')[0];
        const song = response.data.choices[0].message.content.split(' - ')[1];
        /* console.log('song:', song);
        console.log('artist:', artist); */
        return { song, artist };
    } catch (error) {
        let song = nameAndArtist.split(' - ')[1];
        let artist = nameAndArtist.split(' - ')[0];
        console.error('couldnt clean text.', error);
        return { song: song, artist: artist };
    }
}


async function GeniusResult(song, artist) {
    await cleanText(`${song} ${artist}`).then(data => {
        song = data.song;
        artist = data.artist;
    });
    const nameAndArtist = `${artist} ${song}`;
    let searches = await geniusClient.songs.search(nameAndArtist);
    console.log('genius:', nameAndArtist);
    if (searches.length === 0) {
        const songSearches = await geniusClient.songs.search(song);
        if (songSearches.length === 0) {
            console.log('Song not found');
            return {
                success: true,
                properLyrics: "no lyrics or instrumental",
                trackURL: null,
                artistURL: ' ',
                fullTitle: nameAndArtist,
                artist: null,
                properImage: null,
                properMoreFrom: ' ',
                properProvider: ' ',
                embedColor: '#ff0000'
            };
        }
        searches = songSearches;
    }
    const firstSong = searches[0];
    const fullTitle = firstSong.fullTitle || nameAndArtist;
/* 
    // Check if the fullTitle matches the requested title
    if (!fullTitle.toLowerCase().includes(song.toLowerCase())) {
        console.log('Song not found');
        return {
            success: true,
            properLyrics: "no lyrics or instrumental",
            trackURL: null,
            artistURL: ' ',
            fullTitle: nameAndArtist,
            artist: null,
            properImage: null,
            properMoreFrom: ' ',
            properProvider: ' ',
            embedColor: '#ff0000'
        };
    } */
    const image = firstSong.image;
    let embedColor = '#ff0000';
    await getAverageColor(image).then(color => {
        embedColor = color.hex;
    });
    const songArtist = firstSong.artist.name;
    const trackURL = firstSong.url ? firstSong.url : ' ';
    const artistURL = firstSong.artist.url;
    let properImage = image ? image : ' ';
    let properLyrics;
    let properMoreFrom = `More from [${songArtist}](${artistURL})`;
    let properProvider = 'Lyrics and Art provided by Genius, not affiliated';
    try {
        const lyrics = await firstSong.lyrics();
        properLyrics = lyrics.replace(/\[(.*?)\]/g, (match, p1) => {
            return `**[${p1}]**`;
        });
    } catch (error) {
        properLyrics = "no lyrics or instrumental";
        properImage = null;
        properMoreFrom = ' ';
        properProvider = ' ';
    }
    console.log({
        success: true,
        trackURL,
        artistURL,
        fullTitle,
        artist,
        image,
        moreFrom: `More from [${firstSong.artist.name}](${firstSong.artist.url})`,
        embedColor,
        provider: 'Lyrics and Art provided by Genius, not affiliated'
    })
    return {
        success: true,
        properLyrics,
        trackURL,
        artistURL,
        fullTitle,
        artist,
        properImage,
        properMoreFrom,
        properProvider,
        embedColor: embedColor
    };
}

module.exports = { searchForLyrics };