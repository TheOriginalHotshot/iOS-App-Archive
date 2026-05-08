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
                    <div style="width:70px;"></div>
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
                        <button class="modal-tab-btn" data-tab="related">Related Apps</button>
                    </div>
                    <div class="modal-tab-content active" id="details-content">
                        <div class="modal-section"><h3><i class="fas fa-mobile-alt"></i> Compatibility</h3><p class="compatibility-text">${app.compatibility}</p></div>
                        <div class="modal-section"><h3><i class="fas fa-align-left"></i> App Store Description</h3>${app.description.split('\n').map(p=>`<p>${p}</p>`).join('')}</div>
                    </div>
                    <div class="modal-tab-content" id="related-content">
                        <div class="related-apps-list">${relHTML||'<p style="text-align:center;color:#999;padding:20px;">No related apps found.</p>'}</div>
                    </div>
                </div>
                <div class="version-sheet-overlay">
                    <div class="version-sheet">
                        <h3 class="version-sheet-title">Version History</h3>
                        <div class="versions-container">${vItems}</div>
                        <button class="dark-cancel-btn version-sheet-cancel">Cancel</button>
                    </div>
                </div>`;
            modalContainer.appendChild(modal);
            modal.querySelector('.modal-close-btn').addEventListener('click',()=>{ modal.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); });
            modal.querySelectorAll('.modal-tab-btn').forEach(btn=>btn.addEventListener('click',function(){
                modal.querySelectorAll('.modal-tab-btn').forEach(b=>b.classList.remove('active'));
                modal.querySelectorAll('.modal-tab-content').forEach(c=>c.classList.remove('active'));
                this.classList.add('active');
                modal.querySelector(`#${this.dataset.tab}-content`).classList.add('active');
            }));
            modal.querySelector('.modal-get-btn').addEventListener('click',()=>modal.querySelector('.version-sheet-overlay').classList.add('active'));
            modal.querySelector('.version-sheet-cancel').addEventListener('click',()=>modal.querySelector('.version-sheet-overlay').classList.remove('active'));
            modal.querySelector('.version-sheet-overlay').addEventListener('click',function(e){ if(e.target===this)this.classList.remove('active'); });
            modal.querySelectorAll('.related-app-info').forEach(el=>el.addEventListener('click',function(){ const id=this.dataset.appId; modal.classList.remove('active'); setTimeout(()=>openModal(id),300); }));
            modal.querySelectorAll('.related-app-get-btn').forEach(btn=>btn.addEventListener('click',function(e){ e.stopPropagation(); const id=this.dataset.appId; modal.classList.remove('active'); setTimeout(()=>openModal(id),300); }));
            modal.addEventListener('click',function(e){ if(e.target===modal){ modal.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); } });
            return modal;
        }

        document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.active').forEach(m=>{ m.classList.remove('active'); document.body.style.overflow='auto'; setUrlParam('app',''); }); document.querySelectorAll('.version-sheet-overlay.active').forEach(s=>s.classList.remove('active')); } });

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
                tabContents.genius.classList.add('active'); if(appsLoaded)renderGeniusPage();
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
        function getAllCategories(){const s=new Set();apps.forEach(a=>{if(Array.isArray(a.categories))a.categories.forEach(c=>s.add(c));});return Array.from(s).sort();}

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
            'Casual':              { icon:'fa-smile',           color:'#32d74b' },
            'Family':              { icon:'fa-home',            color:'#ffd60a' },
            'Puzzle':              { icon:'fa-puzzle-piece',    color:'#5e5ce6' },
            'Racing':              { icon:'fa-flag-checkered',  color:'#ff453a' },
            'Role Playing':        { icon:'fa-hat-wizard',      color:'#bf5af2' },
            'Simulation':          { icon:'fa-cogs',            color:'#64d2ff' },
            'Sports Games':        { icon:'fa-basketball-ball', color:'#ff9f0a' },
            'Strategy':            { icon:'fa-chess-king',      color:'#5e5ce6' },
            'Trivia':              { icon:'fa-question-circle', color:'#ffd60a' },
            'Word':                { icon:'fa-font',            color:'#32d74b' }
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
                    <button class="seeall-back-btn">
                        <i class="fa-solid fa-chevron-left"></i><span>Categories</span>
                    </button>
                    <span class="seeall-title">See All</span>
                    <div style="width:90px;"></div>
                </div>
                <div class="seeall-content" id="seeAllContent"></div>`;

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
                        openModal(this.dataset.appId);
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

        function renderGeniusPage(){
            const gc=document.getElementById('geniusContent'); if(!gc)return; gc.innerHTML='';
            // Sticky sub-header
            const subHdr=document.createElement('div'); subHdr.className='page-sub-header genius-sub-header';
            subHdr.innerHTML='<span class="page-sub-header-title">Genius</span>';
            gc.appendChild(subHdr);
            const scrollArea=document.createElement('div'); scrollArea.className='page-scroll-area';
            const recs=getGeniusRecs();
            if(!recs.length){
                const msg=document.createElement('p'); msg.textContent='Browse apps to get personalised suggestions!';
                msg.style.cssText='text-align:center;color:#999;padding:40px 20px;'; scrollArea.appendChild(msg);
            } else {
                const list=document.createElement('div'); list.className='genius-list';
                recs.forEach((app,i)=>{
                    const item=document.createElement('div'); item.className='genius-list-item';
                    item.style.animationDelay=`${i*0.04}s`;
                    item.innerHTML=`
                        <div class="genius-app-icon">${app.icon?`<img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.title)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`:'<i class="fas fa-mobile-alt"></i>'}</div>
                        <div class="genius-app-info" data-app-id="${app.id}">
                            <div class="genius-app-name">${escapeHtml(app.title)}</div>
                            <div class="genius-app-dev">${escapeHtml(app.developer||'Unknown')}</div>
                            <div class="genius-mini-stars">${renderStars(getAppRating(app))}</div>
                        </div>
                        <button class="action-btn genius-get-btn" data-app-id="${app.id}">Get</button>`;
                    item.querySelector('.genius-app-info').addEventListener('click',function(){openModal(this.dataset.appId);});
                    item.querySelector('.action-btn').addEventListener('click',function(){openModal(this.dataset.appId);});
                    list.appendChild(item);
                });
                scrollArea.appendChild(list);
            }
            gc.appendChild(scrollArea);
        }

        // ── News ──────────────────────────────────────────────────────────────
        const NEWS_ARTICLES=[
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
            // Sticky sub-header
            const subHdr=document.createElement('div'); subHdr.className='page-sub-header news-sub-header';
            subHdr.innerHTML='<span class="page-sub-header-title">What\'s New</span>';
            uc.appendChild(subHdr);
            const scrollArea=document.createElement('div'); scrollArea.className='page-scroll-area';
            NEWS_ARTICLES.forEach(article=>{
                const card=document.createElement('div'); card.className='news-card';
                card.innerHTML=`
                    <div class="news-card-header">
                        <div class="news-icon"><i class="fas ${article.icon}"></i></div>
                        <div class="news-card-title"><h3>${escapeHtml(article.title)}</h3><div class="news-card-date">${escapeHtml(article.date)}</div></div>
                    </div>
                    <div class="news-card-preview">${escapeHtml(article.preview)}</div>
                    <span class="news-badge">${escapeHtml(article.badge)}</span>`;
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
        window.addEventListener('load',function(){ const ls=document.getElementById('loadingScreen'); if(ls)setTimeout(()=>ls.style.display='none',3000); });
        appsPromise.then(()=>{ if(appsLoaded){renderGeniusPage();renderNewsPage();} }).catch(e=>console.error(e));
