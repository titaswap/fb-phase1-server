chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SAVE_POST') {
        fetch('http://localhost:3000/phase1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
        })
            .then(response => response.json())
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.error('Error saving post:', error);
                sendResponse({ success: false, error: error.toString() });
            });

        // Return true to indicate we wish to send a response asynchronously
        return true;
    }
});
