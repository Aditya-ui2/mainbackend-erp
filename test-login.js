const http = require('http');
const fs = require('fs');

const outputFile = 'c:\\rn\\api-test-result.txt';

// First try a simple GET to check server health
const healthOptions = {
    hostname: '15.206.67.102',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000
};

fs.writeFileSync(outputFile, 'Testing server health...\n');

const healthReq = http.request(healthOptions, (res) => {
    fs.appendFileSync(outputFile, `Health check - Status: ${res.statusCode}\n`);
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        fs.appendFileSync(outputFile, `Health response: ${body.substring(0, 200)}\n`);
        
        // Now test login
        const data = JSON.stringify({
            email: 'recruitment.mabicons@gmail.com',
            password: 'Recruitment@123'
        });

        const loginOptions = {
            hostname: '15.206.67.102',
            port: 3000,
            path: '/department/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
            timeout: 15000
        };

        fs.appendFileSync(outputFile, '\nTesting login API...\n');

        const loginReq = http.request(loginOptions, (res) => {
            fs.appendFileSync(outputFile, `Login Status: ${res.statusCode}\n`);
            let loginBody = '';
            res.on('data', d => loginBody += d);
            res.on('end', () => {
                fs.appendFileSync(outputFile, `Login Response: ${loginBody}\n`);
                fs.appendFileSync(outputFile, 'DONE\n');
                process.exit(0);
            });
        });

        loginReq.on('error', (e) => {
            fs.appendFileSync(outputFile, `Login Error: ${e.message}\n`);
            fs.appendFileSync(outputFile, 'DONE\n');
            process.exit(1);
        });

        loginReq.on('timeout', () => {
            fs.appendFileSync(outputFile, 'Login Request timed out\n');
            loginReq.destroy();
        });

        loginReq.write(data);
        loginReq.end();
    });
});

healthReq.on('error', (e) => {
    fs.appendFileSync(outputFile, `Health check Error: ${e.message}\n`);
    fs.appendFileSync(outputFile, 'DONE\n');
    process.exit(1);
});

healthReq.on('timeout', () => {
    fs.appendFileSync(outputFile, 'Health check timed out - server may be down\n');
    healthReq.destroy();
});

healthReq.end();

// Global timeout
setTimeout(() => {
    fs.appendFileSync(outputFile, 'Global timeout (20s)\n');
    fs.appendFileSync(outputFile, 'DONE\n');
    process.exit(1);
}, 20000);
