        let apps = [];
        let appsLoaded = false;

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
                        <h3 class="app-title">${app.title}</h3>
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
                    <div class="card-name">${app.title}</div>
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
            let modal = document.getElementById(`${appId}Modal`);
            if (!modal) {
                const app = apps.find(a => a.id === appId);
                if (!app) {
                    alert('App ID not found, please try again with a different app ID.');
                    return;
                }
                modal = createModal(app);
            }
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            setUrlParam('app', appId);
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
            cancelSearch.classList.remove('visible');
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
                    openModal(appId);
                });
            });
        }
