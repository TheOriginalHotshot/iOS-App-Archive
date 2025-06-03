document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    const loadingEl = document.getElementById('loading');
    const ARCHIVE_USER = 'legacyios_archive';

    // Step 1: Get all items in your account
    fetch(`https://archive.org/services/search/v1/scrape?fields=identifier&q=uploader:${ARCHIVE_USER}&count=1000`)
    .then(response => response.json())
    .then(data => {
        const allItems = data.items;
        console.log("Total Archive.org items found:", allItems.length);
        
        // Step 2: Process each item to find IPA files
        const processItem = (item) => {
            return fetch(`https://archive.org/metadata/${item.identifier}`)
                .then(res => res.json())
                .then(itemData => {
                    // Find IPA files in this item
                    const ipaFiles = itemData.files.filter(file => 
                        file.name.toLowerCase().endsWith('.ipa') && 
                        !file.name.toLowerCase().includes('meta.xml')
                    );
                    
                    return ipaFiles.map(ipa => {
                        // Find matching icon
                        const baseName = ipa.name.replace('.ipa', '').replace('.IPA', '');
                        const icon = findIcon(itemData.files, baseName);
                        
                        return {
                            name: cleanName(ipa.name),
                            link: `https://archive.org/download/${item.identifier}/${ipa.name}`,
                            icon: icon || `https://archive.org/services/img/${item.identifier}`,
                            item: item.identifier
                        };
                    });
                })
                .catch(e => {
                    console.warn(`Skipping item ${item.identifier}:`, e.message);
                    return [];
                });
        };
        
        // Process all items in parallel
        return Promise.all(allItems.map(processItem));
    })
    .then(appsArrays => {
        // Flatten all apps into a single array
        const allApps = appsArrays.flat();
        console.log("Total IPA files found:", allApps.length);
        
        if (allApps.length === 0) {
            throw new Error("No IPA files found in your Archive.org uploads");
        }
        
        // Step 3: Render apps
        renderApps(allApps);
        setupSearch(allApps);
        searchInput.disabled = false;
        loadingEl.remove();
    })
    .catch(error => {
        console.error("Error:", error);
        container.innerHTML = `
            <div class="error" style="
                text-align: center;
                padding: 40px;
                color: #ff6b6b;
                max-width: 600px;
                margin: 0 auto;
            ">
                <h2>⚠️ ${error.message}</h2>
                <p>Please ensure:</p>
                <ul style="text-align: left; margin: 20px auto; max-width: 400px;">
                    <li>Files have .ipa extension</li>
                    <li>Uploads are public on Archive.org</li>
                    <li>Your username is "legacyios_archive"</li>
                </ul>
                <button onclick="window.location.reload()" style="
                    padding: 10px 20px;
                    background: #4a9ce8;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    margin-top: 20px;
                    cursor: pointer;
                ">Retry</button>
            </div>
        `;
        loadingEl.remove();
    });

    // Helper functions
    function cleanName(filename) {
        return filename
            .replace('.ipa', '')
            .replace('.IPA', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace('Ipa', '')
            .trim();
    }

    function findIcon(files, baseName) {
        // Common icon patterns to check
        const patterns = [
            `${baseName}.png`, `${baseName}.jpg`, `${baseName}.jpeg`,
            `${baseName}_icon.png`, `${baseName}-icon.jpg`,
            'icon.png', 'thumbnail.jpg', 'cover.jpg'
        ];
        
        // Find first matching file
        const iconFile = files.find(file => 
            patterns.some(pattern => 
                file.name.toLowerCase() === pattern.toLowerCase()
            )
        );
        
        return iconFile ? 
            `https://archive.org/download/${files[0].dir}/${iconFile.name}` : 
            null;
    }

    function renderApps(apps) {
        container.innerHTML = apps.map(app => `
            <div class="app-card">
                <img src="${app.icon}" alt="${app.name}" 
                     onerror="this.src='https://archive.org/services/img/${app.item}'">
                <h2>${app.name}</h2>
                <a href="${app.link}" target="_blank">Download</a>
            </div>
        `).join('');
    }

    function setupSearch(apps) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            renderApps(
                query ? apps.filter(app => 
                    app.name.toLowerCase().includes(query)
                ) : apps
            );
        });
    }
});
