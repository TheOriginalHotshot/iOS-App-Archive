// Configuration
const ARCHIVE_USER = 'legacyios_archive';
const CACHE_TIME = 15 * 60 * 1000; // 15 minutes cache

document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    const loadingEl = document.getElementById('loading');

    // Try loading from cache first
    const cachedData = localStorage.getItem('ipaCache');
    const cacheTime = localStorage.getItem('ipaCacheTime');
    
    if (cachedData && cacheTime && (Date.now() - cacheTime < CACHE_TIME)) {
        renderApps(JSON.parse(cachedData));
        searchInput.disabled = false;
        loadingEl.remove();
        return;
    }

    // Fetch all IPAs from your uploads
    fetch(`https://archive.org/services/search/v1/scrape?fields=identifier,title&q=uploader:${ARCHIVE_USER} AND format:(IPA OR .ipa)&count=1000`)
        .then(response => {
            if (!response.ok) throw new Error("Archive.org API failed");
            return response.json();
        })
        .then(data => {
            if (!data.items || data.items.length === 0) {
                throw new Error("No IPA files found in your uploads");
            }
            
            const apps = data.items.map(item => ({
                name: cleanName(item.title || item.identifier),
                link: `https://archive.org/download/${item.identifier}/${item.identifier}.ipa`,
                icon: `https://archive.org/services/img/${item.identifier}`,
                identifier: item.identifier
            }));
            
            // Cache the results
            localStorage.setItem('ipaCache', JSON.stringify(apps));
            localStorage.setItem('ipaCacheTime', Date.now());
            
            renderApps(apps);
            setupSearch(apps);
            searchInput.disabled = false;
        })
        .catch(error => {
            console.error("Loading failed:", error);
            container.innerHTML = `
                <div class="error">
                    <h2>⚠️ Loading Failed</h2>
                    <p>${error.message}</p>
                    ${cachedData ? '<p>Showing cached data</p>' : ''}
                    <button onclick="window.location.reload()">Retry</button>
                </div>
            `;
            
            if (cachedData) {
                renderApps(JSON.parse(cachedData));
            }
        })
        .finally(() => {
            loadingEl.remove();
        });

    function cleanName(str) {
        return str
            .replace('.ipa', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function renderApps(apps) {
        container.innerHTML = apps.map(app => `
            <div class="app-card">
                <img src="${app.icon}" alt="${app.name}" 
                     onerror="this.src='https://archive.org/services/img/${app.identifier}'">
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
