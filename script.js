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
            return Array.from(new Set(list.map(normalizeDeviceName).filter(Boolean)));
        }

        function renderDeviceIcons(app) {
            const devices = getAppDevices(app);
            if (devices.length === 0) return '';
            const parts = [];
            if (devices.includes('iPhone') || devices.includes('iPod Touch')) {
                const label = (devices.includes('iPhone') && devices.includes('iPod Touch')) ? 'iPhone & iPod Touch' : (devices.includes('iPod Touch') ? 'iPod Touch' : 'iPhone');
                parts.push(`<span class="device-icon device-icon-iphone" title="${escapeHtml(label)}"><i class="fa-solid fa-mobile-screen-button"></i></span>`);
            }
            if (devices.includes('iPad')) {
                parts.push(`<span class="device-icon device-icon-ipad" title="iPad"><i class="fa-solid fa-tablet-screen-button"></i></span>`);
            }
            return `<span class="device-icons">${parts.join('')}</span>`;
        }

        function renderAppTitle(app) { return `${escapeHtml(app?.title)}`; }
        function renderAppTitleWithDevices(app) { return `${escapeHtml(app?.title)}${renderDeviceIcons(app)}`; }

        async function fetchAppsData() {
            const response = await fetch('apps.json');
            if (!response.ok) throw new Error('Failed to load apps data.');
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Apps data is not in the expected format.');
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

        const tabContents = {
            featured: document.getElementById('featuredContent'),
            categories: document.getElementById('categoriesContent'),
            genius: document.getElementById('geniusContent'),
            search: document.getElementById('searchContent'),
            updates: document.getElementById('updatesContent')
        };

        let currentIndex = 0;
        let autoSlideInterval;
        let touchStartX = 0;
        let touchEndX = 0;

        function getDailyRandomApps(appList, count) {
            const dateStr = new Date().toISOString().slice(0, 10);
            let seed = 0;
            for (let i = 0; i < dateStr.length; i++) { seed = (seed << 5) - seed + dateStr.charCodeAt(i); seed |= 0; }
            function rand() {
                seed |= 0; seed = seed + 0x6D2B79F5 | 0;
                let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
                t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
            const list = [...appList];
            for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
            return list.slice(0, count);
        }

        function initCarousel() {
            carousel.innerHTML = '';
            carouselNav.innerHTML = '';
            if (!appsLoaded || apps.length === 0) {
                carousel.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;">Loading apps...</p>';
                return;
            }
            const featuredApps = getDailyRandomApps(apps, 7);
            featuredApps.forEach((app, index) => {
                const item = document.createElement('div');
                item.className = 'carousel-item';
                item.dataset.index = index;
                item.innerHTML = `
                    <div class="app-card">
                        <div class="app-icon-container">
                            <div class="app-icon">
                                ${app.icon ? `<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                            </div>
                        </div>
                        <h3 class="app-title">${renderAppTitle(app)}</h3>
                        <div class="app-description">${app.featuredDescription}</div>
                        <button class="card-button" data-app-id="${app.id}">Get</button>
                    </div>`;
                carousel.appendChild(item);
                const dot = document.createElement('div');
                dot.className = 'nav-dot';
                dot.dataset.index = index;
                dot.addEventListener('click', () => goToSlide(index));
                carouselNav.appendChild(dot);
            });
            updateCarousel();
            startAutoSlide();
            setupSwipe();
            document.querySelectorAll('.app-card .card-button').forEach(btn => {
                btn.addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
            });
        }

        function updateCarousel() {
            const items = document.querySelectorAll('.carousel-item');
            const dots = document.querySelectorAll('.nav-dot');
            const n = items.length;
            items.forEach((item, i) => {
                item.classList.remove('active', 'prev', 'next');
                if (i === currentIndex) item.classList.add('active');
                else if (i === (currentIndex - 1 + n) % n) item.classList.add('prev');
                else if (i === (currentIndex + 1) % n) item.classList.add('next');
            });
            dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
        }

        function goToSlide(index) { currentIndex = index; updateCarousel(); resetAutoSlide(); }
        function nextSlide() { const n = document.querySelectorAll('.carousel-item').length; currentIndex = (currentIndex + 1) % n; updateCarousel(); }
        function prevSlide() { const n = document.querySelectorAll('.carousel-item').length; currentIndex = (currentIndex - 1 + n) % n; updateCarousel(); }
        function startAutoSlide() { autoSlideInterval = setInterval(nextSlide, 8000); }
        function resetAutoSlide() { clearInterval(autoSlideInterval); startAutoSlide(); }

        function setupSwipe() {
            carouselContainer.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, false);
            carouselContainer.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchEndX < touchStartX - 50) nextSlide();
                if (touchEndX > touchStartX + 50) prevSlide();
                resetAutoSlide();
            }, false);
        }

        // ── Unified metallic "Get" button HTML ──────────────────────────────
        function metalGetBtn(appId, extraClass = '') {
            return `<button class="get-btn ${extraClass}" data-app-id="${appId}">Get</button>`;
        }

        // ── Search results ───────────────────────────────────────────────────
        let currentSearchFilteredApps = [];

        function renderSearchResults(filteredApps = []) {
            currentSearchFilteredApps = filteredApps;
            const sorted = filteredApps.slice().sort((a, b) => a.title.localeCompare(b.title));
            searchResults.innerHTML = '';
            if (sorted.length === 0) {
                searchResults.innerHTML = '<p style="text-align:center;padding:60px 20px;color:#999;">No apps found. Try a different search term.</p>';
                return;
            }
            const scroller = document.createElement('div');
            scroller.className = 'search-results-scroller';
            scroller.id = 'searchScroller';

            sorted.forEach((app, index) => {
                const card = document.createElement('div');
                card.className = 'app-card-large';
                card.setAttribute('data-index', index);
                card.innerHTML = `
                    <div class="card-header">
                        <div class="large-card-icon">
                            ${app.icon ? `<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="card-info">
                            <div class="large-card-name">${renderAppTitle(app)}</div>
                            <div class="large-card-developer">${escapeHtml(app.developer)}</div>
                        </div>
                        ${metalGetBtn(app.id, 'large-card-button')}
                    </div>`;
                scroller.appendChild(card);
            });

            searchResults.appendChild(scroller);

            const counter = document.createElement('div');
            counter.className = 'search-results-counter';
            counter.id = 'searchCounter';
            counter.textContent = `1 of ${sorted.length} ${sorted.length === 1 ? 'app' : 'apps'}`;
            searchResults.appendChild(counter);

            const scrollEl = document.getElementById('searchScroller');
            const counterEl = document.getElementById('searchCounter');
            scrollEl.scrollLeft = 0;

            let isScrolling;
            scrollEl.addEventListener('scroll', function() {
                clearTimeout(isScrolling);
                isScrolling = setTimeout(() => {
                    const cards = scrollEl.querySelectorAll('.app-card-large');
                    let closest = 0, minDist = Infinity;
                    cards.forEach((c, i) => {
                        const dist = Math.abs((c.getBoundingClientRect().left + c.offsetWidth / 2) - (scrollEl.getBoundingClientRect().left + scrollEl.offsetWidth / 2));
                        if (dist < minDist) { minDist = dist; closest = i; }
                    });
                    counterEl.textContent = `${closest + 1} of ${sorted.length} ${sorted.length === 1 ? 'app' : 'apps'}`;
                }, 50);
            });

            searchResults.querySelectorAll('.get-btn').forEach(btn => {
                btn.addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
            });
        }

        // ── Modal ────────────────────────────────────────────────────────────
        function createModal(app) {
            const relatedApps = apps.filter(a => a.id !== app.id && (a.developer === app.developer || a.categories.some(c => app.categories.includes(c)))).slice(0, 8);

            let versionItems = '';
            if (app.versions.archived.length > 0) {
                versionItems += `<div class="version-group"><h4>Archived Versions</h4><ul class="version-list">${app.versions.archived.map(v => `<li><span>${v.version}</span><a href="${v.url}" download class="download-button"><i class="fas fa-download"></i> Download IPA</a></li>`).join('')}</ul></div>`;
            }
            if (app.versions.unarchived.length > 0) {
                versionItems += `<div class="version-group"><h4 class="unarchived-label">Unarchived Versions</h4><ul class="version-list">${app.versions.unarchived.map(v => `<li>${v}</li>`).join('')}</ul></div>`;
            }

            const categoryTags = app.categories.map(cat => `<span class="modal-category-tag">${cat}</span>`).join('');

            const relatedHTML = relatedApps.map(ra => `
                <div class="related-app-item">
                    <div class="related-app-icon">${ra.icon ? `<img src="${ra.icon}" alt="${escapeHtml(ra.title)}" loading="lazy">` : '<i class="fas fa-mobile-alt"></i>'}</div>
                    <div class="related-app-info" data-app-id="${ra.id}">
                        <div class="related-app-name">${escapeHtml(ra.title)}</div>
                        <div class="related-app-developer">${escapeHtml(ra.developer)}</div>
                    </div>
                    <button class="related-app-get-btn get-btn" data-app-id="${ra.id}">Get</button>
                </div>`).join('');

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = `${app.id}Modal`;
            modal.innerHTML = `
                <div class="modal-sub-header">
                    <button class="modal-close-btn">Close</button>
                    <div class="modal-sub-header-title">Info</div>
                    <div style="width:70px;"></div>
                </div>
                <div class="modal-content">
                    <div class="modal-app-header">
                        <div class="modal-app-icon">${app.icon ? `<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy">` : '<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="modal-app-info">
                            <div class="modal-app-title">${escapeHtml(app.title)}</div>
                            <div class="modal-app-developer">${escapeHtml(app.developer)}</div>
                        </div>
                        <button class="modal-get-btn get-btn" data-app-id="${app.id}">Get</button>
                    </div>
                    <div class="modal-categories">${categoryTags}</div>
                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" data-tab="details">App Details</button>
                        <button class="modal-tab-btn" data-tab="related">Related Apps</button>
                    </div>
                    <div class="modal-tab-content active" id="details-content">
                        <div class="modal-section"><h3><i class="fas fa-mobile-alt"></i> Compatibility</h3><p class="compatibility-text">${app.compatibility}</p></div>
                        <div class="modal-section"><h3><i class="fas fa-align-left"></i> App Store Description</h3>${app.description.split('\n').map(p => `<p>${p}</p>`).join('')}</div>
                    </div>
                    <div class="modal-tab-content" id="related-content">
                        <div class="related-apps-list">${relatedHTML || '<p style="text-align:center;color:#999;padding:20px;">No related apps found.</p>'}</div>
                    </div>
                </div>
                <div class="version-sheet-overlay">
                    <div class="version-sheet">
                        <h3 class="version-sheet-title">Version History</h3>
                        <div class="versions-container">${versionItems}</div>
                        <button class="version-sheet-cancel">Cancel</button>
                    </div>
                </div>`;

            modalContainer.appendChild(modal);

            modal.querySelector('.modal-close-btn').addEventListener('click', () => { modal.classList.remove('active'); document.body.style.overflow = 'auto'; setUrlParam('app', ''); });
            modal.querySelectorAll('.modal-tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    modal.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
                    modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    modal.querySelector(`#${this.getAttribute('data-tab')}-content`).classList.add('active');
                });
            });
            modal.querySelector('.modal-get-btn').addEventListener('click', () => modal.querySelector('.version-sheet-overlay').classList.add('active'));
            modal.querySelector('.version-sheet-cancel').addEventListener('click', () => modal.querySelector('.version-sheet-overlay').classList.remove('active'));
            modal.querySelector('.version-sheet-overlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
            modal.querySelectorAll('.related-app-info').forEach(info => {
                info.addEventListener('click', function() { const id = this.getAttribute('data-app-id'); modal.classList.remove('active'); setTimeout(() => openModal(id), 300); });
            });
            modal.querySelectorAll('.related-app-get-btn').forEach(btn => {
                btn.addEventListener('click', function(e) { e.stopPropagation(); const id = this.getAttribute('data-app-id'); modal.classList.remove('active'); setTimeout(() => openModal(id), 300); });
            });
            modal.addEventListener('click', function(e) { if (e.target === modal) { modal.classList.remove('active'); document.body.style.overflow = 'auto'; setUrlParam('app', ''); } });
            return modal;
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => { m.classList.remove('active'); document.body.style.overflow = 'auto'; setUrlParam('app', ''); });
                document.querySelectorAll('.version-sheet-overlay.active').forEach(s => s.classList.remove('active'));
            }
        });

        function openModal(appId) {
            let modal = document.getElementById(`${appId}Modal`);
            let fresh = false;
            if (!modal) {
                const app = apps.find(a => a.id === appId);
                if (!app) { alert('App not found.'); return; }
                modal = createModal(app);
                fresh = true;
                trackAppView(appId);
            }
            document.body.style.overflow = 'hidden';
            setUrlParam('app', appId);
            if (fresh) { modal.offsetHeight; requestAnimationFrame(() => modal.classList.add('active')); }
            else modal.classList.add('active');
        }

        // ── Tab switching ────────────────────────────────────────────────────
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.getAttribute('data-tab');
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                Object.values(tabContents).forEach(c => c.classList.remove('active'));

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
                    if (!appsLoaded) { searchResults.classList.remove('active'); if (emptyState) emptyState.style.display = 'flex'; return; }
                    const q = getUrlParam('query');
                    if (q) searchInput.value = q;
                    const term = q !== null ? q : searchInput.value;
                    if (term && term.trim().length > 0) {
                        searchResults.classList.add('active');
                        if (emptyState) emptyState.style.display = 'none';
                        renderSearchResults(filterAppsByQuery(term));
                        updateCancelVisibility();
                    } else {
                        searchResults.classList.remove('active');
                        if (emptyState) emptyState.style.display = 'flex';
                    }
                } else if (tabName === 'categories') {
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents.categories.classList.add('active');
                    const catParam = getUrlParam('category');
                    if (catParam) renderAppsForCategory(catParam);
                    else renderCategoryList();
                } else if (tabName === 'genius') {
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents.genius.classList.add('active');
                    if (appsLoaded) renderGeniusPage();
                } else if (tabName === 'updates') {
                    carouselContainer.style.display = 'none';
                    searchContainer.style.display = 'none';
                    searchResults.classList.remove('active');
                    tabContents.updates.classList.add('active');
                    renderNewsPage();
                }
            });
        });

        function filterAppsByQuery(query) {
            const q = (query || '').toLowerCase().trim();
            if (!q) return apps;
            return apps.filter(app => app.title.toLowerCase().includes(q) || (app.developer || '').toLowerCase().includes(q));
        }

        function updateCancelVisibility() {
            const has = searchInput.value.trim().length > 0;
            if (document.activeElement === searchInput || has) { cancelSearch.classList.add('visible'); searchInput.classList.add('has-text'); }
            else { cancelSearch.classList.remove('visible'); searchInput.classList.remove('has-text'); }
        }

        searchInput.addEventListener('input', function() {
            if (!appsLoaded) return;
            const term = this.value;
            setUrlParam('query', term);
            const emptyState = document.getElementById('searchEmptyState');
            if (term.trim().length === 0) { searchResults.classList.remove('active'); if (emptyState) emptyState.style.display = 'flex'; }
            else { searchResults.classList.add('active'); if (emptyState) emptyState.style.display = 'none'; renderSearchResults(filterAppsByQuery(term)); }
            updateCancelVisibility();
        });
        searchInput.addEventListener('focus', updateCancelVisibility);
        searchInput.addEventListener('blur', updateCancelVisibility);
        cancelSearch.addEventListener('click', function() {
            if (!appsLoaded) return;
            searchInput.value = '';
            searchInput.blur();
            setUrlParam('query', '');
            searchResults.classList.remove('active');
            const emptyState = document.getElementById('searchEmptyState');
            if (emptyState) emptyState.style.display = 'flex';
            updateCancelVisibility();
        });

        document.addEventListener('DOMContentLoaded', async function() {
            try {
                apps = await appsPromise;
                appsLoaded = true;
            } catch (err) {
                console.error(err);
                carousel.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;">Failed to load apps.</p>';
                tabContents.featured.classList.add('active');
                return;
            }
            initCarousel();
            document.addEventListener('keydown', function(e) {
                if (!document.querySelector('.tab[data-tab="search"]').classList.contains('active')) {
                    if (e.key === 'ArrowRight') nextSlide();
                    else if (e.key === 'ArrowLeft') prevSlide();
                }
            });
            tabContents.featured.classList.add('active');
            const q = getUrlParam('query');
            if (q) { searchInput.value = q; tabs.forEach(t => { if (t.getAttribute('data-tab') === 'search') t.click(); }); renderSearchResults(filterAppsByQuery(q)); }
            const appParam = getUrlParam('app');
            if (appParam) openModal(appParam);
            const catParam = getUrlParam('category');
            if (catParam) { tabs.forEach(t => { if (t.getAttribute('data-tab') === 'categories') t.click(); }); renderAppsForCategory(catParam); }
        });

        function setUrlParam(key, value) {
            const params = new URLSearchParams(window.location.search);
            if (value && value.length > 0) params.set(key, value); else params.delete(key);
            window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
        }
        function getUrlParam(key) { return new URLSearchParams(window.location.search).get(key); }

        function getAllCategories() {
            const s = new Set();
            apps.forEach(app => { if (Array.isArray(app.categories)) app.categories.forEach(c => s.add(c)); });
            return Array.from(s).sort();
        }

        // ── Categories tab: horizontal scroll rows ───────────────────────────
        const CATEGORY_ICON_MAP = {
            'Games': { icon: 'fa-gamepad', color: '#ff453a' },
            'Entertainment': { icon: 'fa-film', color: '#ff9f0a' },
            'Food & Drink': { icon: 'fa-utensils', color: '#32d74b' },
            'News': { icon: 'fa-newspaper', color: '#64d2ff' },
            'Utilities': { icon: 'fa-wrench', color: '#bf5af2' },
            'Social Networking': { icon: 'fa-users', color: '#5e5ce6' },
            'Productivity': { icon: 'fa-briefcase', color: '#30d158' },
            'Education': { icon: 'fa-graduation-cap', color: '#ffd60a' },
            'Music': { icon: 'fa-music', color: '#ff453a' },
            'Photo & Video': { icon: 'fa-camera', color: '#0a84ff' },
            'Shopping': { icon: 'fa-shopping-bag', color: '#ff9f0a' },
            'Travel': { icon: 'fa-plane', color: '#64d2ff' },
            'Sports': { icon: 'fa-football-ball', color: '#32d74b' },
            'Health & Fitness': { icon: 'fa-heartbeat', color: '#ff453a' },
            'Finance': { icon: 'fa-dollar-sign', color: '#30d158' },
            'Books': { icon: 'fa-book', color: '#ffd60a' },
            'Reference': { icon: 'fa-book-open', color: '#bf5af2' },
            'Business': { icon: 'fa-chart-line', color: '#5e5ce6' },
            'Weather': { icon: 'fa-cloud-sun', color: '#64d2ff' },
            'Lifestyle': { icon: 'fa-spa', color: '#ff9f0a' }
        };

        function renderCategoryList() {
            const cc = tabContents.categories;
            cc.innerHTML = '';
            if (!appsLoaded || apps.length === 0) { cc.innerHTML = '<p style="text-align:center;padding:20px;color:#aaa;">Loading…</p>'; return; }

            const wrap = document.createElement('div');
            wrap.className = 'categories-horizontal-wrap category-fade-in';

            const categories = getAllCategories();

            categories.forEach(cat => {
                const appsInCat = apps.filter(a => Array.isArray(a.categories) && a.categories.includes(cat));
                if (appsInCat.length === 0) return;

                const iconData = CATEGORY_ICON_MAP[cat] || { icon: 'fa-th-large', color: '#aaa' };

                const section = document.createElement('div');
                section.className = 'cat-section';

                // Section header
                const hdr = document.createElement('div');
                hdr.className = 'cat-section-header';
                hdr.innerHTML = `
                    <div class="cat-section-title-row">
                        <span class="cat-section-icon" style="color:${iconData.color}"><i class="fas ${iconData.icon}"></i></span>
                        <span class="cat-section-title">${escapeHtml(cat)}</span>
                    </div>
                    <button class="cat-see-all-btn" data-cat="${escapeHtml(cat)}">See All</button>`;
                hdr.querySelector('.cat-see-all-btn').addEventListener('click', function() {
                    setUrlParam('category', cat);
                    renderAppsForCategory(cat);
                });
                section.appendChild(hdr);

                // Horizontal scroller
                const scroller = document.createElement('div');
                scroller.className = 'cat-apps-scroller';

                appsInCat.slice(0, 12).forEach(app => {
                    const card = document.createElement('div');
                    card.className = 'cat-app-card';
                    card.innerHTML = `
                        <div class="cat-app-icon">
                            ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="cat-app-name">${escapeHtml(app.title)}</div>
                        <div class="cat-app-developer">${escapeHtml(app.developer)}</div>
                        <button class="get-btn cat-get-btn" data-app-id="${app.id}">Get</button>`;
                    card.querySelector('.get-btn').addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
                    scroller.appendChild(card);
                });

                section.appendChild(scroller);
                wrap.appendChild(section);
            });

            cc.appendChild(wrap);
        }

        function renderAppsForCategory(category) {
            const cc = tabContents.categories;
            cc.innerHTML = '';

            const backBtn = document.createElement('button');
            backBtn.className = 'back-to-categories-btn';
            backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i><span>Back to Categories</span>';
            backBtn.addEventListener('click', () => { setUrlParam('category', ''); renderCategoryList(); });
            cc.appendChild(backBtn);

            const title = document.createElement('h3');
            title.textContent = `Apps in "${category}"`;
            title.style.cssText = 'text-align:center;margin-bottom:20px;color:#1a1a1a;font-size:20px;font-weight:700;';
            cc.appendChild(title);

            const filtered = apps.filter(a => Array.isArray(a.categories) && a.categories.includes(category));
            const sorted = filtered.slice().sort((a, b) => a.title.localeCompare(b.title));

            if (sorted.length === 0) { cc.innerHTML += '<p style="text-align:center;color:#999;padding:20px;">No apps in this category.</p>'; return; }

            const grid = document.createElement('div');
            grid.className = 'category-apps-grid category-fade-in';
            sorted.forEach(app => {
                const card = document.createElement('div');
                card.className = 'cat-app-card-grid';
                card.innerHTML = `
                    <div class="cat-app-icon-grid">
                        ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                    </div>
                    <div class="cat-app-name-grid">${escapeHtml(app.title)}</div>
                    <div class="cat-app-dev-grid">${escapeHtml(app.developer)}</div>
                    <button class="get-btn" data-app-id="${app.id}">Get</button>`;
                card.querySelector('.get-btn').addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
                grid.appendChild(card);
            });
            cc.appendChild(grid);
        }

        // ── Genius page: vertical list like related apps ──────────────────────
        let viewedApps = [];
        const MAX_VIEWED = 20;
        function loadViewedApps() { try { const s = localStorage.getItem('viewedApps'); if (s) viewedApps = JSON.parse(s); } catch(e) { viewedApps = []; } }
        loadViewedApps();
        function trackAppView(id) {
            if (!viewedApps.includes(id)) {
                viewedApps.unshift(id);
                if (viewedApps.length > MAX_VIEWED) viewedApps = viewedApps.slice(0, MAX_VIEWED);
                try { localStorage.setItem('viewedApps', JSON.stringify(viewedApps)); } catch(e) {}
            }
        }

        function getGeniusRecommendations() {
            if (!appsLoaded || apps.length === 0) return [];
            if (viewedApps.length === 0) return getDailyRandomApps(apps, 16);
            const viewed = viewedApps.map(id => apps.find(a => a.id === id)).filter(Boolean);
            const cats = new Set(), devs = new Set();
            viewed.forEach(a => { (a.categories || []).forEach(c => cats.add(c)); if (a.developer) devs.add(a.developer); });
            const scored = apps.filter(a => !viewedApps.includes(a.id)).map(a => {
                let score = (a.categories || []).filter(c => cats.has(c)).length * 10;
                if (devs.has(a.developer)) score += 5;
                score += Math.random() * 2;
                return { a, score };
            });
            scored.sort((x, y) => y.score - x.score);
            return scored.slice(0, 16).map(x => x.a);
        }

        function renderGeniusPage() {
            const gc = document.getElementById('geniusContent');
            if (!gc) return;
            gc.innerHTML = '';

            const container = document.createElement('div');
            container.className = 'genius-page-container';

            const header = document.createElement('div');
            header.className = 'genius-header';
            header.innerHTML = `<h2><i class="fas fa-atom"></i> Recommended for You</h2><p>${viewedApps.length > 0 ? "Based on apps you've viewed" : 'Curated selections for today'}</p>`;
            container.appendChild(header);

            const recs = getGeniusRecommendations();
            if (recs.length === 0) {
                const msg = document.createElement('p');
                msg.textContent = 'Browse some apps to get personalised suggestions!';
                msg.style.cssText = 'text-align:center;color:#999;padding:40px 20px;';
                container.appendChild(msg);
            } else {
                const list = document.createElement('div');
                list.className = 'genius-list';
                recs.forEach((app, i) => {
                    const item = document.createElement('div');
                    item.className = 'genius-list-item';
                    item.style.animationDelay = `${i * 0.04}s`;
                    item.innerHTML = `
                        <div class="genius-app-icon">
                            ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="genius-app-info" data-app-id="${app.id}">
                            <div class="genius-app-name">${escapeHtml(app.title)}</div>
                            <div class="genius-app-dev">${escapeHtml(app.developer || 'Unknown')}</div>
                        </div>
                        <button class="get-btn genius-get-btn" data-app-id="${app.id}">Get</button>`;
                    item.querySelector('.genius-app-info').addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
                    item.querySelector('.get-btn').addEventListener('click', function() { openModal(this.getAttribute('data-app-id')); });
                    list.appendChild(item);
                });
                container.appendChild(list);
            }
            gc.appendChild(container);
        }

        // ── News page ────────────────────────────────────────────────────────
        const NEWS_ARTICLES = [
            {
                id: 'v201',
                icon: 'fa-paint-brush',
                title: 'iOS App Archive v2.0.1',
                date: 'March 11, 2026',
                badge: 'UPDATE',
                preview: 'UI polish update — white gradient theme, ingrained tab icons, redesigned categories & Genius pages, and much more.',
                body: `
                    <h3>🎨 Visual Overhaul</h3>
                    <p>v2.0.1 ships a comprehensive visual refresh bringing the entire site to a clean white-gradient aesthetic while keeping the iconic black header and tab bar.</p>
                    <ul>
                        <li><strong>White Gradient Theme</strong> — The site background, all app cards, search cards, carousel cards, and modal backgrounds now use a soft white-to-light-grey gradient.</li>
                        <li><strong>Colored Header Icon</strong> — The iOS App Archive logo in the top header is now displayed in full colour instead of the monochrome version.</li>
                        <li><strong>Metallic "Get" Buttons</strong> — Every "Get" button across the site (search, featured, categories, Genius, modal, related apps) now uses a unified shiny metallic pill shape with a glossy highlight and ingrained text shadow.</li>
                        <li><strong>Featured Carousel Cards</strong> — Carousel cards are now white-gradient with dark text and the matching metallic Get button. The broken reflection effect has been removed.</li>
                        <li><strong>Search Card Fix</strong> — Search result cards now display the app icon, name, developer, and Get button in a clean horizontal row — exactly matching the look from the original iOS App Store.</li>
                    </ul>
                    <h3>🗂️ Categories Page Rebuilt</h3>
                    <ul>
                        <li><strong>Horizontal Scroll Rows</strong> — Each category now appears as its own labelled horizontal scrollable row with coloured category icons, matching the App Store browse page style.</li>
                        <li><strong>Category Icons</strong> — Every category has a unique coloured Font Awesome icon (Games = red gamepad, Food & Drink = green fork, etc.).</li>
                        <li><strong>"See All" Button</strong> — Tapping "See All" on a category row opens a full grid view of every app in that category.</li>
                        <li><strong>Cards & Get Buttons</strong> — Category row cards and grid cards all use the new white style with the metallic Get button.</li>
                    </ul>
                    <h3>⚛️ Genius Page Rebuilt</h3>
                    <ul>
                        <li><strong>Vertical List Layout</strong> — Genius recommendations now appear as a vertical list (identical in structure to the Related Apps list in modals) instead of a grid of dark cards.</li>
                        <li><strong>White Row Style</strong> — Each recommendation row has the white gradient background with icon, name, developer and metallic Get button.</li>
                        <li><strong>Atom Icon</strong> — The Genius page header now correctly uses the atom icon.</li>
                    </ul>
                    <h3>📰 News Page Restyled</h3>
                    <ul>
                        <li>News page and article cards now fully match the white-and-black site theme.</li>
                        <li>V1.0 and V2.0 changelog articles restored in addition to this V2.0.1 entry.</li>
                    </ul>
                    <h3>🔧 Tab Bar Polish</h3>
                    <ul>
                        <li>Blue glow removed from active tab — reverted to the deep ingrained/engraved icon effect with no colour cast.</li>
                        <li>Active tab indicator remains as the subtle top-edge line for clarity.</li>
                    </ul>
                    <p>Thank you for using iOS App Archive — enjoy the refresh!</p>`
            },
            {
                id: 'v200',
                icon: 'fa-rocket',
                title: 'iOS App Archive v2.0',
                date: 'February 15, 2026',
                badge: 'VERSION 2.0',
                preview: 'Major update — enhanced search with category rows, 3D skeuomorphic cards, Genius recommendations, and the new News tab.',
                body: `
                    <h3>🚀 Major Feature Update</h3>
                    <p>Version 2.0 of iOS App Archive arrives with significant improvements and new features!</p>
                    <h3>✨ New Features</h3>
                    <ul>
                        <li><strong>Enhanced Search Experience</strong> — The Search tab features curated category rows including Recently Added, Games, Entertainment, Food & Drink, and News.</li>
                        <li><strong>Category Detail Views</strong> — "See All" opens a full grid view with easy back-navigation.</li>
                        <li><strong>Genius Recommendations</strong> — The Genius tab provides personalised app recommendations based on your viewing history. The more you explore, the smarter it gets.</li>
                        <li><strong>News Tab</strong> — Stay up to date with archive changes and updates right here.</li>
                        <li><strong>Beautiful Loading Animation</strong> — A polished loading screen greets you on first visit.</li>
                    </ul>
                    <h3>🎨 Design Enhancements</h3>
                    <ul>
                        <li><strong>3D Skeuomorphic Cards</strong> — Enhanced depth with top-to-bottom gradients and layered shadows.</li>
                        <li><strong>Glossy Buttons</strong> — Navigation and action buttons feature updated glossy highlights.</li>
                        <li><strong>Faster Carousel</strong> — Transitions are quicker (0.5 s) while keeping the 8-second rotation.</li>
                    </ul>
                    <h3>🔧 How Genius Works</h3>
                    <ul>
                        <li>Genius tracks your viewing history in your browser's local storage — never sent to any server.</li>
                        <li>Recommendations weight category and developer matches to surface the most relevant apps.</li>
                    </ul>
                    <p>Thank you for using iOS App Archive!</p>`
            },
            {
                id: 'v100',
                icon: 'fa-star',
                title: 'iOS App Archive v1.0 — Launch',
                date: 'January 1, 2026',
                badge: 'LAUNCH',
                preview: 'The very first release of iOS App Archive — archiving every delisted iOS app from the most well-known to the most obscure.',
                body: `
                    <h3>🎉 Welcome to iOS App Archive!</h3>
                    <p>This is where it all started. Version 1.0 launched iOS App Archive as a dedicated home for every delisted iOS app — from chart-toppers to long-forgotten gems.</p>
                    <h3>📱 Core Features at Launch</h3>
                    <ul>
                        <li><strong>Featured Carousel</strong> — A daily-rotating carousel highlights apps curated for that day, auto-advancing every 8 seconds.</li>
                        <li><strong>Full App Search</strong> — Search the entire archive by app name or developer. Results are sorted alphabetically and paginated with an app counter.</li>
                        <li><strong>App Detail Modals</strong> — Tap any app to see its icon, developer, compatibility, full App Store description, version history, and related apps.</li>
                        <li><strong>Version Downloads</strong> — Archived IPA files are linked directly from the version history sheet so you can sideload them today.</li>
                        <li><strong>Categories Tab</strong> — Browse the full list of app categories and drill into any one to see every archived title.</li>
                        <li><strong>Glossy Skeuomorphic UI</strong> — The interface was designed from the start to echo the look and feel of iOS 6 — complete with a dark brushed-metal bottom bar, embossed buttons, and inset card shadows.</li>
                    </ul>
                    <h3>📦 The Archive</h3>
                    <p>At launch the archive contained the full apps.json dataset covering titles across Games, Entertainment, Food & Drink, Education, Utilities, and many more categories. IPA files for verified builds are hosted on the CDN and linked directly.</p>
                    <h3>🙏 Thank You</h3>
                    <p>iOS App Archive exists because of everyone who helped track down, test, and preserve these apps. If you have an IPA that isn't in the archive yet, reach out — every contribution helps keep iOS history alive.</p>`
            }
        ];

        function renderNewsPage() {
            const uc = document.getElementById('updatesContent');
            if (!uc) return;
            uc.innerHTML = '';

            const container = document.createElement('div');
            container.className = 'news-page-container';

            const header = document.createElement('div');
            header.className = 'news-header';
            header.innerHTML = `<h2><i class="fas fa-newspaper"></i> What's New</h2>`;
            container.appendChild(header);

            NEWS_ARTICLES.forEach(article => {
                const card = document.createElement('div');
                card.className = 'news-card';
                card.innerHTML = `
                    <div class="news-card-header">
                        <div class="news-icon"><i class="fas ${article.icon}"></i></div>
                        <div class="news-card-title">
                            <h3>${escapeHtml(article.title)}</h3>
                            <div class="news-card-date">${escapeHtml(article.date)}</div>
                        </div>
                    </div>
                    <div class="news-card-preview">${escapeHtml(article.preview)}</div>
                    <span class="news-badge">${escapeHtml(article.badge)}</span>`;
                card.addEventListener('click', () => showArticleModal(article));
                container.appendChild(card);
            });

            uc.appendChild(container);
        }

        function showArticleModal(article) {
            const modal = document.createElement('div');
            modal.className = 'news-modal';
            modal.innerHTML = `
                <div class="news-modal-content">
                    <button class="news-close-btn"><i class="fas fa-times"></i></button>
                    <div class="news-modal-header">
                        <div class="news-modal-icon"><i class="fas ${article.icon}"></i></div>
                        <div class="news-modal-title-section">
                            <h2>${escapeHtml(article.title)}</h2>
                            <div class="news-modal-date">${escapeHtml(article.date)}</div>
                        </div>
                    </div>
                    <div class="news-modal-body">${article.body}</div>
                </div>`;
            modal.querySelector('.news-close-btn').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
            document.body.appendChild(modal);
        }

        // ── Loading screen ────────────────────────────────────────────────────
        window.addEventListener('load', function() {
            const ls = document.getElementById('loadingScreen');
            if (ls) setTimeout(() => { ls.style.display = 'none'; }, 3000);
        });

        // ── Init news/genius once apps load ───────────────────────────────────
        appsPromise.then(() => {
            if (appsLoaded) { renderGeniusPage(); renderNewsPage(); }
        }).catch(e => console.error(e));
