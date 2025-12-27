(function () {
    // Intercept XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function () {
        this.addEventListener('load', () => {
            if (this._url && this._url.includes('/api/graphql')) {
                // Send raw text to content script via window message
                window.postMessage({
                    type: 'FB_GRAPHQL_INTERCEPT',
                    payload: this.responseText
                }, '*');
            }
        });
        return send.apply(this, arguments);
    };

    // Intercept Fetch
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await origFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

        if (url && url.includes('/api/graphql')) {
            response.clone().text().then(text => {
                window.postMessage({
                    type: 'FB_GRAPHQL_INTERCEPT',
                    payload: text
                }, '*');
            }).catch(err => console.error("Fetch clone error", err));
        }
        return response;
    };

    console.log('[Phase-1] Interceptor Injected');
})();
