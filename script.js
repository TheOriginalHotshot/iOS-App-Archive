        let apps = [];
        let appsLoaded = false;

        // ── Deterministic per-app seed (used for star ratings) ──────────────
        function hashStr(s) {
            let h = 0;
            for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
            return Math.abs(h);
        }
        function getAppRating(app) {
            const seed = hashStr(app.id || app.title || '');
            // Rating: 2.5 – 5.0, steps of 0.5
            const steps = [2.5, 3.0, 3.5, 3.5, 4.0, 4.0, 4.0, 4.5, 4.5, 4.5, 5.0];
            return steps[seed % steps.length];
        }
        function getReviewCount(app) {
            const seed = hashStr((app.id || '') + 'rc');
            return 10 + (seed % 9981); // 10 – 9990
        }
        function renderStars(rating) {
            let html = '<span class="star-row">';
            for (let i = 1; i <= 5; i++) {
                if (rating >= i) html += '<i class="fas fa-star star-filled"></i>';
                else if (rating >= i - 0.5) html += '<i class="fas fa-star-half-alt star-filled"></i>';
                else html += '<i class="far fa-star star-empty"></i>';
            }
            html += '</span>';
            return html;
        }
        function renderRatingRow(app) {
            const r = getAppRating(app);
            const c = getReviewCount(app);
            return `<div class="app-rating-row">${renderStars(r)}<span class="rating-count">(${c.toLocaleString()})</span></div>`;
        }

        // ── HTML helpers ────────────────────────────────────────────────────
        function escapeHtml(v) {
            return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
        }
        function normalizeDevice(d) {
            const s = String(d ?? '').trim().toLowerCase();
            if (s === 'iphone') return 'iPhone';
            if (s === 'ipad') return 'iPad';
            if (s === 'ipod touch' || s === 'ipodtouch' || s === 'ipod') return 'iPod Touch';
            return null;
        }
        function getAppDevices(app) {
            const raw = app?.devices;
            const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            return Array.from(new Set(list.map(normalizeDevice).filter(Boolean)));
        }
        function renderDeviceIcons(app) {
            const devs = getAppDevices(app);
            if (!devs.length) return '';
            const parts = [];
            if (devs.includes('iPhone') || devs.includes('iPod Touch')) {
                const lbl = (devs.includes('iPhone') && devs.includes('iPod Touch')) ? 'iPhone & iPod Touch' : devs.includes('iPod Touch') ? 'iPod Touch' : 'iPhone';
                parts.push(`<span class="device-icon device-icon-iphone" title="${escapeHtml(lbl)}"><i class="fa-solid fa-mobile-screen-button"></i></span>`);
            }
            if (devs.includes('iPad')) parts.push(`<span class="device-icon device-icon-ipad" title="iPad"><i class="fa-solid fa-tablet-screen-button"></i></span>`);
            return `<span class="device-icons">${parts.join('')}</span>`;
        }
        function renderAppTitle(app) { return escapeHtml(app?.title); }

        // ── Data loading ─────────────────────────────────────────────────────
        async function fetchAppsData() {
            const r = await fetch('apps.json');
            if (!r.ok) throw new Error('Failed to load apps data.');
            const d = await r.json();
            if (!Array.isArray(d)) throw new Error('Apps data format error.');
            return d;
        }
        const appsPromise = fetchAppsData();

        // ── DOM refs ─────────────────────────────────────────────────────────
        const carouselContainer = document.getElementById('carouselContainer');
        const carousel          = document.getElementById('carousel');
        const carouselNav       = document.getElementById('carouselNav');
        const searchResults     = document.getElementById('searchResults');
        const searchContainer   = document.getElementById('searchContainer');
        const searchInput       = document.getElementById('searchInput');
        const cancelSearch      = document.getElementById('cancelSearch');
        const tabs              = document.querySelectorAll('.tab');
        const modalContainer    = document.getElementById('modalContainer');
        const tabContents = {
            featured:   document.getElementById('featuredContent'),
            categories: document.getElementById('categoriesContent'),
            genius:     document.getElementById('geniusContent'),
            search:     document.getElementById('searchContent'),
            updates:    document.getElementById('updatesContent')
        };

        // ── Carousel ─────────────────────────────────────────────────────────
        let currentIndex = 0, autoSlideInterval, touchStartX = 0, touchEndX = 0;

        function getDailyRandomApps(list, n) {
            const ds = new Date().toISOString().slice(0,10);
            let seed = 0;
            for (let i = 0; i < ds.length; i++) { seed = (seed << 5) - seed + ds.charCodeAt(i); seed |= 0; }
            function rand() {
                seed |= 0; seed = seed + 0x6D2B79F5 | 0;
                let t = Math.imul(seed ^ seed>>>15, 1|seed); t ^= t + Math.imul(t^t>>>7,61|t);
                return ((t^t>>>14)>>>0)/4294967296;
            }
            const a = [...list];
            for (let i = a.length-1; i>0; i--) { const j = Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
            return a.slice(0,n);
        }

        function initCarousel() {
            carousel.innerHTML = ''; carouselNav.innerHTML = '';
            if (!appsLoaded || !apps.length) { carousel.innerHTML='<p style="text-align:center;padding:20px;color:#aaa;">Loading…</p>'; return; }
            getDailyRandomApps(apps, 7).forEach((app, i) => {
                const item = document.createElement('div');
                item.className = 'carousel-item'; item.dataset.index = i;
                const rating = getAppRating(app);
                const reviews = getReviewCount(app);
                item.innerHTML = `
                    <div class="app-card">
                        <div class="app-icon-container"><div class="app-icon">
                            ${app.icon ? `<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : '<i class="fas fa-mobile-alt"></i>'}
                        </div></div>
                        <h3 class="app-title">${renderAppTitle(app)}</h3>
                        <div class="app-rating-row">${renderStars(rating)}<span class="rating-count">(${reviews.toLocaleString()})</span></div>
                        <div class="app-description">${app.featuredDescription}</div>
                        <button class="action-btn" data-app-id="${app.id}">Get</button>
                    </div>`;
                carousel.appendChild(item);
                const dot = document.createElement('div');
                dot.className='nav-dot'; dot.dataset.index=i;
                dot.addEventListener('click', ()=>goToSlide(i));
                carouselNav.appendChild(dot);
            });
            updateCarousel(); startAutoSlide(); setupSwipe();
            document.querySelectorAll('.app-card .action-btn').forEach(b => b.addEventListener('click', function(){ openModal(this.dataset.appId); }));
        }

        function updateCarousel() {
            const items = document.querySelectorAll('.carousel-item');
            const dots  = document.querySelectorAll('.nav-dot');
            const n = items.length;
            items.forEach((it,i) => {
                it.classList.remove('active','prev','next');
                if (i===currentIndex) it.classList.add('active');
                else if (i===(currentIndex-1+n)%n) it.classList.add('prev');
                else if (i===(currentIndex+1)%n) it.classList.add('next');
            });
            dots.forEach((d,i) => d.classList.toggle('active', i===currentIndex));
        }
        function goToSlide(i){ currentIndex=i; updateCarousel(); resetAutoSlide(); }
        function nextSlide(){ const n=document.querySelectorAll('.carousel-item').length; currentIndex=(currentIndex+1)%n; updateCarousel(); }
        function prevSlide(){ const n=document.querySelectorAll('.carousel-item').length; currentIndex=(currentIndex-1+n)%n; updateCarousel(); }
        function startAutoSlide(){ autoSlideInterval=setInterval(nextSlide,8000); }
        function resetAutoSlide(){ clearInterval(autoSlideInterval); startAutoSlide(); }
        function setupSwipe() {
            carouselContainer.addEventListener('touchstart', e=>{ touchStartX=e.changedTouches[0].screenX; }, false);
            carouselContainer.addEventListener('touchend',   e=>{ touchEndX=e.changedTouches[0].screenX; if(touchEndX<touchStartX-50)nextSlide(); if(touchEndX>touchStartX+50)prevSlide(); resetAutoSlide(); }, false);
        }

        // ── Action button (unified rectangular) ─────────────────────────────
        function actionBtn(appId, label='Get', extraClass='') {
            return `<button class="action-btn ${extraClass}" data-app-id="${appId}">${label}</button>`;
        }

        // ── Search ────────────────────────────────────────────────────────────
        let currentSearchFilteredApps = [];
        function renderSearchResults(filteredApps=[]) {
            currentSearchFilteredApps = filteredApps;
            const sorted = [...filteredApps].sort((a,b)=>a.title.localeCompare(b.title));
            searchResults.innerHTML = '';
            if (!sorted.length) {
                searchResults.innerHTML='<p style="text-align:center;padding:60px 20px;color:#999;">No apps found.</p>'; return;
            }
            const scroller = document.createElement('div');
            scroller.className='search-results-scroller'; scroller.id='searchScroller';
            sorted.forEach((app,i) => {
                const card = document.createElement('div');
                card.className='app-card-large'; card.dataset.index=i;
                card.innerHTML=`
                    <div class="card-header">
                        <div class="large-card-icon">${app.icon?`<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="card-info">
                            <div class="large-card-name">${renderAppTitle(app)}</div>
                            <div class="large-card-developer">${escapeHtml(app.developer)}</div>
                            <div class="large-card-rating">${renderStars(getAppRating(app))}<span class="rating-count-sm">(${getReviewCount(app).toLocaleString()})</span></div>
                        </div>
                        <button class="action-btn large-card-button" data-app-id="${app.id}">Get</button>
                    </div>`;
                scroller.appendChild(card);
            });
            searchResults.appendChild(scroller);
            const counter = document.createElement('div');
            counter.className='search-results-counter'; counter.id='searchCounter';
            counter.textContent=`1 of ${sorted.length} ${sorted.length===1?'app':'apps'}`;
            searchResults.appendChild(counter);
            const scrollEl=document.getElementById('searchScroller'), ctrEl=document.getElementById('searchCounter');
            scrollEl.scrollLeft=0;
            let isScrolling;
            scrollEl.addEventListener('scroll',function(){
                clearTimeout(isScrolling);
                isScrolling=setTimeout(()=>{
                    const cards=scrollEl.querySelectorAll('.app-card-large');
                    let ci=0,md=Infinity;
                    cards.forEach((c,i)=>{ const d=Math.abs((c.getBoundingClientRect().left+c.offsetWidth/2)-(scrollEl.getBoundingClientRect().left+scrollEl.offsetWidth/2)); if(d<md){md=d;ci=i;} });
                    ctrEl.textContent=`${ci+1} of ${sorted.length} ${sorted.length===1?'app':'apps'}`;
                },50);
            });
            searchResults.querySelectorAll('.action-btn').forEach(b=>b.addEventListener('click',function(){openModal(this.dataset.appId);}));
        }

        // ── Modal ─────────────────────────────────────────────────────────────
        function createModal(app) {
            const related = apps.filter(a=>a.id!==app.id&&(a.developer===app.developer||a.categories.some(c=>app.categories.includes(c)))).slice(0,8);
            let vItems='';
            if(app.versions.archived.length) vItems+=`<div class="version-group"><h4>Archived Versions</h4><ul class="version-list">${app.versions.archived.map(v=>`<li><span>${v.version}</span><a href="${v.url}" download class="download-button"><i class="fas fa-download"></i> Download IPA</a></li>`).join('')}</ul></div>`;
            if(app.versions.unarchived.length) vItems+=`<div class="version-group"><h4 class="unarchived-label">Unarchived Versions</h4><ul class="version-list">${app.versions.unarchived.map(v=>`<li>${v}</li>`).join('')}</ul></div>`;
            const catTags = app.categories.map(c=>`<span class="modal-category-tag pill-cat-tag">${c}</span>`).join('');
            const relHTML = related.map(ra=>`
                <div class="related-app-item">
                    <div class="related-app-icon">${ra.icon?`<img src="${ra.icon}" alt="${escapeHtml(ra.title)}" loading="lazy">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                    <div class="related-app-info" data-app-id="${ra.id}">
                        <div class="related-app-name">${escapeHtml(ra.title)}</div>
                        <div class="related-app-developer">${escapeHtml(ra.developer)}</div>
                        <div class="related-rating">${renderStars(getAppRating(ra))}</div>
                    </div>
                    <button class="action-btn related-app-get-btn" data-app-id="${ra.id}">Get</button>
                </div>`).join('');

            const rating=getAppRating(app), reviews=getReviewCount(app);
            const modal = document.createElement('div');
            modal.className='modal-overlay'; modal.id=`${app.id}Modal`;
            modal.innerHTML=`
                <div class="modal-sub-header">
                    <button class="modal-close-btn">Close</button>
                    <div class="modal-sub-header-title">Info</div>
                    <button class="modal-review-btn" data-app-id="${app.id}">Review</button>
                </div>
                <div class="modal-content">
                    <div class="modal-app-header">
                        <div class="modal-app-icon">${app.icon?`<img src="${app.icon}" alt="${escapeHtml(app.title)}" loading="lazy">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="modal-app-info">
                            <div class="modal-app-title">${escapeHtml(app.title)}</div>
                            <div class="modal-app-developer">${escapeHtml(app.developer)}</div>
                            <div class="modal-rating-row">${renderStars(rating)}<span class="rating-count-sm">(${reviews.toLocaleString()})</span></div>
                        </div>
                        <button class="action-btn modal-get-btn" data-app-id="${app.id}">Get</button>
                    </div>
                    <div class="modal-categories">${catTags}</div>
                    <div class="modal-tabs">
                        <button class="modal-tab-btn active" data-tab="details">App Details</button>
                        <button class="modal-tab-btn" data-tab="reviews">Reviews</button>
                        <button class="modal-tab-btn" data-tab="related">Related</button>
                    </div>
                    <div class="modal-tab-content active" id="details-content">
                        <div class="modal-screenshots-strip" id="screenshots-${app.id}">
                            <!-- screenshots injected by loadScreenshots() -->
                        </div>
                        <div class="modal-section"><h3><i class="fas fa-mobile-alt"></i> Compatibility</h3><p class="compatibility-text">${app.compatibility}</p></div>
                        <div class="modal-section"><h3><i class="fas fa-align-left"></i> App Store Description</h3>${app.description.split('\n').map(p=>`<p>${p}</p>`).join('')}</div>
                    </div>
                    <div class="modal-tab-content" id="reviews-content">
                        <div class="reviews-list" id="reviews-list-${app.id}">
                            <div class="reviews-empty-state">
                                <div class="reviews-empty-icon"><i class="fas fa-book-open-reader"></i></div>
                                <p class="reviews-empty-msg">No reviews yet.<br>Be the first!</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-tab-content" id="related-content">
                        <div class="related-apps-list">${relHTML||'<p style="text-align:center;color:#999;padding:20px;">No related apps found.</p>'}</div>
                    </div>
                </div>
                <div class="version-sheet-overlay">
                    <div class="version-sheet">
                        <h3 class="version-sheet-title"><i class="fas fa-clock-rotate-left"></i> Version History</h3>
                        <div class="versions-container">${vItems}</div>
                        <button class="dark-cancel-btn version-sheet-cancel">Cancel</button>
                    </div>
                </div>`;
            modalContainer.appendChild(modal);
            modal.querySelector('.modal-close-btn').addEventListener('click',()=>{ modal.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); });
            modal.querySelector('.modal-review-btn').addEventListener('click',()=>{ openReviewModal(app.id); });
            modal.querySelectorAll('.modal-tab-btn').forEach(btn=>btn.addEventListener('click',function(){
                modal.querySelectorAll('.modal-tab-btn').forEach(b=>b.classList.remove('active'));
                modal.querySelectorAll('.modal-tab-content').forEach(c=>c.classList.remove('active'));
                this.classList.add('active');
                modal.querySelector(`#${this.dataset.tab}-content`).classList.add('active');
                if (this.dataset.tab === 'reviews') renderReviewsList(app.id);
            }));
            modal.querySelector('.modal-get-btn').addEventListener('click',()=>modal.querySelector('.version-sheet-overlay').classList.add('active'));
            modal.querySelector('.version-sheet-cancel').addEventListener('click',()=>modal.querySelector('.version-sheet-overlay').classList.remove('active'));
            modal.querySelector('.version-sheet-overlay').addEventListener('click',function(e){ if(e.target===this)this.classList.remove('active'); });
            modal.querySelectorAll('.related-app-info').forEach(el=>el.addEventListener('click',function(){ const id=this.dataset.appId; modal.classList.remove('active'); setTimeout(()=>openModal(id),300); }));
            modal.querySelectorAll('.related-app-get-btn').forEach(btn=>btn.addEventListener('click',function(e){ e.stopPropagation(); const id=this.dataset.appId; modal.classList.remove('active'); setTimeout(()=>openModal(id),300); }));
            modal.addEventListener('click',function(e){ if(e.target===modal){ modal.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); } });
            // Load screenshots asynchronously
            loadScreenshots(app.id);
            return modal;
        }

        document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.active').forEach(m=>{ m.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); }); document.querySelectorAll('.version-sheet-overlay.active').forEach(s=>s.classList.remove('active')); } });


        // ── Screenshot loader ─────────────────────────────────────────────────
        // Convention: cdn/screenshots/<app-id>/<n>.<ext>
        // Tries n=1..8, extensions: jpeg, jpg, png
        async function loadScreenshots(appId) {
            const strip = document.getElementById(`screenshots-${appId}`);
            if (!strip) return;
            const exts = ['jpeg','jpg','png'];
            const found = [];
            for (let n = 1; n <= 8; n++) {
                for (const ext of exts) {
                    const url = `cdn/screenshots/${appId}/${n}.${ext}`;
                    try {
                        const resp = await fetch(url, { method: 'HEAD' });
                        if (resp.ok) { found.push({ url, ext }); break; }
                    } catch(e) {}
                }
            }
            if (!found.length) { strip.style.display='none'; return; }
            strip.innerHTML = `
                <div class="screenshots-header"><h3><i class="fas fa-images"></i> Screenshots</h3></div>
                <div class="screenshots-scroller">
                    ${found.map((s,i)=>`
                    <div class="screenshot-item">
                        <img src="${s.url}" alt="Screenshot ${i+1}" loading="lazy"
                             class="screenshot-img"
                             onclick="openScreenshotLightbox('${s.url}', ${i+1}, ${found.length}, ${JSON.stringify(found.map(x=>x.url))})">
                    </div>`).join('')}
                </div>`;
        }

        // ── Screenshot lightbox ───────────────────────────────────────────────
        function openScreenshotLightbox(url, index, total, allUrls) {
            const existing = document.getElementById('screenshotLightbox');
            if (existing) existing.remove();
            let current = index - 1;
            const lb = document.createElement('div');
            lb.id = 'screenshotLightbox';
            lb.className = 'screenshot-lightbox';
            function render() {
                lb.innerHTML = `
                    <div class="lb-backdrop"></div>
                    <div class="lb-content">
                        <button class="lb-close"><i class="fas fa-times"></i></button>
                        <button class="lb-prev" ${current===0?'disabled':''}><i class="fas fa-chevron-left"></i></button>
                        <img src="${allUrls[current]}" class="lb-img" alt="Screenshot ${current+1}">
                        <button class="lb-next" ${current===total-1?'disabled':''}><i class="fas fa-chevron-right"></i></button>
                        <div class="lb-counter">${current+1} / ${total}</div>
                    </div>`;
                lb.querySelector('.lb-close').onclick = () => { lb.remove(); document.body.style.overflow=''; };
                lb.querySelector('.lb-backdrop').onclick = () => { lb.remove(); document.body.style.overflow=''; };
                const prevBtn = lb.querySelector('.lb-prev');
                const nextBtn = lb.querySelector('.lb-next');
                if (prevBtn && !prevBtn.disabled) prevBtn.onclick = () => { current--; render(); };
                if (nextBtn && !nextBtn.disabled) nextBtn.onclick = () => { current++; render(); };
            }
            render();
            document.body.appendChild(lb);
            document.body.style.overflow = 'hidden';
        }


        // ── Per-app reviews stored in localStorage ───────────────────────────
        function getAppReviews(appId) {
            try {
                const raw = localStorage.getItem('reviews_' + appId);
                return raw ? JSON.parse(raw) : [];
            } catch(e) { return []; }
        }
        function saveAppReviews(appId, reviews) {
            try { localStorage.setItem('reviews_' + appId, JSON.stringify(reviews)); } catch(e) {}
        }

        function formatReviewTime(ts) {
            const d = new Date(ts);
            const now = new Date();
            const diff = Math.floor((now - d) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return Math.floor(diff/60) + 'm ago';
            if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
            if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
            return d.toLocaleDateString();
        }

        function renderReviewsList(appId) {
            const list = document.getElementById('reviews-list-' + appId);
            if (!list) return;
            const reviews = getAppReviews(appId);
            if (!reviews.length) {
                list.innerHTML = `<div class="reviews-empty-state">
                    <div class="reviews-empty-icon"><i class="fas fa-book-open-reader"></i></div>
                    <p class="reviews-empty-msg">No reviews yet.<br>Be the first!</p>
                </div>`;
                return;
            }
            list.innerHTML = '';
            reviews.forEach((rev, idx) => {
                const row = document.createElement('div');
                row.className = 'review-row' + (idx % 2 === 1 ? ' review-row-alt' : '');
                row.id = 'review-row-' + appId + '-' + idx;
                const ups    = rev.thumbsUp    || 0;
                const downs  = rev.thumbsDown  || 0;
                const rpts   = rev.reports     || 0;
                const isMine = !!rev.isMine;
                row.innerHTML = `
                    <div class="review-avatar"><i class="fas fa-user-circle"></i></div>
                    <div class="review-body">
                        <div class="review-time">${formatReviewTime(rev.timestamp)}</div>
                        <div class="review-text">${escapeHtml(rev.text)}</div>
                        <div class="review-actions">
                            <button class="review-thumb review-thumb-up ${rev.myVote==='up'?'voted-up':''}" data-idx="${idx}" data-app="${appId}">
                                <i class="fas fa-thumbs-up"></i><span class="thumb-count">${ups}</span>
                            </button>
                            <button class="review-thumb review-thumb-down ${rev.myVote==='down'?'voted-down':''}" data-idx="${idx}" data-app="${appId}">
                                <i class="fas fa-thumbs-down"></i><span class="thumb-count">${downs}</span>
                            </button>
                            ${isMine ? `<button class="review-action-btn review-delete-btn" data-idx="${idx}" data-app="${appId}" title="Delete review"><i class="fas fa-trash-can"></i></button>` : ''}
                            <button class="review-action-btn review-report-btn ${rev.iReported?'reported':''}" data-idx="${idx}" data-app="${appId}" title="Report review"><i class="fas fa-flag"></i></button>
                        </div>
                    </div>`;

                // Thumbs up
                row.querySelector('.review-thumb-up').addEventListener('click', function() {
                    const reviews = getAppReviews(appId);
                    const r = reviews[idx];
                    if (r.myVote === 'up') { r.myVote = null; r.thumbsUp = Math.max(0,(r.thumbsUp||0)-1); }
                    else { if(r.myVote==='down') r.thumbsDown=Math.max(0,(r.thumbsDown||0)-1); r.myVote='up'; r.thumbsUp=(r.thumbsUp||0)+1; }
                    saveAppReviews(appId, reviews);
                    renderReviewsList(appId);
                });
                // Thumbs down
                row.querySelector('.review-thumb-down').addEventListener('click', function() {
                    const reviews = getAppReviews(appId);
                    const r = reviews[idx];
                    if (r.myVote === 'down') { r.myVote = null; r.thumbsDown = Math.max(0,(r.thumbsDown||0)-1); }
                    else { if(r.myVote==='up') r.thumbsUp=Math.max(0,(r.thumbsUp||0)-1); r.myVote='down'; r.thumbsDown=(r.thumbsDown||0)+1; }
                    saveAppReviews(appId, reviews);
                    renderReviewsList(appId);
                });
                // Delete (own review only)
                const delBtn = row.querySelector('.review-delete-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', function() {
                        const rowEl = document.getElementById('review-row-' + appId + '-' + idx);
                        if (!rowEl) return;
                        // Collapse animation
                        rowEl.classList.add('review-collapse');
                        setTimeout(() => {
                            const reviews = getAppReviews(appId);
                            reviews.splice(idx, 1);
                            saveAppReviews(appId, reviews);
                            renderReviewsList(appId);
                        }, 420);
                    });
                }
                // Report
                const rptBtn = row.querySelector('.review-report-btn');
                if (rptBtn) {
                    rptBtn.addEventListener('click', function() {
                        if (rev.iReported) return; // already reported by this device
                        const reviews = getAppReviews(appId);
                        const r = reviews[idx];
                        r.iReported = true;
                        r.reports = (r.reports || 0) + 1;
                        saveAppReviews(appId, reviews);
                        rptBtn.classList.add('reported');
                        if (r.reports >= 4) {
                            // Auto-remove
                            const rowEl = document.getElementById('review-row-' + appId + '-' + idx);
                            if (rowEl) rowEl.classList.add('review-collapse');
                            setTimeout(() => {
                                reviews.splice(idx, 1);
                                saveAppReviews(appId, reviews);
                                renderReviewsList(appId);
                            }, 420);
                        }
                    });
                }
                list.appendChild(row);
            });
        }

        // ── Review write modal — V2.5 bottom slide-up sheet ──
        function openReviewModal(appId) {
            const existing = document.getElementById('reviewWriteModal');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'reviewWriteModal';
            overlay.className = 'review-write-overlay';
            overlay.innerHTML = `
                <div class="review-write-sheet">
                    <div class="review-write-header">
                        <div class="review-write-title">Write a Review</div>
                        <button class="review-write-cancel-btn dark-cancel-inline">Cancel</button>
                    </div>
                    <div class="review-write-body">
                        <div class="review-textarea-wrap" id="reviewTextareaWrap">
                            <textarea class="review-textarea" id="reviewTextarea" placeholder="Share your thoughts about this app…" maxlength="500"></textarea>
                        </div>
                        <button class="review-send-btn" id="reviewSendBtn">Send</button>
                    </div>
                </div>`;

            document.body.appendChild(overlay);
            overlay.offsetHeight;
            requestAnimationFrame(() => overlay.classList.add('active'));

            const textarea = overlay.querySelector('#reviewTextarea');
            const sendBtn  = overlay.querySelector('#reviewSendBtn');
            const wrap     = overlay.querySelector('#reviewTextareaWrap');
            const cancelBtn= overlay.querySelector('.review-write-cancel-btn');

            function closeReviewSheet() {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 380);
            }

            cancelBtn.addEventListener('click', closeReviewSheet);
            overlay.addEventListener('click', e => { if(e.target === overlay) closeReviewSheet(); });

            sendBtn.addEventListener('click', () => {
                const text = textarea.value.trim();
                if (!text) {
                    textarea.focus();
                    textarea.classList.add('review-shake');
                    setTimeout(() => textarea.classList.remove('review-shake'), 500);
                    return;
                }
                // Page-rip send animation
                wrap.classList.add('page-rip-out');
                setTimeout(() => {
                    const reviews = getAppReviews(appId);
                    reviews.unshift({ text, timestamp: Date.now(), thumbsUp: 0, thumbsDown: 0, myVote: null, isMine: true, reports: 0, iReported: false });
                    saveAppReviews(appId, reviews);
                    renderReviewsList(appId);
                    // Switch modal tab to Reviews
                    const modal = document.getElementById(appId + 'Modal');
                    if (modal) {
                        modal.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
                        modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
                        const revBtn = modal.querySelector('[data-tab="reviews"]');
                        const revContent = modal.querySelector('#reviews-content');
                        if (revBtn) revBtn.classList.add('active');
                        if (revContent) revContent.classList.add('active');
                    }
                    closeReviewSheet();
                }, 500);
            });

            setTimeout(() => textarea.focus(), 440);
        }


        // ── 3D Flip Full-Page Download Modal ─────────────────────────────────
        function openFlipDownload(app, parentModal) {
            const existing = document.getElementById('flipDownloadOverlay');
            if (existing) existing.remove();

            let vItems = '';
            if (app.versions && app.versions.archived && app.versions.archived.length) {
                vItems += app.versions.archived.map(v =>
                    `<div class="flip-version-row">
                        <div class="flip-version-info">
                            <span class="flip-version-label">Version ${escapeHtml(v.version)}</span>
                            <span class="flip-version-type">Archived IPA</span>
                        </div>
                        <a href="${escapeHtml(v.url)}" download class="flip-download-btn">
                            <i class="fas fa-cloud-arrow-down"></i> Download
                        </a>
                    </div>`
                ).join('');
            }
            if (app.versions && app.versions.unarchived && app.versions.unarchived.length) {
                vItems += app.versions.unarchived.map(v =>
                    `<div class="flip-version-row flip-version-unavailable">
                        <div class="flip-version-info">
                            <span class="flip-version-label">${escapeHtml(v)}</span>
                            <span class="flip-version-type">Not Archived</span>
                        </div>
                        <span class="flip-unavailable-badge"><i class="fas fa-ban"></i> Unavailable</span>
                    </div>`
                ).join('');
            }
            if (!vItems) {
                vItems = '<p class="flip-no-versions">No versions archived yet.</p>';
            }

            const overlay = document.createElement('div');
            overlay.id = 'flipDownloadOverlay';
            overlay.className = 'flip-overlay';
            overlay.innerHTML = `
                <div class="flip-scene">
                    <div class="flip-card" id="flipCard">
                        <!-- FRONT: invisible placeholder (shows through to the page) -->
                        <div class="flip-face flip-front"></div>
                        <!-- BACK: the full-page download panel -->
                        <div class="flip-face flip-back">
                            <div class="flip-back-header">
                                <button class="flip-close-btn">
                                    <i class="fas fa-chevron-left"></i> Close
                                </button>
                                <div class="flip-back-title">Download</div>
                                <div style="width:80px"></div>
                            </div>
                            <div class="flip-back-content">
                                <div class="flip-app-hero">
                                    <div class="flip-app-icon-wrap">
                                        ${app.icon ? `<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" class="flip-app-icon-img">` : '<i class="fas fa-mobile-alt flip-icon-placeholder"></i>'}
                                    </div>
                                    <div class="flip-app-title">${escapeHtml(app.title)}</div>
                                    <div class="flip-app-dev">${escapeHtml(app.developer || '')}</div>
                                </div>
                                <div class="flip-divider"></div>
                                <div class="flip-section-label"><i class="fas fa-clock-rotate-left"></i> Version History</div>
                                <div class="flip-versions-list">${vItems}</div>
                            </div>
                        </div>
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            // Trigger flip after brief delay (lets browser paint the overlay)
            overlay.offsetHeight;
            requestAnimationFrame(() => {
                overlay.classList.add('flip-visible');
                setTimeout(() => {
                    document.getElementById('flipCard').classList.add('flipped');
                }, 60);
            });

            // Close: flip back then remove
            overlay.querySelector('.flip-close-btn').addEventListener('click', () => {
                const card = document.getElementById('flipCard');
                card.classList.remove('flipped');
                setTimeout(() => {
                    overlay.classList.remove('flip-visible');
                    setTimeout(() => overlay.remove(), 350);
                }, 700);
            });
        }

        function openModal(appId) {
            let modal=document.getElementById(`${appId}Modal`), fresh=false;
            if(!modal){ const app=apps.find(a=>a.id===appId); if(!app){alert('App not found.');return;} modal=createModal(app); fresh=true; trackAppView(appId); }
            document.body.style.overflow='hidden'; setUrlParam('app',appId);
            if(fresh){ modal.offsetHeight; requestAnimationFrame(()=>modal.classList.add('active')); } else modal.classList.add('active');
        }

        // ── Tab switching ─────────────────────────────────────────────────────
        tabs.forEach(tab=>tab.addEventListener('click',function(){
            const name=this.dataset.tab;
            tabs.forEach(t=>t.classList.remove('active')); this.classList.add('active');
            Object.values(tabContents).forEach(c=>c.classList.remove('active'));
            carouselContainer.style.display='none'; searchContainer.style.display='none'; searchResults.classList.remove('active');
            if(name==='featured'){
                carouselContainer.style.display='block'; tabContents.featured.classList.add('active');
            } else if(name==='search'){
                searchContainer.style.display='block'; tabContents.search.classList.add('active');
                const em=document.getElementById('searchEmptyState');
                if(!appsLoaded){ searchResults.classList.remove('active'); if(em)em.style.display='flex'; return; }
                const q=getUrlParam('query'); if(q)searchInput.value=q;
                const term=q!==null?q:searchInput.value;
                if(term&&term.trim()){
                    searchResults.classList.add('active'); if(em)em.style.display='none';
                    renderSearchResults(filterAppsByQuery(term)); updateCancelVisibility();
                } else { searchResults.classList.remove('active'); if(em)em.style.display='flex'; }
            } else if(name==='categories'){
                tabContents.categories.classList.add('active');
                const cp=getUrlParam('category'); if(cp)renderAppsForCategory(cp); else renderCategoryList();
            } else if(name==='genius'){
                tabContents.genius.classList.add('active'); if(appsLoaded){ renderGeniusPage(); setTimeout(initGeniusPTR,120); }
            } else if(name==='updates'){
                tabContents.updates.classList.add('active'); renderNewsPage();
            }
        }));

        function filterAppsByQuery(q) {
            const nq=(q||'').toLowerCase().trim(); if(!nq)return apps;
            return apps.filter(a=>a.title.toLowerCase().includes(nq)||(a.developer||'').toLowerCase().includes(nq));
        }
        function updateCancelVisibility() {
            const has=searchInput.value.trim().length>0;
            if(document.activeElement===searchInput||has){cancelSearch.classList.add('visible');searchInput.classList.add('has-text');}
            else{cancelSearch.classList.remove('visible');searchInput.classList.remove('has-text');}
        }
        searchInput.addEventListener('input',function(){
            if(!appsLoaded)return; const t=this.value; setUrlParam('query',t);
            const em=document.getElementById('searchEmptyState');
            if(!t.trim()){searchResults.classList.remove('active');if(em)em.style.display='flex';}
            else{searchResults.classList.add('active');if(em)em.style.display='none';renderSearchResults(filterAppsByQuery(t));}
            updateCancelVisibility();
        });
        searchInput.addEventListener('focus',updateCancelVisibility);
        searchInput.addEventListener('blur',updateCancelVisibility);
        cancelSearch.addEventListener('click',function(){
            if(!appsLoaded)return; searchInput.value=''; searchInput.blur(); setUrlParam('query','');
            searchResults.classList.remove('active'); const em=document.getElementById('searchEmptyState'); if(em)em.style.display='flex';
            updateCancelVisibility();
        });

        // ── Init ──────────────────────────────────────────────────────────────
        document.addEventListener('DOMContentLoaded',async function(){
            try{ apps=await appsPromise; appsLoaded=true; }
            catch(e){ console.error(e); carousel.innerHTML='<p style="text-align:center;padding:20px;color:#aaa;">Failed to load apps.</p>'; tabContents.featured.classList.add('active'); return; }
            initCarousel();
            document.addEventListener('keydown',e=>{ if(!document.querySelector('.tab[data-tab="search"]').classList.contains('active')){ if(e.key==='ArrowRight')nextSlide(); else if(e.key==='ArrowLeft')prevSlide(); } });
            tabContents.featured.classList.add('active');
            const q=getUrlParam('query'); if(q){searchInput.value=q;tabs.forEach(t=>{if(t.dataset.tab==='search')t.click();});renderSearchResults(filterAppsByQuery(q));}
            const ap=getUrlParam('app'); if(ap)openModal(ap);
            const cp=getUrlParam('category'); if(cp){tabs.forEach(t=>{if(t.dataset.tab==='categories')t.click();});renderAppsForCategory(cp);}
        });

        function setUrlParam(k,v){const p=new URLSearchParams(window.location.search);if(v&&v.length)p.set(k,v);else p.delete(k);window.history.replaceState({},'',window.location.pathname+(p.toString()?'?'+p.toString():'')); }
        function getUrlParam(k){return new URLSearchParams(window.location.search).get(k);}
        function getAllCategories(){
            const s=new Set();
            apps.forEach(a=>{if(Array.isArray(a.categories))a.categories.forEach(c=>{
                // Normalise typo "Causal" -> "Casual", skip junk
                if(c==='Causal') c='Casual';
                if(c==='NoCategoryAssignedApps') return;
                s.add(c);
            });});
            return Array.from(s).sort();
        }

        // ── Category icon map (complete) ─────────────────────────────────────
        const CAT_ICONS = {
            'Games':               { icon:'fa-gamepad',         color:'#ff453a' },
            'Entertainment':       { icon:'fa-film',            color:'#ff9f0a' },
            'Food & Drink':        { icon:'fa-utensils',        color:'#32d74b' },
            'News':                { icon:'fa-newspaper',       color:'#64d2ff' },
            'Utilities':           { icon:'fa-wrench',          color:'#bf5af2' },
            'Social Networking':   { icon:'fa-users',           color:'#5e5ce6' },
            'Productivity':        { icon:'fa-briefcase',       color:'#30d158' },
            'Education':           { icon:'fa-graduation-cap',  color:'#ffd60a' },
            'Music':               { icon:'fa-music',           color:'#ff453a' },
            'Photo & Video':       { icon:'fa-camera',          color:'#0a84ff' },
            'Shopping':            { icon:'fa-shopping-bag',    color:'#ff9f0a' },
            'Travel':              { icon:'fa-plane',           color:'#64d2ff' },
            'Sports':              { icon:'fa-football-ball',   color:'#32d74b' },
            'Health & Fitness':    { icon:'fa-heartbeat',       color:'#ff453a' },
            'Finance':             { icon:'fa-dollar-sign',     color:'#30d158' },
            'Books':               { icon:'fa-book',            color:'#ffd60a' },
            'Reference':           { icon:'fa-book-open',       color:'#bf5af2' },
            'Business':            { icon:'fa-chart-line',      color:'#5e5ce6' },
            'Weather':             { icon:'fa-cloud-sun',       color:'#64d2ff' },
            'Lifestyle':           { icon:'fa-spa',             color:'#ff9f0a' },
            'Navigation':          { icon:'fa-map-marker-alt',  color:'#32d74b' },
            'Medical':             { icon:'fa-stethoscope',     color:'#ff453a' },
            'Kids':                { icon:'fa-child',           color:'#ffd60a' },
            'Stickers':            { icon:'fa-sticky-note',     color:'#ff9f0a' },
            'Developer Tools':     { icon:'fa-code',            color:'#5e5ce6' },
            'Graphics & Design':   { icon:'fa-palette',         color:'#bf5af2' },
            'Action':              { icon:'fa-bolt',            color:'#ff453a' },
            'Adventure':           { icon:'fa-mountain',        color:'#32d74b' },
            'Arcade':              { icon:'fa-robot',           color:'#ff9f0a' },
            'Board':               { icon:'fa-chess',           color:'#5e5ce6' },
            'Card':                { icon:'fa-clone',           color:'#bf5af2' },
            'Casino':              { icon:'fa-dice',            color:'#ffd60a' },
            'Casual':              { icon:'fa-square',          color:'#32d74b' },
            'Causal':              { icon:'fa-square',          color:'#32d74b' },
            'Beer':                { icon:'fa-wine-glass',       color:'#ff9f0a' },
            'Fighting':            { icon:'fa-khanda',           color:'#ff453a' },
            'General':             { icon:'fa-circle-dot',       color:'#aaa' },
            'NoCategoryAssignedApps': { icon:'fa-circle-question', color:'#aaa' },
            'Family':              { icon:'fa-home',            color:'#ffd60a' },
            'Puzzle':              { icon:'fa-puzzle-piece',    color:'#5e5ce6' },
            'Racing':              { icon:'fa-flag-checkered',  color:'#ff453a' },
            'Role Playing':        { icon:'fa-hat-wizard',      color:'#bf5af2' },
            'Simulation':          { icon:'fa-cogs',            color:'#64d2ff' },
            'Sports Games':        { icon:'fa-basketball-ball', color:'#ff9f0a' },
            'Strategy':            { icon:'fa-chess-king',      color:'#5e5ce6' },
            'Trivia':              { icon:'fa-question-circle', color:'#ffd60a' },
            'Word':                { icon:'fa-font',            color:'#32d74b' },
            'Music':               { icon:'fa-music',           color:'#ff453a' },
            'Photo & Video':       { icon:'fa-camera',          color:'#0a84ff' },
            'Health & Fitness':    { icon:'fa-heart-pulse',     color:'#ff453a' },
            'Social Networking':   { icon:'fa-users',           color:'#5e5ce6' },
            'Productivity':        { icon:'fa-briefcase',       color:'#30d158' },
            'Travel':              { icon:'fa-plane',           color:'#64d2ff' },
            'Sports':              { icon:'fa-trophy',          color:'#ff9f0a' },
            'Navigation':          { icon:'fa-location-dot',    color:'#32d74b' },
            'Weather':             { icon:'fa-cloud-sun',       color:'#64d2ff' },
            'News':                { icon:'fa-newspaper',       color:'#64d2ff' },
            'Books':               { icon:'fa-book',            color:'#ffd60a' },
            'Reference':           { icon:'fa-book-open',       color:'#bf5af2' },
            'Medical':             { icon:'fa-stethoscope',     color:'#ff453a' },
            'Catalogs':            { icon:'fa-rectangle-list',  color:'#ff9f0a' },
            'Kids':                { icon:'fa-child-reaching',  color:'#ffd60a' },
            'Food & Drink':        { icon:'fa-utensils',        color:'#32d74b' },
            'Shopping':            { icon:'fa-bag-shopping',    color:'#ff9f0a' },
            'Finance':             { icon:'fa-coins',           color:'#30d158' },
            'Lifestyle':           { icon:'fa-star',            color:'#ff9f0a' },
            'Graphics & Design':   { icon:'fa-pen-nib',         color:'#bf5af2' },
            'Developer Tools':     { icon:'fa-code',            color:'#5e5ce6' },
            'Stickers':            { icon:'fa-face-smile',      color:'#ffd60a' }
        };
        function getCatIcon(cat){ return CAT_ICONS[cat]||{icon:'fa-th-large',color:'#aaa'}; }

        // ── Categories: horizontal rows ───────────────────────────────────────
        function renderCategoryList() {
            const cc=tabContents.categories; cc.innerHTML='';
            if(!appsLoaded||!apps.length){ cc.innerHTML='<p style="text-align:center;padding:20px;color:#aaa;">Loading…</p>'; return; }
            const wrap=document.createElement('div'); wrap.className='categories-horizontal-wrap category-fade-in';
            getAllCategories().forEach(cat=>{
                const appsInCat=apps.filter(a=>Array.isArray(a.categories)&&a.categories.includes(cat));
                if(!appsInCat.length)return;
                const ico=getCatIcon(cat);
                const sec=document.createElement('div'); sec.className='cat-section';
                const hdr=document.createElement('div'); hdr.className='cat-section-header';
                hdr.innerHTML=`
                    <div class="cat-section-title-row">
                        <span class="cat-section-icon" style="color:${ico.color}"><i class="fas ${ico.icon}"></i></span>
                        <span class="cat-section-title">${escapeHtml(cat)}</span>
                    </div>
                    <button class="action-btn cat-see-all-btn" data-cat="${escapeHtml(cat)}">See All</button>`;
                hdr.querySelector('.cat-see-all-btn').addEventListener('click',()=>{ setUrlParam('category',cat); renderAppsForCategory(cat); });
                sec.appendChild(hdr);
                const scroller=document.createElement('div'); scroller.className='cat-apps-scroller';
                appsInCat.slice(0,12).forEach(app=>{
                    const card=document.createElement('div'); card.className='cat-app-card';
                    card.innerHTML=`
                        <div class="cat-app-icon">${app.icon?`<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="cat-app-name">${escapeHtml(app.title)}</div>
                        <div class="cat-app-developer">${escapeHtml(app.developer)}</div>
                        <div class="cat-mini-stars">${renderStars(getAppRating(app))}</div>
                        <button class="action-btn cat-get-btn" data-app-id="${app.id}">Get</button>`;
                    card.querySelector('.action-btn').addEventListener('click',function(){openModal(this.dataset.appId);});
                    scroller.appendChild(card);
                });
                sec.appendChild(scroller); wrap.appendChild(sec);
            });
            cc.appendChild(wrap);
        }

        function renderAppsForCategory(cat){
            // ── Open as a full-page slide-up overlay (same as app modal) ──
            // Remove any existing one first
            const existingOverlay = document.getElementById('seeAllOverlay');
            if(existingOverlay) existingOverlay.remove();

            const overlay = document.createElement('div');
            overlay.className = 'seeall-overlay';
            overlay.id = 'seeAllOverlay';

            const ico = getCatIcon(cat);
            overlay.innerHTML = `
                <div class="seeall-sub-header">
                    <button class="seeall-back-btn modal-close-btn">
                        <i class="fa-solid fa-chevron-left"></i> Categories
                    </button>
                    <span class="seeall-title">See All</span>
                    <div style="width:90px;"></div>
                </div>
                <div class="seeall-content" id="seeAllContent">
                    <div class="seeall-hero">
                        <div class="seeall-hero-icon" style="color:${ico.color}"><i class="fas ${ico.icon}"></i></div>
                        <div class="seeall-hero-name">${escapeHtml(cat)}</div>
                        <div class="seeall-hero-line"></div>
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            // Build grid
            const contentEl = overlay.querySelector('#seeAllContent');
            const filtered = apps.filter(a=>Array.isArray(a.categories)&&a.categories.includes(cat));
            const sorted = [...filtered].sort((a,b)=>a.title.localeCompare(b.title));

            if(!sorted.length){
                const p=document.createElement('p');
                p.textContent='No apps in this category.';
                p.style.cssText='text-align:center;color:#999;padding:40px 20px;';
                contentEl.appendChild(p);
            } else {
                const grid=document.createElement('div');
                grid.className='category-apps-grid category-fade-in';
                sorted.forEach(app=>{
                    const card=document.createElement('div'); card.className='cat-app-card-grid';
                    card.innerHTML=`
                        <div class="cat-app-icon-grid">${app.icon?`<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-mobile-alt\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="cat-app-name-grid">${escapeHtml(app.title)}</div>
                        <div class="cat-app-dev-grid">${escapeHtml(app.developer)}</div>
                        <div class="cat-mini-stars">${renderStars(getAppRating(app))}</div>
                        <button class="action-btn" data-app-id="${app.id}">Get</button>`;
                    card.querySelector('.action-btn').addEventListener('click',function(){
                        const appId=this.dataset.appId;
                        // Close See All overlay first, then open modal
                        const ov=document.getElementById('seeAllOverlay');
                        if(ov){ ov.classList.remove('active'); setTimeout(()=>{ ov.remove(); document.body.style.overflow='auto'; openModal(appId); },320); }
                        else openModal(appId);
                    });
                    grid.appendChild(card);
                });
                contentEl.appendChild(grid);
            }

            // Back button closes overlay
            overlay.querySelector('.seeall-back-btn').addEventListener('click',()=>{
                overlay.classList.remove('active');
                setTimeout(()=>overlay.remove(), 380);
                setUrlParam('category','');
                document.body.style.overflow='auto';
            });

            // Animate in
            document.body.style.overflow='hidden';
            overlay.offsetHeight; // force reflow
            requestAnimationFrame(()=>overlay.classList.add('active'));
        }

        // ── Genius: sticky header + vertical list ─────────────────────────────
        let viewedApps=[], MAX_VIEWED=20;
        function loadViewedApps(){ try{ const s=localStorage.getItem('viewedApps'); if(s)viewedApps=JSON.parse(s); }catch(e){viewedApps=[];} }
        loadViewedApps();
        function trackAppView(id){ if(!viewedApps.includes(id)){ viewedApps.unshift(id); if(viewedApps.length>MAX_VIEWED)viewedApps=viewedApps.slice(0,MAX_VIEWED); try{localStorage.setItem('viewedApps',JSON.stringify(viewedApps));}catch(e){} } }
        function getGeniusRecs(){
            if(!appsLoaded||!apps.length)return[];
            if(!viewedApps.length)return getDailyRandomApps(apps,16);
            const viewed=viewedApps.map(id=>apps.find(a=>a.id===id)).filter(Boolean);
            const cats=new Set(), devs=new Set();
            viewed.forEach(a=>{ (a.categories||[]).forEach(c=>cats.add(c)); if(a.developer)devs.add(a.developer); });
            const scored=apps.filter(a=>!viewedApps.includes(a.id)).map(a=>{ let s=(a.categories||[]).filter(c=>cats.has(c)).length*10; if(devs.has(a.developer))s+=5; s+=Math.random()*2; return{a,s}; });
            scored.sort((x,y)=>y.s-x.s); return scored.slice(0,16).map(x=>x.a);
        }

        function isGeniusEnabled() {
            try { return localStorage.getItem('geniusEnabled') === 'yes'; } catch(e) { return false; }
        }
        function enableGenius() {
            try { localStorage.setItem('geniusEnabled','yes'); } catch(e) {}
        }
        function disableGenius() {
            try { localStorage.removeItem('geniusEnabled'); } catch(e) {}
        }

        function renderGeniusSplash(gc) {
            gc.innerHTML = '';
            const splash = document.createElement('div');
            splash.className = 'genius-splash';
            splash.innerHTML = `
                <div class="genius-splash-inner">
                    <div class="gs-icon-wrap"><i class="fas fa-atom gs-atom"></i></div>
                    <div class="gs-line"></div>
                    <h2 class="gs-title">Genius</h2>
                    <p class="gs-subtitle">Discover apps you never knew you were missing.</p>
                    <div class="gs-line"></div>
                    <ul class="gs-features">
                        <li><i class="fas fa-eye gs-feat-icon"></i><span>Learns from what you browse</span></li>
                        <li><i class="fas fa-sliders gs-feat-icon"></i><span>Personalised to your taste</span></li>
                        <li><i class="fas fa-lock gs-feat-icon"></i><span>Stays on your device — no data sent</span></li>
                    </ul>
                    <div class="gs-line"></div>
                    <button class="gs-start-btn" id="gsStartBtn"><i class="fas fa-atom"></i> Start Using Genius</button>
                </div>`;
            gc.appendChild(splash);
            document.getElementById('gsStartBtn').addEventListener('click', () => {
                enableGenius();
                renderGeniusPage();
            });
        }

        function renderGeniusPage(){
            const gc=document.getElementById('geniusContent'); if(!gc)return;
            // Show splash if not enabled
            if(!isGeniusEnabled()){ renderGeniusSplash(gc); return; }
            gc.innerHTML='';
            const scrollArea=document.createElement('div'); scrollArea.className='page-scroll-area';
            const recs=getGeniusRecs();
            if(!recs.length){
                const msg=document.createElement('p'); msg.textContent='Browse apps to get personalised suggestions!';
                msg.style.cssText='text-align:center;color:#999;padding:40px 20px;'; scrollArea.appendChild(msg);
            } else {
                const list=document.createElement('div'); list.className='genius-list';
                recs.forEach((app,i)=>{
                    const item=document.createElement('div'); item.className='genius-list-item';
                    item.style.animationDelay=`${i*0.03}s`;
                    const reasons=['Because you explore','Similar to your picks','Trending nearby','Matches your taste','Fans also love'];
                    const reason=reasons[i%reasons.length];
                    item.innerHTML=`
                        <div class="genius-app-icon">${app.icon?`<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\'fas fa-mobile-alt\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="genius-app-info" data-app-id="${app.id}">
                            <div class="genius-app-name">${escapeHtml(app.title)}</div>
                            <div class="genius-app-dev">${escapeHtml(app.developer||'Unknown')}</div>
                            <div class="genius-mini-stars">${renderStars(getAppRating(app))}</div>
                            <div class="genius-reason"><i class="fas fa-atom genius-atom-icon"></i>${reason}</div>
                        </div>
                        <button class="action-btn genius-get-btn" data-app-id="${app.id}">Get</button>`;
                    item.querySelector('.genius-app-info').addEventListener('click',function(){openModal(this.dataset.appId);});
                    item.querySelector('.action-btn').addEventListener('click',function(){openModal(this.dataset.appId);});
                    list.appendChild(item);
                });
                scrollArea.appendChild(list);
            }
            // Opt-out button at bottom
            const optOut = document.createElement('div');
            optOut.className = 'genius-opt-out-wrap';
            optOut.innerHTML = '<button class="genius-opt-out-btn"><i class="fas fa-xmark"></i> Disable Genius Recommendations</button>';
            optOut.querySelector('.genius-opt-out-btn').addEventListener('click', () => {
                disableGenius();
                renderGeniusPage();
            });
            scrollArea.appendChild(optOut);
            gc.appendChild(scrollArea);
        }

        // ── News ──────────────────────────────────────────────────────────────
        const NEWS_ARTICLES=[
            {
                id:'v303',icon:'fa-screwdriver-wrench',title:'iOS App Archive V3.0.3',date:'May 17, 2026',badge:'V3.0.3',
                preview:'App modal fix, settings polish, genius badge fix, favourites removed, category icon additions, duplicate category fix.',
                body:`<h3>🔧 V3.0.3 — Critical Fixes</h3>
<h3>✅ App Modal Fixed</h3><ul>
<li>The "Get" button on app cards now correctly opens the App Details modal. The issue was caused by a JavaScript function redeclaration that silently broke the modal opener.</li>
</ul>
<h3>⚙️ Settings Panel Polish</h3><ul>
<li>Settings title centred. Larger text throughout. Gear button is now ingrained, right-aligned in the header with a visible border.</li>
<li>Fixed z-index issue where settings elements appeared in front of the blurred header.</li>
<li>On/Off labels added to all toggle switches.</li>
</ul>
<h3>🔴 Genius Badge Fixed</h3><ul>
<li>Badge now correctly appears top-right of the Genius tab icon (no longer cut off or misaligned).</li>
<li>Added a glow-pulse animation and glossy finish to the badge.</li>
</ul>
<h3>🗂️ Categories</h3><ul>
<li>Added icons for Beer (drink glass), Fighting (sword), Casual (square), General, and others.</li>
<li>Fixed duplicate "Casual/Causal" category row — now appears only once.</li>
</ul>
<h3>🚫 Favourites Removed</h3><ul>
<li>The favourites feature was removed due to instability. It will return in a future update.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v302',icon:'fa-tools',title:'iOS App Archive V3.0.2',date:'May 16, 2026',badge:'V3.0.2',
                preview:'PTR fixed, Favourites, Recently Viewed, Settings panel, Genius badge, keyboard shortcuts, and more.',
                body:`<h3>🛠️ V3.0.2 — New Features & Fixes</h3>
<h3>🔄 Pull-to-Refresh Fixed</h3><ul>
<li>The Genius page pull-to-refresh now reliably appears and works. The gooey clock indicator bounces in smoothly and spins while refreshing.</li>
</ul>
<h3>❤️ Favourites</h3><ul>
<li>Tap the heart icon on any App Details page to save it to your Favourites list.</li>
<li>Tap the heart icon in the site header to view all your saved apps.</li>
<li>Favourites are stored locally in your browser.</li>
</ul>
<h3>🕐 Recently Viewed</h3><ul>
<li>A "Recently Viewed" row appears on the Featured tab after you open your first app — showing up to 12 of your most recently viewed apps as quick-tap cards.</li>
</ul>
<h3>⚙️ Settings Panel</h3><ul>
<li>Tap the gear icon in the header to open Settings.</li>
<li>Choose from 6 accent colours (applied site-wide).</li>
<li>Toggle star ratings, device icons, and reduced motion on/off.</li>
<li>Clear recently viewed, favourites, or Genius viewing history.</li>
</ul>
<h3>🔴 Genius Badge</h3><ul>
<li>The Genius tab icon now shows a red badge with the number of current recommendations.</li>
</ul>
<h3>⌨️ Keyboard Shortcut</h3><ul>
<li>Press <strong>/</strong> anywhere on the site to instantly jump to Search.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v301',icon:'fa-wand-magic-sparkles',title:'iOS App Archive V3.0.1',date:'May 15, 2026',badge:'V3.0.1',
                preview:'Loading animation fix, Genius splash screen, pull-to-refresh fix, category hero headers, pencil review icon, download modal polish, and site-wide animation crisp.',
                body:`<h3>✨ V3.0.1 — Polish & Fixes</h3>
<h3>🌅 Loading Animation</h3><ul>
<li>New smooth Apple-style scale-up splash: the loader scales and fades out, the page scales in from 0.96 to 1.0 with a spring bounce. No lag.</li>
</ul>
<h3>⚛️ Genius Splash Screen</h3><ul>
<li>First visit to the Genius tab shows a metallic black intro screen explaining how Genius works, with a glossy Start button.</li>
<li>An "Opt out of Genius" link at the bottom of the list lets you reset and see the splash again.</li>
</ul>
<h3>🔄 Pull-to-Refresh Fixed</h3><ul>
<li>PTR indicator now reliably appears and works on the Genius page with a smooth gooey bounce animation.</li>
</ul>
<h3>🗂️ Category Hero Header</h3><ul>
<li>The See All overlay now shows the category icon (enlarged) and category name centered at the top, with an ingrained separator line before the grid.</li>
</ul>
<h3>📝 Review Empty State</h3><ul>
<li>Empty reviews tab now shows a larger pencil icon (fa-pencil) ingrained into the surface.</li>
</ul>
<h3>💾 Download Modal Polish</h3><ul>
<li>Download link text is now white. Added a history icon next to "Version History". Download buttons are metallic black with ingrained text. Smoother popup animation.</li>
</ul>
<h3>🎠 Featured Cards Depth</h3><ul>
<li>Stronger 3D perspective and deeper shadows on active/side carousel cards.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v30',icon:'fa-rocket',title:'iOS App Archive V3.0',date:'May 14, 2026',badge:'V3.0',
                preview:'3D carousel cards, gooey pull-to-refresh, Genius icon + reason labels, larger search cards, V2.5-style download & review modals, opening animation, ingrained depth lines, and full-site polish.',
                body:`<h3>🚀 V3.0 — The Polish Release</h3>
<h3>🎠 3D Carousel Cards</h3><ul>
<li>Featured cards now have a true 3D depth effect with perspective and layered shadows.</li>
<li>Side cards curve and tilt with a stronger CoverFlow angle for a premium feel.</li>
<li>Scroll transitions are buttery smooth with optimised cubic-bezier easing.</li>
</ul>
<h3>🫧 Gooey Pull-to-Refresh (Genius Page)</h3><ul>
<li>Pull down past the top of the Genius page to trigger an animated skeuomorphic refresh button.</li>
<li>A clock/back-in-time icon is ingrained into the button and animates while refreshing.</li>
</ul>
<h3>⚛️ Genius Icon + Reason Labels</h3><ul>
<li>Each Genius recommendation now shows an ingrained atom icon and a short "Because you viewed…" reason.</li>
</ul>
<h3>📝 Empty Reviews Placeholder</h3><ul>
<li>When no reviews exist, a pencil-and-notepad icon is ingrained into the Reviews tab — it disappears as soon as a review is posted.</li>
</ul>
<h3>🔍 Larger Search Cards</h3><ul>
<li>Search result cards are taller and more spacious for easier tapping.</li>
<li>Scroll logic smoothed with momentum and snap improvements.</li>
</ul>
<h3>💾 Restored V2.5 Download & Review Modals</h3><ul>
<li>Download modal reverts to the clean slide-up sheet with enhanced visual details.</li>
<li>Review modal reverts to the bottom slide-up sheet with metallic texture.</li>
</ul>
<h3>🌅 New Opening Animation</h3><ul>
<li>The loading screen now uses a smooth scale-up reveal instead of a fall-down, with a spring bounce.</li>
</ul>
<h3>📰 News Page Icon Polish</h3><ul>
<li>News icons are glossier and more ingrained into their dark circular backgrounds.</li>
<li>Depth separator lines added throughout the site — between columns, tabs, and sections.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v26',icon:'fa-layer-group',title:'iOS App Archive v2.6',date:'May 12, 2026',badge:'V2.6',
                preview:'OS X sheet review modal, 3D flip download page, Categories back button polish, and more.',
                body:`<h3>🎬 What's New in v2.6</h3>
<h3>📄 OS X Sheet Review Modal</h3>
<ul>
<li>Tapping the <strong>Review button</strong> now drops the write-review form as a classic <strong>OS X sheet</strong> — it slides down from the app info header bar with a springy cubic-bezier easing, exactly like a macOS Print/Save dialog.</li>
<li>Dismissing the sheet slides it back up smoothly.</li>
</ul>
<h3>🔄 3D Flip Download Page</h3>
<ul>
<li>Tapping <strong>Get</strong> on an app now triggers a <strong>full-page 3D revolving-door flip</strong> — the screen turns like a card, revealing the download panel on the reverse side.</li>
<li>The download page shows the app icon, name, developer, and a full version history with large download buttons.</li>
<li>Tapping Close flips the card back to the app info page.</li>
</ul>
<h3>🔙 Categories Back Button</h3>
<ul>
<li>The "Categories" back button on the See All page now uses the <strong>exact same design</strong> as the Close and Review buttons on the app info header.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v25',icon:'fa-pen-to-square',title:'iOS App Archive v2.5',date:'May 11, 2026',badge:'V2.5',
                preview:'Reviews system, per-app local storage, page-rip send animation, delete/report reviews, metallic modal textures, scroll clipping fixes, and more.',
                body:`<h3>✍️ Reviews System</h3>
<ul>
<li><strong>New Reviews tab</strong> on every app detail page — sits between App Details and Related.</li>
<li>Tap the <strong>Review button</strong> (top-right of the info bar) to write a review for that specific app.</li>
<li><strong>Page-rip animation</strong> — the text field curls backward and tears off screen when you hit Send.</li>
<li>Reviews show a default profile icon, relative timestamp (just now / 3m ago / 2d ago), and your text.</li>
<li>Alternating white/grey row striping, same as the Related Apps list.</li>
</ul>
<h3>👍 Thumbs Up / Down & Report</h3>
<ul>
<li>Each review has ingrained thumbs up (turns green) and thumbs down (turns red) buttons with live counts.</li>
<li><strong>Trash can icon</strong> to delete your own review with a collapse animation.</li>
<li><strong>Flag icon</strong> to report a review — turns yellow on click. After 4 reports the review is auto-removed.</li>
</ul>
<h3>💾 Local Storage</h3>
<ul><li>Reviews and votes are stored in the browser's localStorage — per-app, no server required.</li></ul>
<h3>🎨 Modal Texture & Etched Buttons</h3>
<ul>
<li>Review and Download modals now use a <strong>metallic brushed texture</strong> with etched/ingrained buttons.</li>
<li>All popup button text is etched into the surface — deeper inset shadow, no outer glow.</li>
</ul>
<h3>🔧 Fixes</h3>
<ul>
<li>Removed blur from header and tab bar — reverted to solid dark gradients.</li>
<li>Genius, Categories, and News scroll containers now use correct padding so content is never hidden behind the header or tab bar.</li>
<li>Review button updated to exactly match the Close button design.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v24',icon:'fa-wand-sparkles',title:'iOS App Archive v2.4',date:'May 10, 2026',badge:'V2.4',
                preview:'Smoother scrolling, pull-to-refresh, coverflow carousel polish, liquid-glass download modal, header blur, and more.',
                body:`<h3>✨ What's New in v2.4</h3>
<h3>📜 Smoother Scrolling Everywhere</h3><ul>
<li>All scrollable pages (Genius, News, Categories, modal) now use momentum scrolling with smooth easing.</li>
<li>Scroll containers use <strong>overscroll-behavior</strong> and GPU-composited layers for buttery performance.</li>
</ul>
<h3>🔄 Pull to Refresh</h3><ul>
<li>On mobile, pull down from the top of any list page (Genius, News, Categories) to trigger a refresh animation with rubber-band physics.</li>
<li>On desktop, scroll past the top with the mouse wheel to trigger the same effect.</li>
</ul>
<h3>🎡 Carousel Coverflow Polish</h3><ul>
<li>Side cards (prev/next) now have a stronger curve/scale and perspective tilt for a true CoverFlow feel.</li>
<li>Navigation dots redesigned: the active dot is a rounded pill shape with a soft glow.</li>
</ul>
<h3>💧 Liquid-Glass Download Modal</h3><ul>
<li>The download sheet overlay now uses a frosted-glass blur backdrop.</li>
<li>When the sheet opens, the page behind it scales back with a depth push effect.</li>
<li>Closing the sheet brings the page smoothly back to full focus.</li>
</ul>
<h3>🔍 Search Icon Depth</h3><ul>
<li>The magnifying glass icon on the search page has a deeper ingrained/engraved shadow effect.</li>
</ul>
<h3>📰 News Page Cleanup</h3><ul>
<li>Removed the pill-shaped version badge from each news card for a cleaner look.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v23',icon:'fa-cloud-arrow-down',title:'iOS App Archive v2.3',date:'May 8, 2026',badge:'V2.3',
                preview:'Major visual polish — 3D cloud loading screen, glossy app icon overlays, iOS 6 Get button, alternating list rows, edge-to-edge pages, and lots more.',
                body:`<h3>🌟 What's New in v2.3</h3>
<h3>🔄 Header & Branding</h3><ul><li><strong>White monochrome logo</strong> restored in the main header.</li></ul>
<h3>☁️ New Loading Screen</h3><ul><li>Redesigned: <strong>3D cloud with glowing animated download arrow</strong> and progress bar.</li></ul>
<h3>✨ Glossy App Icon Overlay</h3><ul><li>Every app icon now has a <strong>classic iOS glass-bubble gloss overlay</strong> on the top half.</li></ul>
<h3>⭐ Improved Star Ratings</h3><ul><li>Filled stars: richer orange-gold with glossy drop-shadow. Empty stars: soft grey depth inset.</li></ul>
<h3>🔲 iOS 6 Get Button</h3><ul><li>More ingrained — deeper inset shadow, reduced outer lift — matching the original iOS 6 App Store.</li></ul>
<h3>📰 Edge-to-Edge Pages</h3><ul><li>Categories and What's New tabs are now fully edge-to-edge.</li><li>What's New shows alternating full-width list rows instead of floating cards.</li></ul>
<h3>🐛 Bug Fix — See All + Get</h3><ul><li>Get inside See All now closes the overlay first, then opens App Details correctly.</li></ul>
<h3>🎨 Category Tags & Back Button</h3><ul><li>Category tags on App Details are now light whitish-grey ingrained pills.</li><li>See All back button has a proper bordered ingrained style.</li></ul>
<h3>🔀 Alternating Row Colours</h3><ul><li>Related Apps and Genius rows alternate between two shades — classic iOS 6 UITableView striping.</li></ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v2021',icon:'fa-screwdriver-wrench',title:'iOS App Archive v2.0.2.1',date:'May 7, 2026',badge:'PATCH',
                preview:'Bug fixes and polish — full-width sticky page headers, z-index isolation for Genius/News tabs, rectangular "See All" category header, pill-shaped category tags, and a proper dark Cancel button in the version sheet.',
                body:`<h3>🐛 Bug Fixes</h3>
<ul>
<li><strong>Genius & News sticky headers</strong> — Sub-header bars are now full-width and the same height as the main nav header (60 px), sitting flush against it. They no longer appear truncated or mis-sized.</li>
<li><strong>Genius content no longer bleeds into What's New / Search</strong> — Fixed stacking context so each tab is fully isolated. The search container z-index has been corrected so it no longer renders behind other tabs.</li>
<li><strong>Version-sheet Cancel button</strong> — The Cancel button in the IPA download sheet is now correctly styled as a dark rounded pill (matching iOS action-sheet cancel style) instead of the grey rectangular action button used by Get/See All.</li>
</ul>
<h3>✨ New Additions</h3>
<ul>
<li><strong>Categories "See All" header</strong> — Tapping See All on a category now opens a dedicated sub-page with a full-width black nav bar (identical to the main header) showing "See All" centred and ingrained, with a black chevron back-button labelled "Categories" on the left.</li>
<li><strong>Pill-shaped category tags on App Details</strong> — The category chips on every app detail page are now pill-shaped with a dark inset gradient and ingrained text shadow, matching the iOS 6 aesthetic.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v202',icon:'fa-wand-magic-sparkles',title:'iOS App Archive v2.0.2',date:'May 5, 2026',badge:'LATEST',
                preview:'iOS 6 App Store-inspired visual refresh — redesigned tab bar with depth effects, star ratings, sticky page headers, rectangular action buttons, and full category icons.',
                body:`<h3>🎨 iOS 6 App Store Design Refresh</h3>
<p>v2.0.2 brings the site's visual language even closer to the original iOS 6 App Store with carefully crafted depth and skeuomorphic touches throughout.</p>
<h3>📊 Star Ratings Everywhere</h3>
<ul>
<li><strong>Deterministic ratings</strong> — Every app now shows a consistent star rating (2.5–5 ★) and a review count derived from the app's ID, so ratings are stable across sessions.</li>
<li>Ratings appear on <strong>featured carousel cards, search cards, category cards, Genius rows, and the app detail modal</strong>.</li>
</ul>
<h3>📱 Tab Bar Overhaul</h3>
<ul>
<li><strong>Featured tab icon</strong> replaced with a stage-lights design matching the iOS 6 App Store.</li>
<li><strong>Active tab depth effect</strong> — the selected tab appears pressed inward with a concave shadow, giving a physical button feel.</li>
<li>Inactive tabs use the deep ingrained/engraved icon style established in v2.0.1.</li>
</ul>
<h3>🔲 Unified Action Buttons</h3>
<ul>
<li>All Get / See All / View Details buttons now share a single <strong>rectangular pill shape</strong> identical to the Search page's Cancel button — consistent border-radius, metallic sheen, and ingrained label.</li>
</ul>
<h3>🗂️ Categories Improvements</h3>
<ul>
<li><strong>Every category</strong> now has a coloured icon — no more missing icons for less common categories.</li>
<li>Category rows are now <strong>edge-to-edge</strong>, removing the wasted side margins.</li>
<li>Mini star ratings added to category and grid cards.</li>
</ul>
<h3>⚛️ Genius Page</h3>
<ul>
<li>The "Recommended for You" header is replaced by a <strong>sticky "Genius" sub-header bar</strong> locked to the top of that tab only — it doesn't appear anywhere else on the site.</li>
<li>App rows now include mini star ratings.</li>
</ul>
<h3>📰 What's New Page</h3>
<ul>
<li>The introductory card is replaced by a <strong>sticky "What's New" sub-header bar</strong>, matching the Genius page treatment.</li>
<li>v2.0.2 changelog added (this article). v2.0 and v1.0 articles retained.</li>
</ul>
<h3>✨ Animations & Polish</h3>
<ul>
<li>Smoother fade and slide-up transitions on tab switches.</li>
<li>Category row cards gain a subtle lift on hover.</li>
<li>Page sub-headers use the same metallic dark gradient as the main header and tab bar for visual coherence.</li>
</ul>
<p>Thanks for using iOS App Archive!</p>`
            },
            {
                id:'v201',icon:'fa-paint-brush',title:'iOS App Archive v2.0.1',date:'March 11, 2026',badge:'UPDATE',
                preview:'White gradient theme, ingrained tab icons, redesigned categories & Genius pages, metallic Get buttons site-wide.',
                body:`<h3>🎨 Visual Overhaul</h3>
<p>v2.0.1 shipped a comprehensive visual refresh bringing the entire site to a clean white-gradient aesthetic while keeping the iconic black header and tab bar.</p>
<ul>
<li><strong>White Gradient Theme</strong> — site background, all cards, modals.</li>
<li><strong>Colored Header Icon</strong> — full-colour logo in the top header.</li>
<li><strong>Metallic "Get" Buttons</strong> — unified shiny pill buttons everywhere.</li>
<li><strong>Featured Carousel Cards</strong> — white-gradient, no reflection effect.</li>
<li><strong>Search Card Fix</strong> — horizontal row layout matching the original iOS App Store.</li>
</ul>
<h3>🗂️ Categories Page Rebuilt</h3>
<ul><li>Horizontal scroll rows per category with coloured icons and See All buttons.</li></ul>
<h3>⚛️ Genius Page Rebuilt</h3>
<ul><li>Vertical list layout (like Related Apps). White row style. Atom icon.</li></ul>
<h3>📰 News Page</h3>
<ul><li>White-and-black theme. V1.0, V2.0, V2.0.1 changelogs.</li></ul>`
            },
            {
                id:'v200',icon:'fa-rocket',title:'iOS App Archive v2.0',date:'February 15, 2026',badge:'VERSION 2.0',
                preview:'Major update — enhanced search with category rows, 3D skeuomorphic cards, Genius recommendations, and the new News tab.',
                body:`<h3>🚀 Major Feature Update</h3>
<p>Version 2.0 arrived with significant improvements and new features.</p>
<ul>
<li><strong>Enhanced Search</strong> with curated category rows.</li>
<li><strong>Genius Recommendations</strong> based on viewing history.</li>
<li><strong>News Tab</strong> — stay up to date with archive changes.</li>
<li><strong>Beautiful loading animation</strong> on first visit.</li>
<li><strong>3D Skeuomorphic Cards</strong> with enhanced depth.</li>
</ul>`
            },
            {
                id:'v100',icon:'fa-star',title:'iOS App Archive v1.0 — Launch',date:'January 1, 2026',badge:'LAUNCH',
                preview:'The very first release — archiving every delisted iOS app from the most well-known to the most obscure.',
                body:`<h3>🎉 Welcome to iOS App Archive!</h3>
<p>Version 1.0 launched iOS App Archive as a dedicated home for every delisted iOS app.</p>
<ul>
<li><strong>Featured Carousel</strong> — daily rotating, 8-second auto-advance.</li>
<li><strong>Full App Search</strong> — by name or developer, alphabetically sorted.</li>
<li><strong>App Detail Modals</strong> — icon, developer, description, version history.</li>
<li><strong>IPA Downloads</strong> — direct links to archived builds.</li>
<li><strong>Categories Tab</strong> — browse and drill into any category.</li>
<li><strong>Glossy Skeuomorphic UI</strong> — dark brushed-metal tab bar, iOS 6 aesthetic.</li>
</ul>`
            }
        ];

        function renderNewsPage(){
            const uc=document.getElementById('updatesContent'); if(!uc)return; uc.innerHTML='';
            const scrollArea=document.createElement('div'); scrollArea.className='page-scroll-area';
            NEWS_ARTICLES.forEach(article=>{
                const card=document.createElement('div'); card.className='news-card';
                card.innerHTML=`
                    <div class="news-card-header">
                        <div class="news-icon"><i class="fas ${article.icon}"></i></div>
                        <div class="news-card-title"><h3>${escapeHtml(article.title)}</h3><div class="news-card-date">${escapeHtml(article.date)}</div></div>
                    </div>
                    <div class="news-card-preview">${escapeHtml(article.preview)}</div>`;
                card.addEventListener('click',()=>showArticleModal(article));
                scrollArea.appendChild(card);
            });
            uc.appendChild(scrollArea);
        }

        function showArticleModal(article){
            const modal=document.createElement('div'); modal.className='news-modal';
            modal.innerHTML=`
                <div class="news-modal-content">
                    <button class="news-close-btn"><i class="fas fa-times"></i></button>
                    <div class="news-modal-header">
                        <div class="news-modal-icon"><i class="fas ${article.icon}"></i></div>
                        <div class="news-modal-title-section"><h2>${escapeHtml(article.title)}</h2><div class="news-modal-date">${escapeHtml(article.date)}</div></div>
                    </div>
                    <div class="news-modal-body">${article.body}</div>
                </div>`;
            modal.querySelector('.news-close-btn').addEventListener('click',()=>modal.remove());
            modal.addEventListener('click',e=>{ if(e.target===modal)modal.remove(); });
            document.body.appendChild(modal);
        }

        // ── Loading screen ────────────────────────────────────────────────────
        window.addEventListener('load',function(){
            const ls=document.getElementById('loadingScreen');
            if(!ls) return;
            // Apple-style: after brief hold, loader fades+scales out, body scales in from 0.96
            document.body.style.transform='scale(0.96)';
            document.body.style.opacity='0';
            document.body.style.transition='none';
            setTimeout(()=>{
                // Start loader exit
                ls.classList.add('open-reveal');
                // Simultaneously animate body into view
                document.body.style.transition='transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease';
                document.body.style.transform='scale(1)';
                document.body.style.opacity='1';
                setTimeout(()=>{
                    ls.style.display='none';
                    document.body.style.transform='';
                    document.body.style.opacity='';
                    document.body.style.transition='';
                },580);
            }, 1400);
        });

        // ── Pull to Refresh ──────────────────────────────────────────────────
        // ── Pull-to-Refresh on Genius (attached to the scrolling inner area) ───────
        function initGeniusPTR() {
            // #geniusContent is position:fixed — we target its .page-scroll-area child
            const gc = document.getElementById('geniusContent');
            if (!gc) return;
            const sa = gc.querySelector('.page-scroll-area');
            if (!sa || sa._ptrInit) return;
            sa._ptrInit = true;

            const PTR_THRESHOLD = 68;
            let startY = 0, pulling = false, isPulling = false;

            // Create indicator and prepend to scroll area
            const ind = document.createElement('div');
            ind.className = 'ptr-indicator';
            ind.innerHTML = '<div class="ptr-arrow"><i class="fas fa-clock-rotate-left"></i></div>';
            sa.insertBefore(ind, sa.firstChild);

            sa.addEventListener('touchstart', e => {
                if (sa.scrollTop > 2) return;
                startY = e.touches[0].clientY;
                pulling = true;
                isPulling = false;
            }, { passive: true });

            sa.addEventListener('touchmove', e => {
                if (!pulling) return;
                const diff = Math.max(0, e.touches[0].clientY - startY);
                if (diff > 6 && sa.scrollTop <= 0) {
                    isPulling = true;
                    const pull = Math.min(diff * 0.42, PTR_THRESHOLD + 24);
                    ind.style.height = pull + 'px';
                    ind.style.opacity = String(Math.min(pull / PTR_THRESHOLD, 1));
                    const pct = Math.min(pull / PTR_THRESHOLD, 1);
                    const arrow = ind.querySelector('.ptr-arrow');
                    if (arrow) arrow.style.transform = `scale(${0.3 + pct * 0.7}) rotate(${pct * 180}deg)`;
                }
            }, { passive: true });

            sa.addEventListener('touchend', () => {
                if (!pulling) return;
                pulling = false;
                if (isPulling && sa.scrollTop <= 0 && parseFloat(ind.style.height||0) >= PTR_THRESHOLD) {
                    doRefresh(ind);
                } else {
                    collapseIndicator(ind);
                }
            });

            // Desktop: over-scroll at top with mouse wheel
            sa.addEventListener('wheel', e => {
                if (sa.scrollTop <= 0 && e.deltaY < -40) { doRefresh(ind); }
            }, { passive: true });
        }

        function doRefresh(ind) {
            ind.classList.add('ptr-refreshing');
            ind.style.height = '72px';
            ind.style.opacity = '1';
            const arrow = ind.querySelector('.ptr-arrow');
            if (arrow) { arrow.style.transform = ''; arrow.innerHTML = '<i class="fas fa-clock-rotate-left"></i>'; }
            setTimeout(() => {
                renderGeniusPage();          // re-renders and re-attaches PTR
                collapseIndicator(ind);
            }, 900);
        }

        function collapseIndicator(ind) {
            ind.style.transition = 'height 0.38s cubic-bezier(0.23,1,0.32,1), opacity 0.32s ease';
            ind.style.height = '0px';
            ind.style.opacity = '0';
            ind.classList.remove('ptr-refreshing');
            setTimeout(() => { ind.style.transition = ''; }, 400);
        }

        // ── Depth-push effect when version-sheet opens / closes ───────────────
        (function initDepthPush() {
            // IMPORTANT: never include .container or header in pushBack targets.
            // Applying transform/filter to .container creates a stacking context that
            // traps fixed-position children (header, bottom-bar), breaking the layout.
            const MAIN = ['.carousel-container','.tab-content.active'];
            function getEls() { return MAIN.flatMap(s => Array.from(document.querySelectorAll(s))); }

            function pushBack() {
                getEls().forEach(el => {
                    el.style.transition = 'transform 0.38s cubic-bezier(0.23,1,0.32,1), filter 0.38s ease';
                    el.style.transform  = 'scale(0.95) translateY(-12px)';
                    el.style.filter     = 'brightness(0.7) blur(1px)';
                });
            }
            function restore() {
                getEls().forEach(el => {
                    el.style.transform = '';
                    el.style.filter    = '';
                });
                setTimeout(() => getEls().forEach(el => { el.style.transition = ''; }), 400);
            }

            // Observe version-sheet-overlay active class
            const observer = new MutationObserver(muts => {
                muts.forEach(m => {
                    if (m.target.classList.contains('version-sheet-overlay')) {
                        m.target.classList.contains('active') ? pushBack() : restore();
                    }
                });
            });
            document.addEventListener('DOMContentLoaded', () => {
                // Observe future overlays added to modalContainer
                const mc = document.getElementById('modalContainer');
                if (mc) {
                    new MutationObserver(() => {
                        document.querySelectorAll('.version-sheet-overlay').forEach(o => {
                            if (!o._dpInit) {
                                o._dpInit = true;
                                observer.observe(o, { attributes: true, attributeFilter: ['class'] });
                            }
                        });
                    }).observe(mc, { childList: true, subtree: true });
                }
            });
        })();

                appsPromise.then(()=>{ if(appsLoaded){renderGeniusPage();renderNewsPage();setTimeout(initGeniusPTR,200);} }).catch(e=>console.error(e));

        // ════════════════════════════════════════════════════════════════════
        // V3.0.2 — NEW FEATURES
        // ════════════════════════════════════════════════════════════════════

        // ── FAVOURITES ──────────────────────────────────────────────────────
        function getFavourites() {
            try { return JSON.parse(localStorage.getItem('favourites')||'[]'); } catch(e){ return []; }
        }
        function toggleFavourite(appId) {
            const favs = getFavourites();
            const idx = favs.indexOf(appId);
            if (idx === -1) favs.push(appId);
            else favs.splice(idx, 1);
            try { localStorage.setItem('favourites', JSON.stringify(favs)); } catch(e){}
            return idx === -1; // true = added
        }
        function isFavourite(appId) { return getFavourites().includes(appId); }

        // ── RECENTLY VIEWED ─────────────────────────────────────────────────
        function getRecentlyViewed() {
            try { return JSON.parse(localStorage.getItem('recentlyViewed')||'[]'); } catch(e){ return []; }
        }
        function addRecentlyViewed(appId) {
            let rv = getRecentlyViewed();
            rv = rv.filter(id => id !== appId);
            rv.unshift(appId);
            rv = rv.slice(0,12);
            try { localStorage.setItem('recentlyViewed', JSON.stringify(rv)); } catch(e){}
        }

        // Patch trackAppView to also record recently viewed
        const _origTrackView = trackAppView;
        function trackAppView(id) { _origTrackView(id); addRecentlyViewed(id); }

        // ── RECENTLY VIEWED SECTION on Featured ────────────────────────────
        function renderRecentlyViewed() {
            const fc = document.getElementById('featuredContent');
            if (!fc) return;
            document.getElementById('recentlyViewedSection') && document.getElementById('recentlyViewedSection').remove();
            const rv = getRecentlyViewed();
            if (!rv.length || !appsLoaded) return;
            const rvApps = rv.map(id=>apps.find(a=>a.id===id)).filter(Boolean);
            if (!rvApps.length) return;

            const sec = document.createElement('div');
            sec.id = 'recentlyViewedSection';
            sec.className = 'rv-section';
            sec.innerHTML = `<div class="rv-header"><span class="rv-title">Recently Viewed</span></div>
                <div class="rv-scroller">
                    ${rvApps.map(app=>`
                    <div class="rv-card" data-app-id="${app.id}">
                        <div class="rv-icon-wrap">
                            ${app.icon?`<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}
                        </div>
                        <div class="rv-name">${app.title}</div>
                    </div>`).join('')}
                </div>`;
            sec.querySelectorAll('.rv-card').forEach(card=>{
                card.addEventListener('click',()=>openModal(card.dataset.appId));
            });
            fc.appendChild(sec);
        }

        // ── GENIUS BADGE COUNT ──────────────────────────────────────────────
        function updateGeniusBadge() {
            const tab = document.querySelector('.tab[data-tab="genius"]');
            if (!tab) return;
            tab.querySelector('.genius-badge') && tab.querySelector('.genius-badge').remove();
            if (!isGeniusEnabled() || !appsLoaded) return;
            const count = getGeniusRecs().length;
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'genius-badge';
                badge.textContent = count > 9 ? '9+' : count;
                tab.appendChild(badge);
            }
        }

        // ── SETTINGS PANEL ──────────────────────────────────────────────────
        function getSettings() {
            try { return Object.assign({
                accentColor: '#0a84ff',
                showRatings: true,
                showDeviceIcons: true,
                cardStyle: 'rounded',
                reducedMotion: false
            }, JSON.parse(localStorage.getItem('siteSettings')||'{}')); } catch(e) { return {}; }
        }
        function saveSettings(s) {
            try { localStorage.setItem('siteSettings', JSON.stringify(s)); } catch(e){}
        }
        function applySettings() {
            const s = getSettings();
            document.documentElement.style.setProperty('--accent', s.accentColor||'#0a84ff');
            document.body.classList.toggle('reduced-motion', !!s.reducedMotion);
            document.body.classList.toggle('hide-ratings', !s.showRatings);
            document.body.classList.toggle('hide-device-icons', !s.showDeviceIcons);
        }

        function openSettings() {
            document.getElementById('settingsPanel') && document.getElementById('settingsPanel').remove();
            const s = getSettings();
            const panel = document.createElement('div');
            panel.id = 'settingsPanel';
            panel.className = 'settings-overlay';
            const accentOptions = [
                {c:'#0a84ff',n:'Blue'},{c:'#30d158',n:'Green'},{c:'#ff453a',n:'Red'},
                {c:'#ff9f0a',n:'Orange'},{c:'#bf5af2',n:'Purple'},{c:'#ffd60a',n:'Yellow'}
            ];
            panel.innerHTML = `
                <div class="settings-sheet">
                    <div class="settings-header">
                        <div class="settings-title"><i class="fas fa-sliders"></i> Settings</div>
                        <button class="settings-close-btn modal-close-btn">Done</button>
                    </div>
                    <div class="settings-body">
                        <div class="settings-section-label">APPEARANCE</div>
                        <div class="settings-row">
                            <span class="settings-row-label"><i class="fas fa-circle-dot"></i> Accent Colour</span>
                            <div class="accent-swatches">
                                ${accentOptions.map(o=>`<button class="accent-swatch ${s.accentColor===o.c?'active':''}" data-color="${o.c}" style="background:${o.c}" title="${o.n}"></button>`).join('')}
                            </div>
                        </div>
                        <div class="settings-row settings-toggle-row">
                            <span class="settings-row-label"><i class="fas fa-star"></i> Show Star Ratings</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggleRatings" ${s.showRatings!==false?'checked':''}>
                                <span class="toggle-track"></span>
                            </label>
                        </div>
                        <div class="settings-row settings-toggle-row">
                            <span class="settings-row-label"><i class="fas fa-mobile-screen-button"></i> Show Device Icons</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggleDeviceIcons" ${s.showDeviceIcons!==false?'checked':''}>
                                <span class="toggle-track"></span>
                            </label>
                        </div>
                        <div class="settings-row settings-toggle-row">
                            <span class="settings-row-label"><i class="fas fa-wind"></i> Reduce Motion</span>
                            <label class="toggle-switch">
                                <input type="checkbox" id="toggleMotion" ${s.reducedMotion?'checked':''}>
                                <span class="toggle-track"></span>
                            </label>
                        </div>
                        <div class="settings-section-label" style="margin-top:18px">DATA</div>
                        <div class="settings-row settings-btn-row">
                            <span class="settings-row-label"><i class="fas fa-clock-rotate-left"></i> Clear Recently Viewed</span>
                            <button class="settings-action-btn" id="clearRecentBtn">Clear</button>
                        </div>
                        <div class="settings-row settings-btn-row">
                            <span class="settings-row-label"><i class="fas fa-heart"></i> Clear Favourites</span>
                            <button class="settings-action-btn" id="clearFavsBtn">Clear</button>
                        </div>
                        <div class="settings-row settings-btn-row">
                            <span class="settings-row-label"><i class="fas fa-atom"></i> Reset Genius History</span>
                            <button class="settings-action-btn" id="clearGeniusBtn">Reset</button>
                        </div>
                        <div class="settings-section-label" style="margin-top:18px">ABOUT</div>
                        <div class="settings-row">
                            <span class="settings-row-label" style="color:#888;font-size:13px">iOS App Archive — Archiving every delisted iOS app.</span>
                        </div>
                        <div class="settings-row">
                            <span class="settings-row-label" style="color:#aaa;font-size:12px">V3.0.2</span>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(panel);
            panel.offsetHeight;
            requestAnimationFrame(()=>panel.classList.add('active'));

            const close = () => { panel.classList.remove('active'); setTimeout(()=>panel.remove(),380); };
            panel.querySelector('.settings-close-btn').addEventListener('click', close);
            panel.addEventListener('click', e=>{ if(e.target===panel) close(); });

            // Accent swatches
            panel.querySelectorAll('.accent-swatch').forEach(sw=>{
                sw.addEventListener('click',()=>{
                    panel.querySelectorAll('.accent-swatch').forEach(s=>s.classList.remove('active'));
                    sw.classList.add('active');
                    const ns = getSettings(); ns.accentColor=sw.dataset.color; saveSettings(ns); applySettings();
                });
            });
            // Toggles
            panel.querySelector('#toggleRatings').addEventListener('change',function(){
                const ns=getSettings(); ns.showRatings=this.checked; saveSettings(ns); applySettings();
            });
            panel.querySelector('#toggleDeviceIcons').addEventListener('change',function(){
                const ns=getSettings(); ns.showDeviceIcons=this.checked; saveSettings(ns); applySettings();
            });
            panel.querySelector('#toggleMotion').addEventListener('change',function(){
                const ns=getSettings(); ns.reducedMotion=this.checked; saveSettings(ns); applySettings();
            });
            // Data actions
            panel.querySelector('#clearRecentBtn').addEventListener('click',()=>{
                localStorage.removeItem('recentlyViewed');
                renderRecentlyViewed();
                panel.querySelector('#clearRecentBtn').textContent='Done!';
                setTimeout(()=>panel.querySelector('#clearRecentBtn') && (panel.querySelector('#clearRecentBtn').textContent='Clear'),1500);
            });
            panel.querySelector('#clearFavsBtn').addEventListener('click',()=>{
                localStorage.removeItem('favourites');
                panel.querySelector('#clearFavsBtn').textContent='Done!';
                setTimeout(()=>panel.querySelector('#clearFavsBtn') && (panel.querySelector('#clearFavsBtn').textContent='Clear'),1500);
            });
            panel.querySelector('#clearGeniusBtn').addEventListener('click',()=>{
                localStorage.removeItem('viewedApps');
                viewedApps=[];
                renderGeniusPage();
                setTimeout(initGeniusPTR,120);
                panel.querySelector('#clearGeniusBtn').textContent='Done!';
                setTimeout(()=>close(),800);
            });
        }

        // ── FAVOURITES PAGE (replaces featuredContent tab on demand) ───────
        function renderFavouritesPage() {
            const favIds = getFavourites();
            const modal = document.createElement('div');
            modal.className = 'favs-overlay';
            modal.id = 'favsOverlay';
            const favApps = favIds.map(id=>apps.find(a=>a.id===id)).filter(Boolean);
            modal.innerHTML = `
                <div class="favs-sub-header">
                    <button class="favs-close-btn modal-close-btn"><i class="fas fa-chevron-left"></i> Back</button>
                    <span class="favs-title">Favourites</span>
                    <div style="width:80px"></div>
                </div>
                <div class="favs-content">
                    ${!favApps.length
                        ? `<div class="favs-empty">
                            <div class="favs-empty-icon"><i class="fas fa-heart"></i></div>
                            <p>No favourites yet.<br>Tap ♥ on any app to save it here.</p>
                           </div>`
                        : `<div class="genius-list">${favApps.map((app,i)=>`
                            <div class="genius-list-item" style="animation-delay:${i*0.03}s" data-app-id="${app.id}">
                                <div class="genius-app-icon">${app.icon?`<img src="${app.icon}" alt="${app.title}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                                <div class="genius-app-info" data-app-id="${app.id}">
                                    <div class="genius-app-name">${app.title}</div>
                                    <div class="genius-app-dev">${app.developer||''}</div>
                                    <div class="genius-mini-stars">${renderStars(getAppRating(app))}</div>
                                </div>
                                <button class="action-btn" data-app-id="${app.id}">Get</button>
                            </div>`).join('')}
                        </div>`}
                </div>`;
            document.body.appendChild(modal);
            modal.offsetHeight;
            requestAnimationFrame(()=>modal.classList.add('active'));
            modal.querySelector('.favs-close-btn').addEventListener('click',()=>{
                modal.classList.remove('active'); setTimeout(()=>modal.remove(),380);
            });
            modal.querySelectorAll('[data-app-id]').forEach(el=>{
                el.addEventListener('click',function(){openModal(this.dataset.appId);});
            });
        }

        // Favourites removed — openModal is unpatched

        // ── KEYBOARD SHORTCUT ── press / to open search ─────────────────────
        document.addEventListener('keydown', e => {
            if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.querySelector('.tab[data-tab="search"]').click();
                setTimeout(()=>document.getElementById('searchInput').focus(), 200);
            }
        });

        // ── SETTINGS GEAR in header ─────────────────────────────────────────
        document.addEventListener('DOMContentLoaded', () => {
            // Settings button
            const gear = document.createElement('button');
            gear.className = 'header-settings-btn';
            gear.innerHTML = '<i class="fas fa-gear"></i>';
            gear.title = 'Settings';
            gear.addEventListener('click', openSettings);
            const hc = document.querySelector('.header-content');
            if (hc) hc.appendChild(gear);

            // Favourites removed

            applySettings();
        });

        // Render recently viewed after featured loads
        appsPromise.then(()=>{
            if(appsLoaded){ renderRecentlyViewed(); updateGeniusBadge(); }
        }).catch(()=>{});

        // Re-render RV when a modal is closed
        document.addEventListener('click', e => {
            if (e.target.classList.contains('modal-close-btn') || e.target.classList.contains('modal-overlay')) {
                setTimeout(()=>{ renderRecentlyViewed(); updateGeniusBadge(); }, 400);
            }
        });

        // ── V3.0.2 NEWS ARTICLE ─────────────────────────────────────────────
        // (Added inline at top of NEWS_ARTICLES array via next patch)
