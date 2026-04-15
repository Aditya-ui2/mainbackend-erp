const admin = require('firebase-admin');

// Ensure we only initialize once
if (!admin.apps.length) {
    try {
        // We will try to load from environment variables first (most secure)
        if (process.env.FIREBASE_PROJECT_ID) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                })
            });
            console.log('✅ Firebase Admin Initialized via Environment Variables');
        } else {
            // Fallback for local development or if a JSON file exists
            // This is matched to the 'mabicons-1307f' project from your console
            console.warn('⚠️ Firebase Admin Environment Variables missing. Please configure them in .env');
        }
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
    }
}

module.exports = admin;
