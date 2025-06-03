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
    const archiveUser = 'legacyios_archive';

    // Fetch all collections
    fetch(`https://archive.org/services/search/v1/scrape?fields=identifier&q=collection:(${archiveUser})&count=100`)
        .then(response => response.json())
        .then(collections => {
            const appPromises = collections.items.map(collection => {
                return fetch(`https://archive.org/metadata/${collection.identifier}`)
                    .then(res => res.json())
                    .then(data => {
                        const ipaFiles = data.files.filter(file => 
                            file.name.endsWith('.ipa') && 
                            !file.name.includes('_meta.xml')
                        );
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
            renderApps(allApps);
            
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();
                const filtered = allApps.filter(app => 
                    app.name.toLowerCase().includes(query)
                );
                renderApps(filtered);
            });
        })
        .catch(error => {
            console.error("Error:", error);
            document.querySelector('.loading-text').textContent = "Error loading apps. Refresh to try again.";
        })
        .finally(() => {
            setTimeout(() => {
                const loader = document.querySelector('.loading-container');
                if (loader) loader.style.opacity = '0';
                setTimeout(() => loader?.remove(), 300);
            }, 500);
        });

    function cleanAppName(filename) {
        return filename
            .replace('.ipa', '')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    function findIconPath(files, ipaName, collectionId) {
        const baseName = ipaName.replace('.ipa', '');
        const possibleIcons = [
            `${baseName}.png`,
            `${baseName}.jpg`,
            `${baseName}.jpeg`,
            `${baseName}_icon.png`,
            'icon.png'
        ];
        
        const foundIcon = files.find(file => 
            possibleIcons.includes(file.name.toLowerCase())
        );
        
        return foundIcon ? 
            `https://archive.org/download/${collectionId}/${foundIcon.name}` : 
            'https://archive.org/download/legacyios_archive/default_app_icon.png';
    }

    function renderApps(apps) {
        container.innerHTML = '';
        if (apps.length === 0) {
            container.innerHTML = '<p class="no-results">No apps found. Try another search.</p>';
            return;
        }
        
        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.innerHTML = `
                <img src="${app.icon}" alt="${app.name}" onerror="this.src='https://archive.org/download/legacyios_archive/default_app_icon.png'">
                <h2>${app.name}</h2>
                ${app.format ? `<p>${app.format}</p>` : ''}
                <a href="${app.link}" target="_blank">Download</a>
            `;
            container.appendChild(card);
        });
    }
});
