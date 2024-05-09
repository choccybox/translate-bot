import('node-fetch').then((fetch) => {
    global.fetch = fetch.default;
});
