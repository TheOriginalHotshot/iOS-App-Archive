document.addEventListener('DOMContentLoaded', function() {
    // Hide loading screen
    document.getElementById('loading').remove();
    
    const container = document.getElementById('appContainer');
    const searchInput = document.getElementById('searchInput');
    
    // Render apps from global data (loaded from ipa-data.json)
    function renderApps() {
        container.innerHTML = '';
        
        window.appData.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.innerHTML = `
                <img src="${app.icon}" alt="${app.name}" 
                     onerror="this.src='https://archive.org/services/img/legacyios_archive'">
                <h2>${app.name}</h2>
                <p>${app.description}</p>
                <a href="${app.link}" target="_blank">Download</a>
            `;
            container.appendChild(card);
        });
    }
    
    // Setup search functionality
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const filtered = window.appData.filter(app => 
            app.name.toLowerCase().includes(query) || 
            app.description.toLowerCase().includes(query)
        );
        
        container.innerHTML = '';
        filtered.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            card.innerHTML = `
                <img src="${app.icon}" alt="${app.name}">
                <h2>${app.name}</h2>
                <p>${app.description}</p>
                <a href="${app.link}" target="_blank">Download</a>
            `;
            container.appendChild(card);
        });
    });
    
    // Initial render
    renderApps();
});
