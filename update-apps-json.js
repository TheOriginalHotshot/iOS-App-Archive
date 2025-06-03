const fetch = require('node-fetch');
const fs = require('fs').promises;

async function fetchArchiveData() {
    const url = 'https://archive.org/advancedsearch.php?q=collection%3A%22apple_apps%22&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=description&fl%5B%5D=date&sort%5B%5D=addeddate+desc&rows=1000&output=json';
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Archive.org request failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.response.docs;
    } catch (error) {
        console.error('Fetch error:', error);
        process.exit(1);  // Fail the workflow
    }
}

async function updateAppsJson() {
    try {
        const apps = await fetchArchiveData();
        const jsonData = JSON.stringify(apps, null, 2);
        await fs.writeFile('apps.json', jsonData);
        console.log('✅ apps.json updated successfully');
    } catch (error) {
        console.error('❌ Error updating apps.json:', error);
        process.exit(1);  // Fail the workflow
    }
}

updateAppsJson();
