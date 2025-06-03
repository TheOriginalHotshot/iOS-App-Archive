document.addEventListener('DOMContentLoaded', function() {
    // Show loading screen
    const loadingHTML = `
    <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading Legacy iOS Apps...</div>
    </div>`;
    document.body.insertAdjacentHTML('afterbegin', loadingHTML);

    const container = document.getElementById('appContainer');
    const archiveUser = 'legacyios_archive';

    console.log("Starting fetch..."); // Debug log

    // Fetch all collections
    fetch(`https://archive.org/services/search/v1/scrape?fields=identifier&q=collection:(${archiveUser})&count=100`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(collections => {
            console.log("Collections found:", collections.items.length); // Debug log
            if (!collections.items || collections.items.length === 0) {
                throw new Error("No collections found");
            }

            const appPromises = collections.items.map(collection => {
                console.log("Fetching collection:", collection.identifier); // Debug log
                return fetch(`https://archive.org/metadata/${collection.identifier}`)
                    .then(res => res.json())
                    .then(data => {
                        const ipaFiles = data.files.filter(file => 
                            file.name.endsWith('.ipa') && 
                            !file.name.includes('_meta.xml')
                        );
                        console.log(`Found ${ipaFiles.length} IPAs in ${collection.identifier}`); // Debug log
                        return ipaFiles.map(ipa => ({
                            name: cleanAppName(ipa.name),
                            link: `https://archive.org/download/${collection.identifier}/${ipa.name}`,
                            icon: findIconPath(data.files, ipa.name, collection.identifier),
                            format: ipa.format
                        }));
                    });
            });

            return Promise.all(appPromises);
        })
        .then(appsArrays => {
            const allApps = appsArrays.flat();
            console.log("Total apps loaded:", allApps.length); // Debug log
            renderApps(allApps);
        })
        .catch(error => {
            console.error("Error:", error);
            document.querySelector('.loading-text').textContent = "Error loading apps. Check console (F12) for details.";
            container.innerHTML = `<div class="error">Failed to load apps: ${error.message}</div>`;
        })
        .finally(() => {
            setTimeout(() => {
                const loader = document.querySelector('.loading-container');
                if (loader) loader.style.opacity = '0';
                setTimeout(() => loader?.remove(), 300);
            }, 500);
        });

    // ... (keep the existing cleanAppName, findIconPath, and renderApps functions)
});
