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
        
        // Track current search results for reference
        let currentSearchFilteredApps = apps;

        function renderSearchResults(filteredApps = []) {
            currentSearchFilteredApps = filteredApps;

            const sortedApps = filteredApps.slice().sort((a, b) =>
                a.title.localeCompare(b.title)
            );
            searchResults.innerHTML = '';
            const totalApps = sortedApps.length;
            
            if (totalApps === 0) {
                searchResults.innerHTML = '<p style="text-align: center; padding: 60px 20px; color: #999;">No apps found, Please try a different search term.</p>';
                return;
            }

            // Create horizontal scroller
            const scrollerDiv = document.createElement('div');
            scrollerDiv.className = 'search-results-scroller';
            scrollerDiv.id = 'searchScroller';

            sortedApps.forEach((app, index) => {
                const appCard = document.createElement('div');
                appCard.className = 'app-card-large';
                appCard.setAttribute('data-index', index);
                appCard.innerHTML = `
                    <div class="card-header">
                        <div class="large-card-icon">
                            ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                            '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="card-info">
                            <div class="large-card-name">${renderAppTitle(app)}</div>
                            <div class="large-card-developer">${escapeHtml(app.developer)}</div>
                        </div>
                        <button class="large-card-button" data-app-id="${app.id}">Get</button>
                    </div>
                `;
                scrollerDiv.appendChild(appCard);
            });

            searchResults.appendChild(scrollerDiv);

            // Add result counter
            const counterDiv = document.createElement('div');
            counterDiv.className = 'search-results-counter';
            counterDiv.id = 'searchCounter';
            counterDiv.textContent = `1 of ${totalApps} ${totalApps === 1 ? 'app' : 'apps'}`;
            searchResults.appendChild(counterDiv);

            // Add scroll event listener to update counter
            const scroller = document.getElementById('searchScroller');
            const counter = document.getElementById('searchCounter');
            
            // Ensure counter starts at 1 by immediately checking position
            setTimeout(() => {
                const cards = scroller.querySelectorAll('.app-card-large');
                if (cards.length > 0) {
                    let closestIndex = 0;
                    let closestDistance = Infinity;
                    
                    cards.forEach((card, index) => {
                        const cardRect = card.getBoundingClientRect();
                        const scrollerRect = scroller.getBoundingClientRect();
                        const cardCenter = cardRect.left + cardRect.width / 2;
                        const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
                        const distance = Math.abs(cardCenter - scrollerCenter);
                        
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestIndex = index;
                        }
                    });
                    
                    counter.textContent = `${closestIndex + 1} of ${totalApps} ${totalApps === 1 ? 'app' : 'apps'}`;
                }
            }, 100);
            
            let isScrolling;
            scroller.addEventListener('scroll', function() {
                // Clear the timeout throughout the scroll
                window.clearTimeout(isScrolling);
                
                // Set a timeout to run after scrolling ends
                isScrolling = setTimeout(function() {
                    const scrollLeft = scroller.scrollLeft;
                    const scrollerWidth = scroller.offsetWidth;
                    const cards = scroller.querySelectorAll('.app-card-large');
                    
                    // Find which card is closest to center
                    let closestIndex = 0;
                    let closestDistance = Infinity;
                    
                    cards.forEach((card, index) => {
                        const cardRect = card.getBoundingClientRect();
                        const scrollerRect = scroller.getBoundingClientRect();
                        const cardCenter = cardRect.left + cardRect.width / 2;
                        const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
                        const distance = Math.abs(cardCenter - scrollerCenter);
                        
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestIndex = index;
                        }
                    });
                    
                    counter.textContent = `${closestIndex + 1} of ${totalApps} ${totalApps === 1 ? 'app' : 'apps'}`;
                }, 50);
            });

            // Add event listeners to buttons
            document.querySelectorAll('.large-card-button').forEach(button => {
                button.addEventListener('click', function() {
                    const appId = this.getAttribute('data-app-id');
                    openModal(appId);
                });
            });
        }

        // Create a modal for a single app when needed
        function createModal(app) {
            // Find related apps (same developer or same categories)
            const relatedApps = apps.filter(a => {
                if (a.id === app.id) return false;
                if (a.developer === app.developer) return true;
                return a.categories.some(cat => app.categories.includes(cat));
            }).slice(0, 8);

            // Create version list items for version sheet
            let versionItems = '';
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
                `<span class="modal-category-tag">${cat}</span>`
            ).join('');
            
            // Create related apps HTML
            const relatedAppsHTML = relatedApps.map(relApp => `
                <div class="related-app-item">
                    <div class="related-app-icon">
                        ${relApp.icon ? `<img src="${relApp.icon}" alt="${relApp.title}" loading="lazy">` : 
                        '<i class="fas fa-mobile-alt"></i>'}
                    </div>
                    <div class="related-app-info" data-app-id="${relApp.id}">
                        <div class="related-app-name">${escapeHtml(relApp.title)}</div>
                        <div class="related-app-developer">${escapeHtml(relApp.developer)}</div>
                    </div>
                    <button class="related-app-get-btn" data-app-id="${relApp.id}">Get</button>
                </div>
            `).join('');
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = `${app.id}Modal`;
            
            modal.innerHTML = `
                <div class="modal-sub-header">
                    <button class="modal-close-btn">Close</button>
                    <div class="modal-sub-header-title">Info</div>
                    <div style="width: 70px;"></div>
                </div>
                <div class="modal-content">
                    <div class="modal-app-header">
                        <div class="modal-app-icon">
                            ${app.icon ? `<img src="${app.icon}" alt="${app.title}" loading="lazy">` : 
                            '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="modal-app-info">
                            <div class="modal-app-title">${escapeHtml(app.title)}</div>
                            <div class="modal-app-developer">${escapeHtml(app.developer)}</div>
                        </div>
                        <button class="modal-get-btn">Get</button>
                    </div>
                    
                    <div class="modal-categories">
                        ${categoryTags}
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" data-tab="details">App Details</button>
                        <button class="modal-tab-btn" data-tab="related">Related Apps</button>
                    </div>
                    
                    <div class="modal-tab-content active" id="details-content">
                        <div class="modal-section">
                            <h3><i class="fas fa-mobile-alt"></i> Compatibility</h3>
                            <p class="compatibility-text">${app.compatibility}</p>
                        </div>
                        
                        <div class="modal-section">
                            <h3><i class="fas fa-align-left"></i> App Store Description</h3>
                            ${app.description.split('\n').map(p => `<p>${p}</p>`).join('')}
                        </div>
                    </div>
                    
                    <div class="modal-tab-content" id="related-content">
                        <div class="related-apps-list">
                            ${relatedAppsHTML || '<p style="text-align: center; color: #999; padding: 20px;">No related apps found.</p>'}
                        </div>
                    </div>
                </div>
                
                <!-- Version History Sheet -->
                <div class="version-sheet-overlay">
                    <div class="version-sheet">
                        <h3 class="version-sheet-title">Version History</h3>
                        <div class="versions-container">
                            ${versionItems}
                        </div>
                        <button class="version-sheet-cancel">Cancel</button>
                    </div>
                </div>
            `;
            
            modalContainer.appendChild(modal);
            
            // Close button event
            modal.querySelector('.modal-close-btn').addEventListener('click', function() {
                modal.classList.remove('active');
                document.body.style.overflow = 'auto';
                setUrlParam('app', '');
            });
            
            // Tab switching
            modal.querySelectorAll('.modal-tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    modal.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
                    modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
                    
                    this.classList.add('active');
                    const tab = this.getAttribute('data-tab');
                    modal.querySelector(`#${tab}-content`).classList.add('active');
                });
            });
            
            // Get button - opens version sheet
            modal.querySelector('.modal-get-btn').addEventListener('click', function() {
                modal.querySelector('.version-sheet-overlay').classList.add('active');
            });
            
            // Version sheet cancel
            modal.querySelector('.version-sheet-cancel').addEventListener('click', function() {
                modal.querySelector('.version-sheet-overlay').classList.remove('active');
            });
            
            // Close version sheet on overlay click
            modal.querySelector('.version-sheet-overlay').addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
            
            // Related app clicks - handle info area and Get button separately
            modal.querySelectorAll('.related-app-info').forEach(info => {
                info.addEventListener('click', function() {
                    const appId = this.getAttribute('data-app-id');
                    modal.classList.remove('active');
                    setTimeout(() => openModal(appId), 300);
                });
            });
            
            modal.querySelectorAll('.related-app-get-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const appId = this.getAttribute('data-app-id');
                    modal.classList.remove('active');
                    setTimeout(() => openModal(appId), 300);
                });
            });
            
            // Close modal on overlay click
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = 'auto';
                    setUrlParam('app', '');
                }
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
                document.querySelectorAll('.version-sheet-overlay.active').forEach(sheet => {
                    sheet.classList.remove('active');
                });
            }
        });

        function openModal(appId) {
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
                      tabContents.search.classList.add('active');
                      
                      const emptyState = document.getElementById('searchEmptyState');
                      
                      if (!appsLoaded) {
                          searchResults.classList.remove('active');
                          if (emptyState) emptyState.style.display = 'flex';
                          return;
                      }
                      const queryParam = getUrlParam('query');
                      if (queryParam !== null) {
                          searchInput.value = queryParam;
                    }
                    const searchTerm = queryParam !== null ? queryParam : searchInput.value;
                    
                    // If there's a search term, show search results
                    if (searchTerm && searchTerm.trim().length > 0) {
                        searchResults.classList.add('active');
                        if (emptyState) emptyState.style.display = 'none';
                        const filteredApps = filterAppsByQuery(searchTerm);
                        renderSearchResults(filteredApps, 1);
                        updateCancelVisibility();
                    } else {
                        // No search term, show empty state
                        searchResults.classList.remove('active');
                        if (emptyState) emptyState.style.display = 'flex';
                    }
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
                } else {
                    // For categories, genius, updates
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
                searchInput.classList.add('has-text');
            } else {
                cancelSearch.classList.remove('visible');
                searchInput.classList.remove('has-text');
            }
        }

        // Search functionality
        searchInput.addEventListener('input', function() {
            if (!appsLoaded) {
                return;
            }
            const searchTerm = this.value;
            setUrlParam('query', searchTerm);
            
            const emptyState = document.getElementById('searchEmptyState');
            
            // If search is empty, show empty state, otherwise show search results
            if (searchTerm.trim().length === 0) {
                searchResults.classList.remove('active');
                if (emptyState) emptyState.style.display = 'flex';
            } else {
                searchResults.classList.add('active');
                if (emptyState) emptyState.style.display = 'none';
                const filteredApps = filterAppsByQuery(searchTerm);
                renderSearchResults(filteredApps, 1);
            }
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
            searchResults.classList.remove('active');
            
            const emptyState = document.getElementById('searchEmptyState');
            if (emptyState) emptyState.style.display = 'flex';
            
            updateCancelVisibility();
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
                if (!searchTabActive && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
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

// ==================== ENHANCED FEATURES ====================

// Loading Screen Handler
window.addEventListener('load', function() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 3000);
    }
});

// Track viewed apps for Genius recommendations
let viewedApps = [];
const MAX_VIEWED_APPS = 20;

// Load viewed apps from localStorage
function loadViewedApps() {
    try {
        const stored = localStorage.getItem('viewedApps');
        if (stored) {
            viewedApps = JSON.parse(stored);
        }
    } catch (e) {
        viewedApps = [];
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
        try {
            localStorage.setItem('viewedApps', JSON.stringify(viewedApps));
        } catch (e) {
            console.error('Failed to save viewed apps:', e);
        }
    }
}

// Wrap the original openModal to add tracking
(function() {
    const originalOpenModal = window.openModal || openModal;
    window.openModal = function(appId) {
        trackAppView(appId);
        return originalOpenModal.apply(this, arguments);
    };
})();

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
    if (!geniusContent) return;
    
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
        noRecs.style.padding = '40px 20px';
        container.appendChild(noRecs);
    } else {
        const grid = document.createElement('div');
        grid.className = 'genius-apps-grid';
        
        recommendations.forEach((app, index) => {
            const appCard = document.createElement('div');
            appCard.className = 'app-card-grid';
            appCard.style.animation = `fadeInUp 0.5s ease ${index * 0.05}s both`;
            appCard.innerHTML = `
                <div class="card-icon">
                    ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
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
                openModal(appId);
            });
        });
    }
    
    geniusContent.appendChild(container);
}

// Render News Page
function renderNewsPage() {
    const updatesContent = document.getElementById('updatesContent');
    if (!updatesContent) return;
    
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
            <button class="news-close-btn">
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
                <h3>🎉 New Features</h3>
                
                <p>We're excited to announce a major update to iOS App Archive with several new features:</p>
                
                <ul>
                    <li><strong>Genius Recommendations</strong> - The Genius tab now provides personalized app recommendations based on what you've been viewing. The more apps you explore, the smarter the recommendations become!</li>
                    <li><strong>Enhanced Loading Experience</strong> - A beautiful loading animation now welcomes you when you first visit the site.</li>
                    <li><strong>News Tab</strong> - Stay up-to-date with the latest changes and updates to the archive through this new News section.</li>
                </ul>
                
                <h3>🎨 Design Improvements</h3>
                <ul>
                    <li><strong>Smoother Animations</strong> - All page transitions and animations have been refined for a more fluid experience.</li>
                    <li><strong>Enhanced Glossy Effects</strong> - Buttons and UI elements now feature more pronounced glossy effects with improved lighting and shadows.</li>
                    <li><strong>Better Visual Feedback</strong> - Interactive elements provide clearer visual feedback with enhanced hover effects and smooth animations.</li>
                </ul>
                
                <h3>🔧 How It Works</h3>
                <ul>
                    <li>The Genius page tracks your viewing history using your browser's local storage</li>
                    <li>Recommendations are based on app categories and developers you've shown interest in</li>
                    <li>Your data is stored locally and never sent to any server</li>
                    <li>The more you browse, the better the recommendations get!</li>
                </ul>
                
                <p>Thank you for using iOS App Archive! We hope these updates enhance your experience.</p>
            </div>
        </div>
    `;
    
    // Close button handler
    const closeBtn = modal.querySelector('.news-close-btn');
    closeBtn.addEventListener('click', () => modal.remove());
    
    // Click outside to close
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// Enhanced tab switching to handle Genius and News tabs
(function() {
    const allTabs = document.querySelectorAll('.tab');
    
    allTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Render content for special tabs
            if (tabName === 'genius' && appsLoaded) {
                renderGeniusPage();
            } else if (tabName === 'updates') {
                renderNewsPage();
            }
        });
    });
})();

// Initialize pages when apps are loaded
appsPromise.then(data => {
    // Pages will be rendered when tabs are clicked
    // Pre-render if needed
    if (appsLoaded) {
        renderGeniusPage();
        renderNewsPage();
    }
}).catch(error => {
    console.error('Error in enhanced features:', error);
});

// ==================== NEW UPDATE - SEARCH CATEGORIES & ENHANCEMENTS ====================

// Category icon mapping
const categoryIcons = {
    'Games': { icon: 'fa-gamepad', class: 'games' },
    'Entertainment': { icon: 'fa-film', class: 'entertainment' },
    'Food & Drink': { icon: 'fa-utensils', class: 'food' },
    'News': { icon: 'fa-newspaper', class: 'news' },
    'Utilities': { icon: 'fa-wrench', class: 'utilities' },
    'Social Networking': { icon: 'fa-users', class: 'social' },
    'Productivity': { icon: 'fa-briefcase', class: 'productivity' },
    'Education': { icon: 'fa-graduation-cap', class: 'education' },
    'Music': { icon: 'fa-music', class: 'entertainment' },
    'Photo & Video': { icon: 'fa-camera', class: 'entertainment' },
    'Shopping': { icon: 'fa-shopping-cart', class: 'utilities' },
    'Travel': { icon: 'fa-plane', class: 'entertainment' },
    'Sports': { icon: 'fa-football-ball', class: 'games' },
    'Health & Fitness': { icon: 'fa-heartbeat', class: 'utilities' },
    'Finance': { icon: 'fa-dollar-sign', class: 'utilities' },
    'Books': { icon: 'fa-book', class: 'education' },
    'Reference': { icon: 'fa-book-open', class: 'education' },
    'Business': { icon: 'fa-chart-line', class: 'productivity' },
    'Weather': { icon: 'fa-cloud-sun', class: 'utilities' },
    'Lifestyle': { icon: 'fa-spa', class: 'entertainment' }
};

// Get recently added apps (last 20)
function getRecentlyAddedApps() {
    if (!appsLoaded || apps.length === 0) return [];
    // Just return the first 20 apps as "recently added"
    return apps.slice(0, 20);
}

// Get apps by category
function getAppsByCategory(categoryName) {
    if (!appsLoaded || apps.length === 0) return [];
    return apps.filter(app => 
        Array.isArray(app.categories) && app.categories.includes(categoryName)
    );
}

// Render category icon
function renderCategoryIcon(categoryName) {
    const iconData = categoryIcons[categoryName] || { icon: 'fa-th-large', class: '' };
    return `<div class="category-icon ${iconData.class}"><i class="fas ${iconData.icon}"></i></div>`;
}

// State for search page
let currentSearchView = 'categories'; // 'categories' or 'detail'
let currentDetailCategory = null;

// Render Search Page with Categories
function renderSearchCategoriesPage() {
    const searchContent = document.getElementById('searchContent');
    if (!searchContent || !appsLoaded) return;
    
    searchContent.innerHTML = '';
    currentSearchView = 'categories';
    
    const container = document.createElement('div');
    container.className = 'search-categories-container';
    
    // Define category sections in order
    const categorySections = [
        { title: 'Recently Added', apps: getRecentlyAddedApps(), category: null },
        { title: 'Games', apps: getAppsByCategory('Games'), category: 'Games' },
        { title: 'Entertainment', apps: getAppsByCategory('Entertainment'), category: 'Entertainment' },
        { title: 'Food & Drink', apps: getAppsByCategory('Food & Drink'), category: 'Food & Drink' },
        { title: 'News', apps: getAppsByCategory('News'), category: 'News' }
    ];
    
    categorySections.forEach(section => {
        if (section.apps.length === 0) return;
        
        const rowDiv = document.createElement('div');
        rowDiv.className = 'category-row';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'category-row-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'category-row-title';
        titleDiv.textContent = section.title;
        
        const seeAllBtn = document.createElement('button');
        seeAllBtn.className = 'see-all-btn';
        seeAllBtn.innerHTML = '<i class="fas fa-arrow-right"></i> See All';
        seeAllBtn.addEventListener('click', () => {
            if (section.category) {
                renderCategoryDetailPage(section.category, section.title);
            } else {
                renderCategoryDetailPage('Recently Added', section.title, section.apps);
            }
        });
        
        headerDiv.appendChild(titleDiv);
        headerDiv.appendChild(seeAllBtn);
        rowDiv.appendChild(headerDiv);
        
        const appsDiv = document.createElement('div');
        appsDiv.className = 'category-row-apps';
        
        // Show first 8 apps in the row
        const displayApps = section.apps.slice(0, 8);
        displayApps.forEach((app, index) => {
            const appCard = document.createElement('div');
            appCard.className = 'app-card-grid';
            appCard.style.animation = `fadeInUp 0.5s ease ${index * 0.05}s both`;
            appCard.innerHTML = `
                <div class="card-icon">
                    ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                    '<i class="fas fa-mobile-alt"></i>'}
                </div>
                <div class="card-name">${renderAppTitle(app)}</div>
                <div class="card-developer">${escapeHtml(app.developer || 'Unknown')}</div>
                <button class="card-button" data-app-id="${app.id}">View Details</button>
            `;
            appsDiv.appendChild(appCard);
        });
        
        rowDiv.appendChild(appsDiv);
        container.appendChild(rowDiv);
        
        // Add event listeners to buttons
        appsDiv.querySelectorAll('.card-button').forEach(button => {
            button.addEventListener('click', function() {
                const appId = this.getAttribute('data-app-id');
                openModal(appId);
            });
        });
    });
    
    searchContent.appendChild(container);
}

// Render Category Detail Page
function renderCategoryDetailPage(categoryName, displayTitle, preFilteredApps = null) {
    const searchContent = document.getElementById('searchContent');
    if (!searchContent) return;
    
    searchContent.innerHTML = '';
    currentSearchView = 'detail';
    currentDetailCategory = categoryName;
    
    const container = document.createElement('div');
    container.className = 'category-detail-container';
    
    const header = document.createElement('div');
    header.className = 'category-detail-header';
    
    const backBtn = document.createElement('button');
    backBtn.className = 'back-to-search-btn';
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back';
    backBtn.addEventListener('click', () => {
        renderSearchCategoriesPage();
    });
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'category-detail-title';
    titleDiv.textContent = displayTitle;
    
    header.appendChild(backBtn);
    header.appendChild(titleDiv);
    container.appendChild(header);
    
    const grid = document.createElement('div');
    grid.className = 'category-detail-grid';
    
    const categoryApps = preFilteredApps || getAppsByCategory(categoryName);
    
    categoryApps.forEach((app, index) => {
        const appCard = document.createElement('div');
        appCard.className = 'app-card-grid';
        appCard.style.animation = `fadeInUp 0.5s ease ${index * 0.02}s both`;
        appCard.innerHTML = `
            <div class="card-icon">
                ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : 
                '<i class="fas fa-mobile-alt"></i>'}
            </div>
            <div class="card-name">${renderAppTitle(app)}</div>
            <div class="card-developer">${escapeHtml(app.developer || 'Unknown')}</div>
            <button class="card-button" data-app-id="${app.id}">View Details</button>
        `;
        grid.appendChild(appCard);
    });
    
    container.appendChild(grid);
    searchContent.appendChild(container);
    
    // Add event listeners to buttons
    grid.querySelectorAll('.card-button').forEach(button => {
        button.addEventListener('click', function() {
            const appId = this.getAttribute('data-app-id');
            openModal(appId);
        });
    });
}

// Update existing renderCategoryList to add icons
const originalRenderCategoryList = window.renderCategoryList;
if (typeof renderCategoryList === 'function') {
    window.renderCategoryList = function() {
        originalRenderCategoryList.call(this);
        
        // Add icons to category buttons
        setTimeout(() => {
            const categoryButtons = document.querySelectorAll('.category-select-btn');
            categoryButtons.forEach(button => {
                const categoryName = button.getAttribute('data-category');
                if (categoryName && categoryIcons[categoryName]) {
                    const icon = renderCategoryIcon(categoryName);
                    if (!button.querySelector('.category-icon')) {
                        button.insertAdjacentHTML('afterbegin', icon);
                    }
                }
            });
        }, 100);
    };
}

// Update Genius page header to use atom icon
const originalRenderGeniusPage = window.renderGeniusPage || renderGeniusPage;
if (typeof renderGeniusPage === 'function') {
    window.renderGeniusPage = function() {
        originalRenderGeniusPage.call(this);
        
        // Replace lightbulb with atom
        setTimeout(() => {
            const geniusHeader = document.querySelector('.genius-header h2');
            if (geniusHeader) {
                geniusHeader.innerHTML = '<i class="fas fa-atom"></i> Recommended Apps';
            }
        }, 50);
    };
}

// Add new changelog to News
const originalShowNewsModal = window.showNewsModal || showNewsModal;
if (typeof showNewsModal === 'function') {
    window.showNewsModal = function() {
        const modal = document.createElement('div');
        modal.className = 'news-modal';
        modal.innerHTML = `
            <div class="news-modal-content">
                <button class="news-close-btn">
                    <i class="fas fa-times"></i>
                </button>
                <div class="news-modal-header">
                    <div class="news-modal-icon">
                        <i class="fas fa-rocket"></i>
                    </div>
                    <div class="news-modal-title-section">
                        <h2>iOS App Archive Update v2.0</h2>
                        <div class="news-modal-date">February 15, 2026</div>
                    </div>
                </div>
                <div class="news-modal-body">
                    <h3>🚀 Major Feature Update</h3>
                    
                    <p>We're thrilled to announce version 2.0 of iOS App Archive with significant improvements and new features!</p>
                    
                    <h3>✨ New Features</h3>
                    <ul>
                        <li><strong>Enhanced Search Experience</strong> - The Search tab now features curated category rows including Recently Added, Games, Entertainment, Food & Drink, and News. Browse apps by category with easy horizontal scrolling!</li>
                        <li><strong>Category Detail Views</strong> - Click "See All" on any category to view all apps in that category with a beautiful grid layout and easy navigation back to the main search view.</li>
                        <li><strong>Category Icons</strong> - Every category now has a beautiful, colorful icon that makes browsing more intuitive and visually appealing.</li>
                        <li><strong>Genius Icon Update</strong> - The Genius tab now uses a modern atom icon (⚛️) representing intelligent recommendations powered by smart algorithms.</li>
                    </ul>
                    
                    <h3>🎨 Design Enhancements</h3>
                    <ul>
                        <li><strong>3D Skeuomorphic Cards</strong> - All app cards now feature enhanced 3D effects with top-to-bottom gradients creating a beautiful depth illusion.</li>
                        <li><strong>Faster Carousel</strong> - Carousel transitions are now quicker and smoother (0.5s instead of 0.8s) while maintaining the 8-second rotation time.</li>
                        <li><strong>Glossy Buttons</strong> - "See All" and navigation buttons feature enhanced glossy effects with beautiful highlights and shadows.</li>
                        <li><strong>Improved Card Shadows</strong> - Multi-layered shadows create more realistic depth on all cards throughout the site.</li>
                    </ul>
                    
                    <h3>🔍 Search Improvements</h3>
                    <ul>
                        <li>Search now works seamlessly with category browsing - when you search for an app, it filters the results while maintaining the beautiful layout</li>
                        <li>Category rows automatically hide when searching, showing only matching results</li>
                        <li>Clear search to return to the categorized browsing experience</li>
                        <li>Smooth transitions between search results and category views</li>
                    </ul>
                    
                    <h3>📱 User Experience</h3>
                    <ul>
                        <li>All cards maintain consistent sizing across every page for a cohesive experience</li>
                        <li>Staggered fade-in animations make content loading feel smooth and premium</li>
                        <li>Back buttons on detail pages ensure you never get lost</li>
                        <li>Responsive design works beautifully on all screen sizes</li>
                    </ul>
                    
                    <h3>🎯 Coming from v1.0</h3>
                    <p>If you're upgrading from v1.0, you'll still have all previous features including:</p>
                    <ul>
                        <li>Smart Genius recommendations based on your viewing history</li>
                        <li>Beautiful loading animation on first page load</li>
                        <li>News tab with changelog updates</li>
                        <li>Enhanced glossy UI throughout</li>
                    </ul>
                    
                    <p>Thank you for using iOS App Archive! We're constantly working to improve your experience. Enjoy exploring!</p>
                </div>
            </div>
        `;
        
        // Close button handler
        const closeBtn = modal.querySelector('.news-close-btn');
        closeBtn.addEventListener('click', () => modal.remove());
        
        // Click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    };
}

// Update the renderNewsPage to use rocket icon
const originalRenderNewsPage = window.renderNewsPage || renderNewsPage;
if (typeof renderNewsPage === 'function') {
    window.renderNewsPage = function() {
        const updatesContent = document.getElementById('updatesContent');
        if (!updatesContent) return;
        
        updatesContent.innerHTML = '';
        
        const container = document.createElement('div');
        container.className = 'news-page-container';
        
        const header = document.createElement('div');
        header.className = 'news-header';
        header.innerHTML = `
            <h2><i class="fas fa-newspaper"></i> What's New</h2>
        `;
        container.appendChild(header);
        
        // Create news card with rocket icon
        const newsCard = document.createElement('div');
        newsCard.className = 'news-card';
        newsCard.innerHTML = `
            <div class="news-card-header">
                <div class="news-icon">
                    <i class="fas fa-rocket"></i>
                </div>
                <div class="news-card-title">
                    <h3>iOS App Archive Update v2.0</h3>
                    <div class="news-card-date">February 15, 2026</div>
                </div>
            </div>
            <div class="news-card-preview">
                Major update! Enhanced search with category rows, 3D skeuomorphic cards, category icons, and much more. Click to view the full changelog.
            </div>
            <span class="news-badge">VERSION 2.0</span>
        `;
        
        newsCard.addEventListener('click', showNewsModal);
        container.appendChild(newsCard);
        updatesContent.appendChild(container);
    };
}

// Enhanced tab switching for search tab
(function() {
    const allTabs = document.querySelectorAll('.tab');
    
    allTabs.forEach(tab => {
        const originalClickHandler = tab.onclick;
        tab.addEventListener('click', function(e) {
            const tabName = this.getAttribute('data-tab');
            
            if (tabName === 'search') {
                // Empty state will be shown by default in the search tab
                // No category browsing needed
            }
        });
    });
})();

// Initialize Genius and News when apps load
appsPromise.then(() => {
    if (appsLoaded) {
        // Update Genius and News with new content
        if (typeof renderGeniusPage === 'function') {
            renderGeniusPage();
        }
        if (typeof renderNewsPage === 'function') {
            renderNewsPage();
        }
    }
}).catch(error => {
    console.error('Error initializing new features:', error);
});
