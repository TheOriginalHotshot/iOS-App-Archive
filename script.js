// App data with download URLs and categories
const apps = [
    // ... (app data remains unchanged) ...
];

// DOM Elements
const searchResults = document.getElementById('searchResults');
const searchContainer = document.getElementById('searchContainer');
const searchInput = document.getElementById('searchInput');
const cancelSearch = document.getElementById('cancelSearch');
const tabs = document.querySelectorAll('.tab');
const modalContainer = document.getElementById('modalContainer');
const featuredAppsList = document.getElementById('featuredAppsList');
    
// Tab content areas
const tabContents = {
    featured: document.getElementById('featuredContent'),
    categories: document.getElementById('categoriesContent'),
    genius: document.getElementById('geniusContent'),
    search: document.getElementById('searchContent')
};

// Render search results
function renderSearchResults(filteredApps = []) {
    searchResults.innerHTML = '';
    
    if (filteredApps.length === 0) {
        searchResults.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 20px; color: #aaa;">No apps found. Try a different search term.</p>';
        return;
    }
    
    filteredApps.forEach(app => {
        const appCard = document.createElement('div');
        appCard.className = 'app-card-grid';
        
        appCard.innerHTML = `
            <div class="card-icon">
                ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                '<i class="fas fa-mobile-alt"></i>'}
            </div>
            <div class="card-name">${app.title}</div>
            <div class="card-developer">${app.developer}</div>
            <button class="card-button" data-app-id="${app.id}">View Details</button>
        `;
        
        searchResults.appendChild(appCard);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.card-button').forEach(button => {
        button.addEventListener('click', function() {
            const appId = this.getAttribute('data-app-id');
            setUrlParam('app', appId);
            document.getElementById(`${appId}Modal`).classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
}

// Create modals
function createModals() {
    modalContainer.innerHTML = '';
    
    apps.forEach(app => {
        // Create version list items
        let versionItems = '';
        
        // Add archived versions if they exist
        if (app.versions.archived.length > 0) {
            versionItems += `
                <div class="version-group">
                    <h4>Archived Versions</h4>
                    <ul class="version-list">
                        ${app.versions.archived.map(v => {
                            return `<li>
                                <span>${v.version}</span>
                                <a href="${v.url}" download class="download-button">
                                    <i class="fas fa-download"></i> Download IPA
                                </a>
                            </li>`;
                        }).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Add unarchived versions if they exist
        if (app.versions.unarchived.length > 0) {
            versionItems += `
                <div class="version-group">
                    <h4 class="unarchived-label">Unarchived Versions</h4>
                    <ul class="version-list">
                        ${app.versions.unarchived.map(v => `<li>${v}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Create category tags
        const categoryTags = app.categories.map(cat => 
            `<span class="category-tag">${cat}</span>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = `${app.id}Modal`;
        
        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal">&times;</button>
                <div class="modal-header">
                    <div class="modal-icon">
                        ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                        '<i class="fas fa-mobile-alt"></i>'}
                    </div>
                    <div>
                        <h2 class="modal-title">${app.title}</h2>
                        <p class="modal-developer">${app.developer}</p>
                        <div class="modal-categories">
                            ${categoryTags}
                        </div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-mobile-alt"></i> Compatibility</h3>
                    <p class="compatibility-text">${app.compatibility}</p>
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-align-left"></i> App Store Description</h3>
                    ${app.description.split('\n').map(p => `<p>${p}</p>`).join('')}
                </div>
                
                <div class="modal-section">
                    <h3><i class="fas fa-code-branch"></i> Version History</h3>
                    <div class="versions-scroll-container">
                        <div class="versions-container">
                            ${versionItems}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modalContainer.appendChild(modal);
    });
    
    // Add modal close handlers
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal-overlay').classList.remove('active');
            document.body.style.overflow = 'auto';
            setUrlParam('app', '');
        });
    });
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
                document.body.style.overflow = 'auto';
                setUrlParam('app', '');
            }
        });
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
                setUrlParam('app', '');
            });
        }
    });
}

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Hide all tab content
        Object.values(tabContents).forEach(content => {
            content.classList.remove('active');
        });
        
        // Show/hide views based on tab
        if (tabName === 'featured') {
            searchContainer.style.display = 'none';
            searchResults.classList.remove('active');
            tabContents.featured.classList.add('active');
        } else if (tabName === 'search') {
            searchContainer.style.display = 'block';
            searchResults.classList.add('active');
            tabContents.search.classList.add('active');
            renderSearchResults(apps);
        } else if (tabName === 'categories') {
            searchContainer.style.display = 'none';
            searchResults.classList.remove('active');
            tabContents.categories.classList.add('active');
            renderCategoryList();
        } else {
            // For genius tab
            searchContainer.style.display = 'none';
            searchResults.classList.remove('active');
            tabContents[tabName].classList.add('active');
        }
    });
});

// Search functionality
searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    setUrlParam('query', searchTerm);
    if (searchTerm.length === 0) {
        renderSearchResults(apps);
        return;
    }
    let filteredApps = apps;
    let devPart = null, catPart = null, namePart = searchTerm;
    const devMatch = searchTerm.match(/developer:([^ ]+)/);
    const catMatch = searchTerm.match(/category:([^ ]+)/);
    if (devMatch) {
        devPart = devMatch[1].trim();
        namePart = namePart.replace(devMatch[0], '').trim();
    }
    if (catMatch) {
        catPart = catMatch[1].trim();
        namePart = namePart.replace(catMatch[0], '').trim();
    }
    filteredApps = filteredApps.filter(app => {
        let matches = true;
        if (devPart) {
            matches = matches && app.developer.toLowerCase().includes(devPart);
        }
        if (catPart) {
            matches = matches && Array.isArray(app.categories) && app.categories.some(cat => cat.toLowerCase().includes(catPart));
        }
        if (namePart) {
            matches = matches && app.title.toLowerCase().includes(namePart);
        }
        return matches;
    });
    renderSearchResults(filteredApps);
});

// Show cancel button when search input is focused
searchInput.addEventListener('focus', function() {
    cancelSearch.style.display = 'block';
});

// Hide cancel button when search input is blurred
searchInput.addEventListener('blur', function() {
    if (this.value === '') {
        cancelSearch.style.display = 'none';
    }
});

// Cancel search
cancelSearch.addEventListener('click', function() {
    searchInput.value = '';
    searchInput.blur();
    this.style.display = 'none';
    setUrlParam('query', '');
    renderSearchResults(apps);
});

// Render featured apps in list view
function renderFeaturedAppsList() {
    featuredAppsList.innerHTML = '';
    
    const featuredApps = apps.filter(app => app.featured);
    
    featuredApps.forEach(app => {
        const appItem = document.createElement('div');
        appItem.className = 'featured-app-item';
        
        appItem.innerHTML = `
            <div class="featured-app-icon">
                ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                '<i class="fas fa-mobile-alt"></i>'}
            </div>
            <div class="featured-app-info">
                <div class="featured-app-title">${app.title}</div>
                <div class="featured-app-developer">${app.developer}</div>
            </div>
            <div class="featured-app-action" data-app-id="${app.id}">
                View Details <span class="arrow">&gt;</span>
            </div>
        `;
        
        featuredAppsList.appendChild(appItem);
        
        // Add click event to the action area
        appItem.querySelector('.featured-app-action').addEventListener('click', function() {
            const appId = this.getAttribute('data-app-id');
            setUrlParam('app', appId);
            document.getElementById(`${appId}Modal`).classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
}

function setUrlParam(key, value) {
    const params = new URLSearchParams(window.location.search);
    if (value && value.length > 0) {
        params.set(key, value);
    } else {
        params.delete(key);
    }
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
}

function getUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
}

function getAllCategories() {
    const categorySet = new Set();
    apps.forEach(app => {
        if (Array.isArray(app.categories)) {
            app.categories.forEach(cat => categorySet.add(cat));
        }
    });
    return Array.from(categorySet).sort();
}

function renderCategoryList() {
    const categoriesContent = tabContents.categories;
    categoriesContent.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'categories-list-container category-fade-in';
    
    const title = document.createElement('h3');
    title.textContent = 'Browse Apps by Category';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    container.appendChild(title);

    const categories = getAllCategories();
    const list = document.createElement('div');
    list.className = 'categories-list';
    list.style.display = 'flex';
    list.style.flexWrap = 'wrap';
    list.style.gap = '12px';
    list.style.justifyContent = 'center';

    categories.forEach(cat => {
        const tag = document.createElement('button');
        tag.className = 'category-tag category-select-btn';
        tag.textContent = cat;
        tag.style.cursor = 'pointer';
        tag.addEventListener('click', () => {
            setUrlParam('category', cat);
            renderAppsForCategory(cat);
        });
        list.appendChild(tag);
    });
    container.appendChild(list);
    categoriesContent.appendChild(container);
}

function renderAppsForCategory(category) {
    const categoriesContent = tabContents.categories;
    categoriesContent.innerHTML = '';
    
    const backBtn = document.createElement('button');
    backBtn.textContent = 'Back to Categories';
    backBtn.className = 'back-to-categories-btn';
    backBtn.style.marginBottom = '20px';
    backBtn.style.display = 'block';
    backBtn.style.marginLeft = 'auto';
    backBtn.style.marginRight = 'auto';
    backBtn.addEventListener('click', () => {
        setUrlParam('category', '');
        renderCategoryList();
    });
    categoriesContent.appendChild(backBtn);

    const title = document.createElement('h3');
    title.textContent = `Apps in "${category}"`;
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    categoriesContent.appendChild(title);

    const filteredApps = apps.filter(app => Array.isArray(app.categories) && app.categories.includes(category));
    if (filteredApps.length === 0) {
        const noApps = document.createElement('p');
        noApps.textContent = 'No apps found in this category.';
        noApps.style.textAlign = 'center';
        categoriesContent.appendChild(noApps);
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'category-apps-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    grid.style.gap = '18px';
    grid.style.justifyItems = 'center';
    filteredApps.forEach(app => {
        const appCard = document.createElement('div');
        appCard.className = 'app-card-grid';
        appCard.innerHTML = `
            <div class="card-icon">
                ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-mobile-alt\'></i>'">` : 
                '<i class="fas fa-mobile-alt"></i>'}
            </div>
            <div class="card-name">${app.title}</div>
            <div class="card-developer">${app.developer}</div>
            <button class="card-button" data-app-id="${app.id}">View Details</button>
        `;
        grid.appendChild(appCard);
    });
    categoriesContent.appendChild(grid);

    categoriesContent.querySelectorAll('.card-button').forEach(button => {
        button.addEventListener('click', function() {
            const appId = this.getAttribute('data-app-id');
            setUrlParam('app', appId);
            document.getElementById(`${appId}Modal`).classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    createModals();
    renderFeaturedAppsList();
    
    // Activate featured tab content
    tabContents.featured.classList.add('active');

    const queryParam = getUrlParam('query');
    if (queryParam) {
        searchInput.value = queryParam;
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === 'search') {
                tab.click();
            }
        });
        let filteredApps;
        if (queryParam.includes('developer:')) {
            const parts = queryParam.split('developer:');
            const namePart = parts[0].trim();
            const devPart = parts[1].trim();
            filteredApps = apps.filter(app => {
                const matchesDev = app.developer.toLowerCase().includes(devPart);
                const matchesName = namePart ? app.title.toLowerCase().includes(namePart) : true;
                return matchesDev && matchesName;
            });
        } else {
            filteredApps = apps.filter(app => 
                app.title.toLowerCase().includes(queryParam) || 
                app.developer.toLowerCase().includes(queryParam)
            );
        }
        renderSearchResults(filteredApps);
    }
    const appParam = getUrlParam('app');
    if (appParam) {
        const modal = document.getElementById(`${appParam}Modal`);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            setUrlParam('app', '');
            setTimeout(() => {
                alert('App ID not found, please try again later.');
            }, 100);
        }
    }
    const categoryParam = getUrlParam('category');
    if (categoryParam) {
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === 'categories') {
                tab.click();
            }
        });
        renderAppsForCategory(categoryParam);
    }
});
