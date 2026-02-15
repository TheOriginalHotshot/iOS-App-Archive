        let apps = [];
        let appsLoaded = false;

        function escapeHtml(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }

        function normalizeDeviceName(device) {
            const d = String(device ?? '').trim().toLowerCase();
            if (!d) return null;
            if (d === 'iphone') return 'iPhone';
            if (d === 'ipad') return 'iPad';
            if (d === 'ipod touch' || d === 'ipodtouch' || d === 'ipod') return 'iPod Touch';
            return null;
        }

        function getAppDevices(app) {
            const raw = app?.devices;
            const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            const normalized = list
                .map(normalizeDeviceName)
                .filter(Boolean);
            return Array.from(new Set(normalized));
        }

        function renderDeviceIcons(app) {
            const devices = getAppDevices(app);
            if (devices.length === 0) return '';

            const hasIPhone = devices.includes('iPhone');
            const hasIPod = devices.includes('iPod Touch');
            const hasIPad = devices.includes('iPad');

            const deviceIconParts = [];

            if (hasIPhone || hasIPod) {
                const label = (hasIPhone && hasIPod) ? 'iPhone & iPod Touch' : (hasIPod ? 'iPod Touch' : 'iPhone');
                deviceIconParts.push({
                    iconClass: 'fa-solid fa-mobile-screen-button',
                    extraClass: 'device-icon-iphone',
                    label
                });
            }

            if (hasIPad) {
                deviceIconParts.push({
                    iconClass: 'fa-solid fa-tablet-screen-button',
                    extraClass: 'device-icon-ipad',
                    label: 'iPad'
                });
            }

            const icons = deviceIconParts.map(({ iconClass, extraClass, label }) => {
                return `<span class="device-icon ${extraClass}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"><i class="${iconClass}" aria-hidden="true"></i></span>`;
            }).join('');

            return `<span class="device-icons" aria-hidden="true">${icons}</span>`;
        }

        function renderAppTitle(app) {
            return `${escapeHtml(app?.title)}`;
        }

        function renderAppTitleWithDevices(app) {
            return `${escapeHtml(app?.title)}${renderDeviceIcons(app)}`;
        }

        async function fetchAppsData() {
            const response = await fetch('apps.json');
            if (!response.ok) {
                throw new Error('Failed to load apps data.');
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Apps data is not in the expected format.');
            }
            return data;
        }

        const appsPromise = fetchAppsData();


        // DOM Elements
        const carouselContainer = document.getElementById('carouselContainer');
        const carousel = document.getElementById('carousel');
        const carouselNav = document.getElementById('carouselNav');
        const searchResults = document.getElementById('searchResults');
        const searchContainer = document.getElementById('searchContainer');
        const searchInput = document.getElementById('searchInput');
        const cancelSearch = document.getElementById('cancelSearch');
        const tabs = document.querySelectorAll('.tab');
        const modalContainer = document.getElementById('modalContainer');
        
        // Tab content areas
        const tabContents = {
            featured: document.getElementById('featuredContent'),
            categories: document.getElementById('categoriesContent'),
            genius: document.getElementById('geniusContent'),
            search: document.getElementById('searchContent'),
            updates: document.getElementById('updatesContent')
        };
        
        // Track viewed apps for Genius recommendations
        let viewedApps = [];
        const MAX_VIEWED_APPS = 20;

        // Load viewed apps from localStorage
        function loadViewedApps() {
            const stored = localStorage.getItem('viewedApps');
            if (stored) {
                try {
                    viewedApps = JSON.parse(stored);
                } catch (e) {
                    viewedApps = [];
                }
            }
        }
        loadViewedApps();

        // Track app views
        function trackAppView(appId) {
            if (!viewedApps.includes(appId)) {
                viewedApps.unshift(appId);
                if (viewedApps.length > MAX_VIEWED_APPS) {
                    viewedApps = viewedApps.slice(0, MAX_VIEWED_APPS);
                }
                localStorage.setItem('viewedApps', JSON.stringify(viewedApps));
            }
        }
        
        const tabContents = {
            featured: document.getElementById('featuredContent'),
            categories: document.getElementById('categoriesContent'),
            genius: document.getElementById('geniusContent'),
            search: document.getElementById('searchContent'),
            updates: document.getElementById('updatesContent')
        };
        
        // Carousel state
        let currentIndex = 0;
        let autoSlideInterval;
        let touchStartX = 0;
        let touchEndX = 0;

        // Get a deterministic set of random apps for the current day
        function getDailyRandomApps(appList, count) {
            const dateStr = new Date().toISOString().slice(0, 10);
            let seed = 0;
            for (let i = 0; i < dateStr.length; i++) {
                seed = (seed << 5) - seed + dateStr.charCodeAt(i);
                seed |= 0;
            }
            function rand() {
                seed |= 0; seed = seed + 0x6D2B79F5 | 0;
                let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
                t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
            const list = [...appList];
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [list[i], list[j]] = [list[j], list[i]];
            }
            return list.slice(0, count);
        }
        
        // Initialize carousel
        function initCarousel() {
            // Clear existing items
            carousel.innerHTML = '';
            carouselNav.innerHTML = '';

            if (!appsLoaded || apps.length === 0) {
                carousel.innerHTML = '<p style="text-align: center; padding: 20px; color: #aaa;">Loading apps...</p>';
                return;
            }

            // Choose 7 random apps for the carousel each day
            const featuredApps = getDailyRandomApps(apps, 7);
            
            // Create carousel items
            featuredApps.forEach((app, index) => {
                const carouselItem = document.createElement('div');
                carouselItem.className = 'carousel-item';
                carouselItem.dataset.index = index;
                
                carouselItem.innerHTML = `
                    <div class="app-card">
                        <div class="app-icon-container">
                            <div class="app-icon">
                                ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                                '<i class="fas fa-mobile-alt"></i>'}
                            </div>
                        </div>
                        <h3 class="app-title">${renderAppTitle(app)}</h3>
                        <div class="app-description">${app.featuredDescription}</div>
                        <button class="card-button" data-app-id="${app.id}">View Details</button>
                    </div>
                `;
                
                carousel.appendChild(carouselItem);
                
                // Create navigation dot
                const navDot = document.createElement('div');
                navDot.className = 'nav-dot';
                navDot.dataset.index = index;
                navDot.addEventListener('click', () => goToSlide(index));
                carouselNav.appendChild(navDot);
            });
            
            // Set initial slide
            updateCarousel();
            
            // Start auto slide
            startAutoSlide();
            
            // Add swipe functionality
            setupSwipe();
            
            // Add event listener to carousel buttons
            document.querySelectorAll('.app-card .card-button').forEach(button => {
                button.addEventListener('click', function() {
                    const appId = this.getAttribute('data-app-id');
                    openModal(appId);
                });
            });
        }
        
        // Update carousel position
        function updateCarousel() {
            const items = document.querySelectorAll('.carousel-item');
            const dots = document.querySelectorAll('.nav-dot');
            const itemCount = items.length;
            
            items.forEach((item, index) => {
                item.classList.remove('active', 'prev', 'next');
                
                if (index === currentIndex) {
                    item.classList.add('active');
                } else if (index === (currentIndex - 1 + itemCount) % itemCount) {
                    item.classList.add('prev');
                } else if (index === (currentIndex + 1) % itemCount) {
                    item.classList.add('next');
                }
            });
            
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
        
        // Go to specific slide
        function goToSlide(index) {
            currentIndex = index;
            updateCarousel();
            resetAutoSlide();
        }
        
        // Next slide
        function nextSlide() {
            const items = document.querySelectorAll('.carousel-item');
            currentIndex = (currentIndex + 1) % items.length;
            updateCarousel();
        }
        
        // Previous slide
        function prevSlide() {
            const items = document.querySelectorAll('.carousel-item');
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            updateCarousel();
        }
        
        // Start auto slide
        function startAutoSlide() {
            autoSlideInterval = setInterval(nextSlide, 8000);
        }
        
        // Reset auto slide timer
        function resetAutoSlide() {
            clearInterval(autoSlideInterval);
            startAutoSlide();
        }
        
        // Setup swipe functionality
        function setupSwipe() {
            carouselContainer.addEventListener('touchstart', e => {
                touchStartX = e.changedTouches[0].screenX;
            }, false);
            
            carouselContainer.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }, false);
            
            function handleSwipe() {
                if (touchEndX < touchStartX - 50) {
                    nextSlide();
                }
                
                if (touchEndX > touchStartX + 50) {
                    prevSlide();
                }
                
                resetAutoSlide();
            }
        }
        
        const APPS_PER_PAGE = 12;

        // Track current search results and page for keyboard navigation
        let currentSearchFilteredApps = apps;
        let currentSearchPage = 1;
        let pageNumberBuffer = '';
        let pageNumberTimer;

        function renderPaginationControls(totalApps, currentPage, onPageChange) {
            const totalPages = Math.max(1, Math.ceil(totalApps / APPS_PER_PAGE));
            if (totalPages < 2) return '';
            let html = '<div class="pagination-controls" style="grid-column: 1/-1; text-align: center; margin: 20px 0;">';
            if (currentPage > 1) {
                html += `<button class="pagination-btn" data-page="${currentPage - 1}">Previous</button> `;
            }
            for (let i = 1; i <= totalPages; i++) {
                if (i === currentPage) {
                    html += `<span class="pagination-page current">${i}</span> `;
                } else {
                    html += `<button class="pagination-btn" data-page="${i}">${i}</button> `;
                }
            }
            if (currentPage < totalPages) {
                html += `<button class="pagination-btn" data-page="${currentPage + 1}">Next</button>`;
            }
            html += '</div>';
            return html;
        }

        function renderSearchResults(filteredApps = [], page = 1) {
            currentSearchFilteredApps = filteredApps;
            currentSearchPage = page;

            const sortedApps = filteredApps.slice().sort((a, b) =>
                a.title.localeCompare(b.title)
            );
            searchResults.innerHTML = '';
            const totalApps = sortedApps.length;
            const totalPages = Math.max(1, Math.ceil(totalApps / APPS_PER_PAGE));
            
            if (page === 1) {
                setUrlParam('page', '');
                page = 1;
            }
            
            if (page < 1) page = 1;
            if (page > totalPages) page = totalPages;
            
            const startIdx = (page - 1) * APPS_PER_PAGE;
            const endIdx = startIdx + APPS_PER_PAGE;
            const appsToShow = sortedApps.slice(startIdx, endIdx);

            if (appsToShow.length === 0) {
                searchResults.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 20px; color: #aaa;">No apps found, Please try a different search term.</p>';
                return;
            }

            appsToShow.forEach(app => {
                const appCard = document.createElement('div');
                appCard.className = 'app-card-grid';
                appCard.innerHTML = `
                    <div class="card-icon">
                        ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                        '<i class="fas fa-mobile-alt"></i>'}
                    </div>
                    <div class="card-name">${renderAppTitle(app)}</div>
                    <div class="card-developer">${app.developer}</div>
                    <button class="card-button" data-app-id="${app.id}">View Details</button>
                `;
                searchResults.appendChild(appCard);
            });

            searchResults.innerHTML += renderPaginationControls(totalApps, page, (newPage) => {
                if (newPage === 1) {
                    setUrlParam('page', '');
                } else {
                    setUrlParam('page', newPage);
                }
                renderSearchResults(filteredApps, newPage);
            });

            document.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const newPage = parseInt(this.getAttribute('data-page'));
                    if (newPage === 1) {
                        setUrlParam('page', '');
                    } else {
                        setUrlParam('page', newPage);
                    }
                    renderSearchResults(filteredApps, newPage);
                });
            });

            // Add event listeners to buttons
            document.querySelectorAll('.card-button').forEach(button => {
                button.addEventListener('click', function() {
                    const appId = this.getAttribute('data-app-id');
                    openModal(appId);
                });
            });
        }

        function navigateSearchPage(newPage) {
            const totalPages = Math.max(1, Math.ceil(currentSearchFilteredApps.length / APPS_PER_PAGE));
            if (newPage < 1) newPage = 1;
            if (newPage > totalPages) newPage = totalPages;
            if (newPage === 1) {
                setUrlParam('page', '');
            } else {
                setUrlParam('page', newPage);
            }
            renderSearchResults(currentSearchFilteredApps, newPage);
        }

        // Create a modal for a single app when needed
        function createModal(app) {
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
                    `<button class="category-tag category-select-btn" data-category="${cat}">${cat}</button>`
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
                                <h2 class="modal-title">${renderAppTitleWithDevices(app)}</h2>
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

            modal.querySelector('.close-modal').addEventListener('click', function() {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
                setUrlParam('app', '');
            });

            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    setUrlParam('app', '');
                }
            });

            // Enable category tag navigation from within the modal
            modal.querySelectorAll('.modal-categories .category-tag').forEach(tag => {
                tag.addEventListener('click', () => {
                    const category = tag.textContent;
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    setUrlParam('app', '');
                    const categoryTab = document.querySelector('.tab[data-tab="categories"]');
                    if (categoryTab) {
                        categoryTab.click();
                    }
                    setUrlParam('category', category);
                    renderAppsForCategory(category);
                });
            });

            return modal;
        }

        // Handle Escape key to close any active modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    setUrlParam('app', '');
                });
            }
        });

        function openModal(appId) {
            // Track app view for Genius recommendations
            trackAppView(appId);
            
            let modal = document.getElementById(`${appId}Modal`);
            let createdNow = false;
            if (!modal) {
                const app = apps.find(a => a.id === appId);
                if (!app) {
                    alert('App ID not found, please try again with a different app ID.');
                    return;
                }
                modal = createModal(app);
                createdNow = true;
            }
            document.body.style.overflow = 'hidden';
            setUrlParam('app', appId);

            if (createdNow) {
                modal.offsetHeight;
                requestAnimationFrame(() => {
                    modal.classList.add('active');
                });
            } else {
                modal.classList.add('active');
            }
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
                    carouselContainer.style.display = 'block';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents.featured.classList.add('active');
                  } else if (tabName === 'search') {
                      carouselContainer.style.display = 'none';
                      searchContainer.style.display = 'block';
                      searchResults.classList.add('active');
                      tabContents.search.classList.add('active');
                      if (!appsLoaded) {
                          searchResults.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 20px; color: #aaa;">Loading apps...</p>';
                          return;
                      }
                      const queryParam = getUrlParam('query');
                      if (queryParam !== null) {
                          searchInput.value = queryParam;
                    }
                    const searchTerm = queryParam !== null ? queryParam : searchInput.value;
                    const filteredApps = filterAppsByQuery(searchTerm);
                    const pageParam = parseInt(getUrlParam('page'));
                    const page = (!isNaN(pageParam) && pageParam >= 1) ? pageParam : 1;
                    if (page === 1) {
                        setUrlParam('page', '');
                    } else {
                        setUrlParam('page', page);
                    }
                    renderSearchResults(filteredApps, page);
                    updateCancelVisibility();
                } else if (tabName === 'categories') {
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents.categories.classList.add('active');
                    const categoryParam = getUrlParam('category');
                    if (categoryParam) {
                        renderAppsForCategory(categoryParam);
                    } else {
                        renderCategoryList();
                    }
                } else if (tabName === 'genius') {
                    // Genius tab
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents[tabName].classList.add('active');
                    renderGeniusPage();
                } else if (tabName === 'updates') {
                    // News/Updates tab
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents[tabName].classList.add('active');
                    renderNewsPage();
                } else {
                    // For other tabs
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents[tabName].classList.add('active');
                }
            });
        });
        
        function filterAppsByQuery(query) {
            const normalizedQuery = (query || '').toLowerCase();
            if (normalizedQuery.trim().length === 0) {
                return apps;
            }

            let devPart = null;
            let catPart = null;
            let namePart = normalizedQuery;

            const devMatch = normalizedQuery.match(/developer:"([^"]+)"/);
            if (devMatch) {
                devPart = devMatch[1].trim();
                namePart = namePart.replace(devMatch[0], '').trim();
            }

            const catMatch = normalizedQuery.match(/category:"([^"]+)"/);
            if (catMatch) {
                catPart = catMatch[1].trim();
                namePart = namePart.replace(catMatch[0], '').trim();
            }

            namePart = namePart.replace(/\s+/g, ' ').trim();

            return apps.filter(app => {
                let matches = true;

                if (devPart) {
                    matches = matches && app.developer.toLowerCase().includes(devPart);
                }

                if (catPart) {
                    const appCategories = Array.isArray(app.categories) ? app.categories : [];
                    matches = matches && appCategories.some(cat => cat.toLowerCase().includes(catPart));
                }

                if (namePart) {
                    matches = matches && app.title.toLowerCase().includes(namePart);
                }

                return matches;
            });
        }

        function updateCancelVisibility() {
            const hasText = searchInput.value.trim().length > 0;
            if (document.activeElement === searchInput || hasText) {
                cancelSearch.classList.add('visible');
            } else {
                cancelSearch.classList.remove('visible');
            }
        }

        // Search functionality
        searchInput.addEventListener('input', function() {
            if (!appsLoaded) {
                return;
            }
            const searchTerm = this.value;
            setUrlParam('query', searchTerm);
            setUrlParam('page', '');
            const filteredApps = filterAppsByQuery(searchTerm);
            renderSearchResults(filteredApps, 1);
            updateCancelVisibility();
        });

        // Show cancel button when search input is focused
        searchInput.addEventListener('focus', updateCancelVisibility);

        // Hide cancel button when search input is blurred
        searchInput.addEventListener('blur', updateCancelVisibility);

        // Cancel search
        cancelSearch.addEventListener('click', function() {
            if (!appsLoaded) {
                return;
            }
            searchInput.value = '';
            searchInput.blur();
            setUrlParam('query', '');
            renderSearchResults(apps);
        });
        
        // Initialize
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                apps = await appsPromise;
                appsLoaded = true;
            } catch (error) {
                console.error('Error loading apps data:', error);
                searchResults.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 20px; color: #aaa;">Failed to load apps. Please try again later.</p>';
                carousel.innerHTML = '<p style="text-align: center; padding: 20px; color: #aaa;">Failed to load apps. Please try again later.</p>';
                carouselNav.innerHTML = '';
                tabContents.featured.classList.add('active');
                return;
            }

            initCarousel();

            // Add keyboard navigation
            document.addEventListener('keydown', function(e) {
                const searchTabActive = document.querySelector('.tab[data-tab="search"]').classList.contains('active');
                if (searchTabActive && document.activeElement !== searchInput) {
                    if (e.key === 'ArrowRight') {
                        pageNumberBuffer = '';
                        clearTimeout(pageNumberTimer);
                        navigateSearchPage(currentSearchPage + 1);
                    } else if (e.key === 'ArrowLeft') {
                        pageNumberBuffer = '';
                        clearTimeout(pageNumberTimer);
                        navigateSearchPage(currentSearchPage - 1);
                    } else if (/^[0-9]$/.test(e.key)) {
                        pageNumberBuffer += e.key;
                        clearTimeout(pageNumberTimer);
                        pageNumberTimer = setTimeout(() => {
                            const page = parseInt(pageNumberBuffer, 10);
                            if (!isNaN(page)) {
                                navigateSearchPage(page);
                            }
                            pageNumberBuffer = '';
                        }, 500);
                    }
                } else {
                    if (e.key === 'ArrowRight') {
                        nextSlide();
                    } else if (e.key === 'ArrowLeft') {
                        prevSlide();
                    }
                }
            });
            
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
                const filteredApps = filterAppsByQuery(queryParam);
                renderSearchResults(filteredApps, 1);
            }
            const appParam = getUrlParam('app');
            if (appParam) {
                openModal(appParam);
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
            if (!appsLoaded || apps.length === 0) {
                const loadingMsg = document.createElement('p');
                loadingMsg.textContent = 'Loading categories...';
                loadingMsg.style.textAlign = 'center';
                loadingMsg.style.padding = '20px';
                loadingMsg.style.color = '#aaa';
                categoriesContent.appendChild(loadingMsg);
                return;
            }
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
            backBtn.className = 'back-to-categories-btn';
            backBtn.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back to Categories</span>';
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
            const sortedApps = filteredApps.slice().sort((a, b) => a.title.localeCompare(b.title));

            if (sortedApps.length === 0) {
                const noApps = document.createElement('p');
                noApps.textContent = 'No apps found in this category.';
                noApps.style.textAlign = 'center';
                categoriesContent.appendChild(noApps);
                return;
            }
            const grid = document.createElement('div');
            grid.className = 'category-apps-grid search-results active category-fade-in';
            sortedApps.forEach(app => {
                const appCard = document.createElement('div');
                appCard.className = 'app-card-grid';
                appCard.innerHTML = `
                    <div class="card-icon">
                        ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-mobile-alt\'></i>'">` : 
                        '<i class="fas fa-mobile-alt"></i>'}
                    </div>
                    <div class="card-name">${renderAppTitle(app)}</div>
                    <div class="card-developer">${app.developer}</div>
                    <button class="card-button" data-app-id="${app.id}">View Details</button>
                `;
                grid.appendChild(appCard);
            });
            categoriesContent.appendChild(grid);

            categoriesContent.querySelectorAll('.card-button').forEach(button => {
                button.addEventListener('click', function() {
                    const appId = this.getAttribute('data-app-id');
                    openModal(appId);
                });
            });
        }

        // Loading Screen Handler
        window.addEventListener('load', function() {
            const loadingScreen = document.getElementById('loadingScreen');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 3000);
        });

        // Genius Recommendations Algorithm
        function getGeniusRecommendations() {
            if (!appsLoaded || apps.length === 0) return [];
            
            // If user hasn't viewed any apps, show random popular apps
            if (viewedApps.length === 0) {
                return getDailyRandomApps(apps, 12);
            }
            
            // Get categories and developers from viewed apps
            const viewedAppObjects = viewedApps
                .map(id => apps.find(app => app.id === id))
                .filter(Boolean);
            
            const categories = new Set();
            const developers = new Set();
            
            viewedAppObjects.forEach(app => {
                if (Array.isArray(app.categories)) {
                    app.categories.forEach(cat => categories.add(cat));
                }
                if (app.developer) {
                    developers.add(app.developer);
                }
            });
            
            // Score all apps based on similarity
            const scoredApps = apps
                .filter(app => !viewedApps.includes(app.id))
                .map(app => {
                    let score = 0;
                    
                    // Category match (highest weight)
                    if (Array.isArray(app.categories)) {
                        const matchingCategories = app.categories.filter(cat => categories.has(cat)).length;
                        score += matchingCategories * 10;
                    }
                    
                    // Developer match (medium weight)
                    if (developers.has(app.developer)) {
                        score += 5;
                    }
                    
                    // Add small random factor for variety
                    score += Math.random() * 2;
                    
                    return { app, score };
                });
            
            // Sort by score and return top recommendations
            scoredApps.sort((a, b) => b.score - a.score);
            return scoredApps.slice(0, 12).map(item => item.app);
        }

        // Render Genius Page
        function renderGeniusPage() {
            const geniusContent = document.getElementById('geniusContent');
            geniusContent.innerHTML = '';
            
            const container = document.createElement('div');
            container.className = 'genius-page-container';
            
            const header = document.createElement('div');
            header.className = 'genius-header';
            header.innerHTML = `
                <h2><i class="fas fa-lightbulb"></i> Recommended Apps</h2>
                <p>${viewedApps.length > 0 ? 'Based on apps you\'ve viewed' : 'Curated selections for you'}</p>
            `;
            container.appendChild(header);
            
            const recommendations = getGeniusRecommendations();
            
            if (recommendations.length === 0) {
                const noRecs = document.createElement('p');
                noRecs.textContent = 'No recommendations available yet. Browse some apps to get personalized suggestions!';
                noRecs.style.textAlign = 'center';
                noRecs.style.color = '#aaa';
                container.appendChild(noRecs);
            } else {
                const grid = document.createElement('div');
                grid.className = 'genius-apps-grid';
                
                recommendations.forEach(app => {
                    const appCard = document.createElement('div');
                    appCard.className = 'app-card-grid';
                    appCard.style.animation = 'fadeInUp 0.5s ease forwards';
                    appCard.innerHTML = `
                        <div class="card-icon">
                            ${app.icon ? `<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-mobile-alt\'></i>'">` : 
                            '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="card-name">${renderAppTitle(app)}</div>
                        <div class="card-developer">${escapeHtml(app.developer || 'Unknown')}</div>
                        <button class="card-button" data-app-id="${app.id}">View Details</button>
                    `;
                    grid.appendChild(appCard);
                });
                
                container.appendChild(grid);
                
                // Add event listeners to buttons
                container.querySelectorAll('.card-button').forEach(button => {
                    button.addEventListener('click', function() {
                        const appId = this.getAttribute('data-app-id');
                        trackAppView(appId);
                        openModal(appId);
                    });
                });
            }
            
            geniusContent.appendChild(container);
        }

        // News/Changelog Page
        function renderNewsPage() {
            const updatesContent = document.getElementById('updatesContent');
            updatesContent.innerHTML = '';
            
            const container = document.createElement('div');
            container.className = 'news-page-container';
            
            const header = document.createElement('div');
            header.className = 'news-header';
            header.innerHTML = `
                <h2><i class="fas fa-newspaper"></i> What's New</h2>
            `;
            container.appendChild(header);
            
            // Create news card
            const newsCard = document.createElement('div');
            newsCard.className = 'news-card';
            newsCard.innerHTML = `
                <div class="news-card-header">
                    <div class="news-icon">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="news-card-title">
                        <h3>iOS App Archive Update</h3>
                        <div class="news-card-date">February 15, 2026</div>
                    </div>
                </div>
                <div class="news-card-preview">
                    We've added exciting new features to enhance your browsing experience! Click to view the full changelog.
                </div>
                <span class="news-badge">NEW FEATURES</span>
            `;
            
            newsCard.addEventListener('click', showNewsModal);
            container.appendChild(newsCard);
            updatesContent.appendChild(container);
        }

        // Show News Modal
        function showNewsModal() {
            const modal = document.createElement('div');
            modal.className = 'news-modal';
            modal.innerHTML = `
                <div class="news-modal-content">
                    <button class="news-close-btn" onclick="this.closest('.news-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="news-modal-header">
                        <div class="news-modal-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="news-modal-title-section">
                            <h2>iOS App Archive Update</h2>
                            <div class="news-modal-date">February 15, 2026</div>
                        </div>
                    </div>
                    <div class="news-modal-body">
                        <h3>🎉 Major Feature Updates</h3>
                        
                        <p>We're excited to announce a comprehensive update to iOS App Archive with several new features designed to enhance your experience:</p>
                        
                        <h3>✨ New Features</h3>
                        <ul>
                            <li><strong>Genius Recommendations</strong> - The new Genius tab provides personalized app recommendations based on what you've been viewing. The more apps you explore, the smarter the recommendations become!</li>
                            <li><strong>Enhanced Loading Experience</strong> - A beautiful loading animation now welcomes you when you first visit the site, featuring a smooth download icon animation that transitions seamlessly into the main interface.</li>
                            <li><strong>News Tab</strong> - Stay up-to-date with the latest changes and updates to the archive. The Updates tab has been redesigned as "News" to bring you important announcements and changelogs.</li>
                        </ul>
                        
                        <h3>🎨 Design Improvements</h3>
                        <ul>
                            <li><strong>Smoother Animations</strong> - All page transitions and animations have been refined for a more fluid, polished experience. Carousel slides, tab switches, and button interactions now feel even more responsive.</li>
                            <li><strong>Enhanced Glossy Effects</strong> - Buttons and UI elements now feature more pronounced glossy, liquid-like effects with improved lighting and shadows that give the interface a premium feel.</li>
                            <li><strong>Better Visual Feedback</strong> - Interactive elements now provide clearer visual feedback with enhanced hover effects, smooth scaling animations, and elegant glow effects.</li>
                        </ul>
                        
                        <h3>🔧 Technical Enhancements</h3>
                        <ul>
                            <li>Optimized carousel transitions using improved cubic-bezier curves for smoother motion</li>
                            <li>Enhanced tab navigation with better visual indicators and hover states</li>
                            <li>Improved button styling with layered gradient effects and ripple animations</li>
                            <li>Smart recommendation algorithm that learns from your browsing history</li>
                            <li>LocalStorage integration for persistent app view tracking</li>
                        </ul>
                        
                        <h3>📱 User Experience</h3>
                        <ul>
                            <li>The Genius page automatically adapts based on your viewing history</li>
                            <li>All recommendations use the same beautiful card style as the Featured tab</li>
                            <li>Smooth fade-in animations for newly loaded content</li>
                            <li>Responsive design improvements for mobile and tablet devices</li>
                        </ul>
                        
                        <p>Thank you for using iOS App Archive! We hope these updates make your experience even better. If you have any feedback or suggestions, please let us know.</p>
                    </div>
                </div>
            `;
            
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            document.body.appendChild(modal);
        }

        // Initialize on page load
        appsPromise.then(data => {
            apps = data;
            appsLoaded = true;
            initCarousel();
            renderGeniusPage(); // Pre-render Genius page
            renderNewsPage(); // Pre-render News page
        }).catch(error => {
            console.error('Error loading apps:', error);
        });

        // Add fadeInUp animation to CSS dynamically
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
