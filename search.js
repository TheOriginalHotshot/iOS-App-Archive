document.addEventListener('DOMContentLoaded', function() {
    // Show loading screen
    const loadingHTML = `
    <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading Legacy iOS Apps...</div>
    </div>`;
    document.body.insertAdjacentHTML('afterbegin', loadingHTML);

    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    const archiveUser = 'legacyios_archive'; // Your Archive.org username

    // Step 1: Fetch ALL your public items
    fetch(`https://archive.org/services/search/v1/scrape?fields=identifier&q=uploader:(${archiveUser})&count=1000`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch your Archive.org items");
            return response.json();
        })
        .then(data => {
            const allItems = data.items.map(item => item.identifier);
            console.log("Found items:", allItems);
            
            // Step 2: Scan each item for IPAs
            return Promise.all(
                allItems.map(itemId => 
                    fetch(`https://archive.org/metadata/${itemId}`)
                        .then(res => res.json())
                        .then(itemData => {
                            const ipas = itemData.files.filter(f => 
                                f.name.endsWith('.ipa') && 
                                !f.name.includes('_meta.xml')
                            );
                            return ipas.map(ipa => ({
                                name: formatAppName(ipa.name),
                                link: `https://archive.org/download/${itemId}/${ipa.name}`,
                                icon: findBestIcon(itemData.files, ipa.name, itemId),
                                item: itemId,
                                size: ipa.size ? (ipa.size/1000000).toFixed(1) + ' MB' : ''
                            }));
                        })
                        .catch(e => {
                            console.warn(`Skipping ${itemId}:`, e.message);
                            return []; // Skip failed items
                        })
                )
            );
        })
        .then(appsArrays => {
            const allApps = appsArrays.flat();
            console.log("Total apps found:", allApps.length);
            
            if (allApps.length === 0) throw new Error("No IPA files found in your account");
            
            renderApps(allApps);
            setupSearch(allApps);
        })
        .catch(error => {
            console.error("Fatal error:", error);
            showError(error.message);
        })
        .finally(() => {
            document.querySelector('.loading-container')?.remove();
        });

    // Helper Functions
    function formatAppName(filename) {
        return filename
            .replace('.ipa', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function findBestIcon(files, ipaName, itemId) {
        const base = ipaName.replace('.ipa', '');
        const patterns = [
            `${base}.png`, `${base}.jpg`, `${base}.jpeg`,
            `${base}_icon.png`, 'icon.png', 'thumbnail.jpg'
        ];
        
        const iconFile = files.find(f => 
            patterns.some(p => f.name.toLowerCase() === p.toLowerCase())
        );
        
        return iconFile ? 
            `https://archive.org/download/${itemId}/${iconFile.name}` : 
            `https://archive.org/services/img/${itemId}`;
    }

    function renderApps(apps) {
        container.innerHTML = apps.map(app => `
            <div class="app-card">
                <img src="${app.icon}" alt="${app.name}" 
                     onerror="this.src='https://archive.org/services/img/${app.item}'">
                <h2>${app.name}</h2>
                ${app.size ? `<p>${app.size}</p>` : ''}
                <a href="${app.link}" target="_blank">Download</a>
            </div>
        `).join('');
    }

    function setupSearch(allApps) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            renderApps(
                query ? allApps.filter(a => 
                    a.name.toLowerCase().includes(query) : 
                    allApps
            );
        });
    }

    function showError(msg) {
        container.innerHTML = `
            <div class="error">
                <h2>⚠️ Loading Failed</h2>
                <p>${msg}</p>
                <p><small>Check browser console (F12) for details</small></p>
                <button onclick="window.location.reload()">Retry</button>
            </div>
        `;
    }
});
