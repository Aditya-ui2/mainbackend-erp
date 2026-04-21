const dotenv = require('dotenv');
const path = require('path');
const result = dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (result.error) {
  console.log('Error loading .env file:', result.error);
} else {
  console.log('Loaded .env successfully');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
}
