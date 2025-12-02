chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CLONE_DATA') {
        // In the future, we can send this to the web app via an API or open the web app with data
        console.log('Received clone data:', request.data);
        // For now, just save to storage so the web app can potentially read it if on same origin (not really, but for demo)
        chrome.storage.local.set({ lastClone: request.data });
    }
});
