async function translateMessageToEnglish(message) {
    const sourceText = message.content;
    const sourceLang = 'auto'; // Detect language automatically
    const targetLang = 'en';   // Translate to English

    const text = sourceText.replace(/<@![0-9]+>/g, '').replace(/<#[0-9]+>/g, '');
    
    // Fetch translation from Google Translate API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURI(text)}`);
    const data = await response.json();
    const translatedMessage = data[0][0][0]; // Extract translated text from the response
    
    return translatedMessage;
}