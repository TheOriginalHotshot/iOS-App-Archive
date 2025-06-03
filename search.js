document.addEventListener('DOMContentLoaded', function() {
    // Simple loading screen
    const container = document.getElementById('appContainer');
    container.innerHTML = `
        <div class="loading" style="
            text-align: center;
            padding: 50px;
            font-size: 18px;
            color: #666;
        ">
            Loading apps...
        </div>
    `;

    // Your Archive.org username
    const ARCHIVE_USER = 'legacyios_archive';
    
    // More reliable API endpoint
    const API_URL = `https://archive.org/advancedsearch.php?q=uploader:${ARCHIVE_USER}&output=json&rows=100`;

    console.log("Starting app load...");

    // First fetch all your Archive.org items
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("Found items:", data.response.docs.length);
            
            // Process each item to find IPAs
            const processItem = async (item) => {
                try {
                    const itemData = await fetch(`https://archive.org/metadata/${item.identifier}`)
                        .then(res => res.json());
                    
                    const ipaFiles = itemData.files.filter(file => 
                        file.name.endsWith('.ipa') && 
                        !file.name.includes('_meta.xml')
                    );
                    
                    return ipaFiles.map(ipa => ({
                        name: formatName(ipa.name),
                        link: `https://archive.org/download/${item.identifier}/${ipa.name}`,
                        icon: findIcon(itemData.files, ipa.name, item.identifier),
                        size: ipa.size ? (ipa.size/1000000).toFixed(1) + ' MB' : ''
                    }));
                } catch (e) {
                    console.warn(`Failed to process ${item.identifier}:`, e);
                    return [];
                }
            };
            
            // Process all items in parallel
            return Promise.all(data.response.docs.map(processItem));
        })
        .then(appsArrays => {
            const allApps = appsArrays.flat();
            console.log("Total apps found:", allApps.length);
            
            if (allApps.length === 0) {
                throw new Error("No IPA files found in your Archive.org items");
            }
            
            renderApps(allApps);
            setupSearch(allApps);
        })
        .catch(error => {
            console.error("Loading failed:", error);
            container.innerHTML = `
                <div class="error" style="
                    text-align: center;
                    padding: 20px;
                    color: #d00;
                ">
                    <h2>⚠️ Loading Failed</h2>
                    <p>${error.message}</p>
                    <button onclick="window.location.reload()" style="
                        padding: 8px 15px;
                        background: #e0e0e0;
                        border: none;
                        border-radius: 5px;
                        margin-top: 10px;
                    ">Retry</button>
                </div>
            `;
        });

    // Helper functions
    function formatName(filename) {
        return filename
            .replace('.ipa', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function findIcon(files, ipaName, itemId) {
        const base = ipaName.replace('.ipa', '');
        const patterns = [
            `${base}.png`, `${base}.jpg`, `${base}.jpeg`,
            `${base}_icon.png`, 'icon.png', 'thumbnail.jpg'
        ];
        
        const icon = files.find(f => 
            patterns.some(p => f.name.toLowerCase() === p.toLowerCase())
        );
        
        return icon ? 
            `https://archive.org/download/${itemId}/${icon.name}` : 
            `https://archive.org/services/img/${itemId}`;
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

    function setupSearch(allApps) {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            renderApps(
                query ? allApps.filter(app => 
                    app.name.toLowerCase().includes(query)
                ) : allApps
            );
        });
    }
});
