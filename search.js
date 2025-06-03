document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    const loadingEl = document.getElementById('loading');
    const ARCHIVE_USER = 'legacyios_archive';

    // NEW RELIABLE API ENDPOINT
    fetch(`https://archive.org/advancedsearch.php?q=uploader:${ARCHIVE_USER}&output=json&rows=1000&fl[]=identifier`)
        .then(response => response.json())
        .then(data => {
            if (!data.response || !data.response.docs || data.response.docs.length === 0) {
                throw new Error("No Archive.org items found for your account");
            }
            
            const items = data.response.docs;
            console.log("Archive.org items found:", items.length);
            
            // Process each item to find IPAs
            const processItem = (item) => {
                return fetch(`https://archive.org/metadata/${item.identifier}`)
                    .then(res => res.json())
                    .then(itemData => {
                        if (!itemData.files) return [];
                        
                        // Find IPA files
                        const ipaFiles = itemData.files.filter(file => 
                            file.name.toLowerCase().endsWith('.ipa')
                        );
                        
                        return ipaFiles.map(ipa => {
                            const baseName = ipa.name.replace(/\.ipa$/i, '');
                            return {
                                name: cleanName(baseName),
                                link: `https://archive.org/download/${item.identifier}/${ipa.name}`,
                                icon: findIcon(itemData.files, baseName) || 
                                      `https://archive.org/services/img/${item.identifier}`,
                                size: ipa.size ? (ipa.size/1000000).toFixed(1) + ' MB' : ''
                            };
                        });
                    })
                    .catch(e => {
                        console.warn(`Skipping item ${item.identifier}:`, e);
                        return [];
                    });
            };
            
            return Promise.all(items.map(processItem));
        })
        .then(appsArrays => {
            const allApps = appsArrays.flat();
            console.log("Total IPA files found:", allApps.length);
            
            if (allApps.length === 0) {
                throw new Error("No IPA files found. Please ensure your files have '.ipa' extension");
            }
            
            renderApps(allApps);
            setupSearch(allApps);
            searchInput.disabled = false;
            loadingEl.remove();
        })
        .catch(error => {
            console.error("Error:", error);
            container.innerHTML = `
                <div class="error">
                    <h2>⚠️ ${error.message}</h2>
                    <p>For account: <strong>${ARCHIVE_USER}</strong></p>
                    <p>Please verify:</p>
                    <ul>
                        <li>Files end with <code>.ipa</code> extension</li>
                        <li>Uploads are public on Archive.org</li>
                        <li>Your username is correct</li>
                    </ul>
                    <button onclick="window.location.reload()">Retry</button>
                    <p style="margin-top:20px">
                        <small>Need help? Contact support with your Archive.org URL</small>
                    </p>
                </div>
            `;
            loadingEl.remove();
        });

    // Helper functions
    function cleanName(str) {
        return str
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace('Ipa', '')
            .trim();
    }

    function findIcon(files, baseName) {
        const patterns = [
            `${baseName}.png`, `${baseName}.jpg`, `${baseName}.jpeg`,
            `${baseName}_icon.png`, 'icon.png', 'thumbnail.jpg'
        ];
        
        const iconFile = files.find(file => 
            patterns.some(pattern => 
                file.name.toLowerCase() === pattern.toLowerCase()
            )
        );
        
        return iconFile ? 
            `https://archive.org/download/${iconFile.dir}/${iconFile.name}` : 
            null;
    }

    function renderApps(apps) {
        container.innerHTML = apps.map(app => `
            <div class="app-card">
                <img src="${app.icon}" alt="${app.name}" 
                     onerror="this.src='https://archive.org/services/img/${ARCHIVE_USER}'">
                <h2>${app.name}</h2>
                ${app.size ? `<p>${app.size}</p>` : ''}
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
                : apps
            );
        });
        
        // Enable search immediately
        searchInput.disabled = false;
    }
});
