// utils/emailService.js
const axios = require('axios'); // Make sure to install axios: npm install axios

const sendEmail = async (options) => {
    try {
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey || apiKey === 'your_brevo_api_key_here') {
            console.log('--- 📧 MOCK EMAIL SEND (Missing BREVO_API_KEY) ---');
            console.log('To:', options.email);
            console.log('Subject:', options.subject);
            console.log('Content Summary:', options.htmlContent.slice(0, 100) + '...');
            console.log('--------------------------------------------------');
            return { message: 'Mock email logged to console ' };
        }

        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: {
                    name: "MabiconsERP",
                    email: "mabiconserp@gmail.com"
                },
                to: [{
                    email: options.email,
                    name: options.name || options.email
                }],
                subject: options.subject,
                htmlContent: options.htmlContent,
                attachment: Array.isArray(options.attachments) && options.attachments.length > 0
                    ? options.attachments
                    : undefined
            },
            {
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                }
            }
        );

        console.log('Email sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending email:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = sendEmail;