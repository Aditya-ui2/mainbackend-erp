require('dotenv').config();
const sharePointService = require('../utils/sharePointService');

async function run() {
  console.log("Checking credentials in .env...");
  console.log("SHAREPOINT_TENANT_ID:", process.env.SHAREPOINT_TENANT_ID);
  console.log("SHAREPOINT_CLIENT_ID:", process.env.SHAREPOINT_CLIENT_ID);
  console.log("SHAREPOINT_CLIENT_SECRET:", process.env.SHAREPOINT_CLIENT_SECRET ? (process.env.SHAREPOINT_CLIENT_SECRET.substring(0, 5) + "...") : "NOT_SET");
  console.log("SHAREPOINT_SITE_URL:", process.env.SHAREPOINT_SITE_URL);
  console.log("SHAREPOINT_RESUME_PATH:", process.env.SHAREPOINT_RESUME_PATH);

  try {
    console.log("\nAttempting to get Access Token...");
    const token = await sharePointService.getAccessToken();
    console.log("SUCCESS: Access Token received:", token.substring(0, 15) + "...");

    console.log("\nAttempting to get Site ID...");
    const siteId = await sharePointService.getSiteId();
    console.log("SUCCESS: Site ID is:", siteId);

    console.log("\nAttempting to list Drives...");
    const drives = await sharePointService.getDrives(siteId);
    console.log("SUCCESS: Found drives:");
    drives.forEach(d => console.log(`- Name: "${d.name}", ID: ${d.id}`));

    const docLib = drives.find(d => d.name === 'Documents' || d.name === 'Shared Documents');
    if (!docLib) {
      console.log("ERROR: Could not find 'Documents' or 'Shared Documents' library.");
      return;
    }

    console.log(`\nAttempting to list contents of path: "${process.env.SHAREPOINT_RESUME_PATH}"...`);
    const contents = await sharePointService.getFolderContents(siteId, docLib.id, process.env.SHAREPOINT_RESUME_PATH);
    console.log("SUCCESS: Found items inside folder:");
    contents.forEach(item => {
      console.log(`- [${item.folder ? "FOLDER" : "FILE"}] Name: "${item.name}", ID: ${item.id}`);
    });

  } catch (error) {
    console.error("\nFAIL: Connection or fetch failed.");
    if (error.response && error.response.data) {
      console.error("Microsoft Graph Error Details:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error Message:", error.message);
    }
  }
}

run();
