const http = require('http');

http.get('http://localhost:3000/problems', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            console.log("API response:", JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log("Raw response:", data);
        }
    });
}).on('error', (err) => {
    console.error("HTTP error:", err.message);
});
