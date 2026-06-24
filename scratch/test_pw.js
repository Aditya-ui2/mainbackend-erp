const bcrypt = require('bcrypt');

const hash = '$2b$10$T9y6MepqM30.6iP332W60uq8gL9pQW7Y1yNgrCjT5wD3S67Y9yNgr';
const passwords = ['Ashwin@123', 'Ashwin@123456', '5UDD3S67', '5UDD3S67Y9yNgr'];

async function run() {
  for (const pw of passwords) {
    const match = await bcrypt.compare(pw, hash);
    console.log(`Password: "${pw}" -> Match: ${match}`);
  }
}

run();
