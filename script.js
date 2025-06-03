document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    const loadingEl = document.getElementById('loading');
    const errorContainer = document.getElementById('errorContainer');
    const appModal = document.getElementById('appModal');
    const closeModal = document.getElementById('closeModal');
    
    // Configuration
    const ARCHIVE_USER = 'legacyios_archive';
    let allApps = [];
    
    // Show error message
    function showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.innerHTML = `
            <span>⚠️ ${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        errorContainer.appendChild(errorEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorEl.remove();
        }, 5000);
    }
    
    // Fetch all items from Archive.org
    async function fetchApps() {
        try {
            // Fetch list of items
            const response = await fetch(
                `https://archive.org/services/search/v1/scrape?fields=identifier&q=uploader:${ARCHIVE_USER}&count=1000`
            );
            
            if (!response.ok) {
                throw new Error(`Archive.org error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                throw new Error("No items found for your Archive.org account");
            }
            
            // Process each item
            const appPromises = data.items.map(async (item) => {
                try {
                    // Fetch item metadata
                    const itemRes = await fetch(`https://archive.org/metadata/${item.identifier}`);
                    const itemData = await itemRes.json();
                    
                    // Find IPA file
                    const ipaFile = itemData.files.find(f => 
                        f.name.toLowerCase().endsWith('.ipa')
                    );
                    
                    if (!ipaFile) return null;
                    
                    // Find icon - try common patterns
                    const baseName = ipaFile.name.replace('.ipa', '').replace('.IPA', '');
                    const iconPatterns = [
                        `${baseName}.png`, `${baseName}.jpg`, `${baseName}.jpeg`,
                        `${baseName}_icon.png`, 'icon.png', 'thumbnail.jpg'
                    ];
                    
                    const iconFile = itemData.files.find(f => 
                        iconPatterns.some(pattern => 
                            f.name.toLowerCase() === pattern.toLowerCase()
                        )
                    );
                    
                    // Extract metadata
                    const metadata = itemData.metadata || {};
                    
                    return {
                        id: item.identifier,
                        name: metadata.title || baseName,
                        developer: metadata.creator || "Unknown Developer",
                        date: metadata.date || "Unknown Date",
                        version: extractVersion(metadata),
                        categories: metadata.subject ? metadata.subject.join(', ') : "Various",
                        description: metadata.description || "No description available",
                        ipaUrl: `https://archive.org/download/${item.identifier}/${ipaFile.name}`,
                        iconUrl: iconFile ? 
                            `https://archive.org/download/${item.identifier}/${iconFile.name}` : 
                            `https://archive.org/services/img/${item.identifier}`
                    };
                } catch (e) {
                    console.warn(`Error processing item ${item.identifier}:`, e);
                    return null;
                }
            });
            
            // Wait for all items to process
            const apps = await Promise.all(appPromises);
            return apps.filter(app => app !== null);
            
        } catch (error) {
            console.error('Fetch error:', error);
            showError(error.message);
            return [];
        }
    }
    
    // Extract version from metadata
    function extractVersion(metadata) {
        if (metadata.version) return metadata.version;
        
        // Try to extract from description
        const versionMatch = metadata.description?.match(/(version|v|ver)[\s:]*([\d.]+)/i);
        return versionMatch ? versionMatch[2] : "1.0";
    }
    
    // Render apps to the list
    function renderApps(apps) {
        container.innerHTML = '';
        
        if (apps.length === 0) {
            container.innerHTML = '<div class="app-row"><p>No apps found</p></div>';
            return;
        }
        
        apps.forEach(app => {
            const appRow = document.createElement('div');
            appRow.className = 'app-row';
            appRow.innerHTML = `
                <img src="${app.iconUrl}" alt="${app.name}" class="app-icon" 
                     onerror="this.src='https://archive.org/services/img/${ARCHIVE_USER}'">
                <div class="app-info">
                    <div class="app-name">${app.name}</div>
                    <div class="app-developer">${app.developer}</div>
                </div>
                <button class="more-info-button" data-id="${app.id}">More Info</button>
            `;
            container.appendChild(appRow);
        });
        
        // Add event listeners to buttons
        document.querySelectorAll('.more-info-button').forEach(button => {
            button.addEventListener('click', function() {
                const appId = this.getAttribute('data-id');
                const app = apps.find(a => a.id === appId);
                if (app) showAppDetail(app);
            });
        });
    }
    
    // Show app detail modal
    function showAppDetail(app) {
        document.getElementById('modalAppName').textContent = app.name;
        document.getElementById('modalDeveloper').textContent = app.developer;
        document.getElementById('modalDate').textContent = app.date;
        document.getElementById('modalVersion').textContent = app.version;
        document.getElementById('modalCategories').textContent = app.categories;
        document.getElementById('modalDescription').textContent = app.description;
        document.getElementById('modalAppIcon').src = app.iconUrl;
        document.getElementById('downloadLink').href = app.ipaUrl;
        
        appModal.style.display = 'flex';
    }
    
    // Initialize the app
    async function init() {
        try {
            allApps = await fetchApps();
            renderApps(allApps);
            
            // Setup search
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();
                const filtered = allApps.filter(app => 
                    app.name.toLowerCase().includes(query) || 
                    app.developer.toLowerCase().includes(query) ||
                    app.categories.toLowerCase().includes(query)
                );
                renderApps(filtered);
            });
            
            // Close modal
            closeModal.addEventListener('click', () => {
                appModal.style.display = 'none';
            });
            
            // Close modal when clicking outside
            appModal.addEventListener('click', (e) => {
                if (e.target === appModal) {
                    appModal.style.display = 'none';
                }
            });
            
        } catch (error) {
            showError(`Initialization failed: ${error.message}`);
        } finally {
            loadingEl.remove();
        }
    }
    
    // Start the app
    init();
});
