/**
 * Archive.org Auto-Sync System - FIXED VERSION
 * This version handles individual uploads by parsing the uploads page
 * Works with: https://archive.org/details/@legacyios_archive/uploads
 */

class ArchiveOrgAutoSync {
    constructor() {
        this.username = 'legacyios_archive';
        this.allItems = [];
        this.processedApps = [];
        this.syncStatus = {
            isRunning: false,
            itemsProcessed: 0,
            totalItems: 0,
            errors: [],
            lastSync: null
        };
    }

    /**
     * Main sync function - fetches all your Archive.org uploads
     */
    async syncFromArchiveOrg() {
        console.log('🔄 Starting Archive.org sync...');
        console.log(`📡 Fetching uploads from: @${this.username}`);
        this.syncStatus.isRunning = true;
        this.syncStatus.itemsProcessed = 0;
        this.syncStatus.errors = [];
        
        try {
            // NEW APPROACH: Use the uploads JSON endpoint
            const items = await this.fetchUploadsViaJSON();
            
            if (items.length === 0) {
                console.error('❌ No items found!');
                console.error('Trying alternative method...');
                // If JSON method fails, try the search method
                const altItems = await this.fetchAllUserItems();
                if (altItems.length > 0) {
                    items.push(...altItems);
                }
            }
            
            this.allItems = items;
            this.syncStatus.totalItems = items.length;
            
            if (items.length === 0) {
                console.error('❌ Still no items found after trying all methods!');
                return [];
            }
            
            console.log(`📦 Found ${items.length} uploads`);
            console.log(`🔍 Sample identifiers:`, items.slice(0, 3).map(i => i.identifier));
            
            // Process each item to extract IPA files
            for (const item of items) {
                try {
                    await this.processItem(item);
                    this.syncStatus.itemsProcessed++;
                    
                    // Update progress
                    if (this.syncStatus.itemsProcessed % 25 === 0) {
                        console.log(`⏳ Progress: ${this.syncStatus.itemsProcessed}/${this.syncStatus.totalItems}`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing item ${item.identifier}:`, error.message);
                    this.syncStatus.errors.push({
                        item: item.identifier,
                        error: error.message
                    });
                }
            }
            
            this.syncStatus.lastSync = new Date().toISOString();
            this.syncStatus.isRunning = false;
            
            console.log(`✅ Sync complete! Found ${this.processedApps.length} apps from ${items.length} uploads`);
            console.log(`📊 Success: ${this.syncStatus.itemsProcessed}/${this.syncStatus.totalItems}`);
            if (this.syncStatus.errors.length > 0) {
                console.log(`⚠️  Errors: ${this.syncStatus.errors.length} (some items may not contain IPAs)`);
            }
            
            // Log some sample apps
            if (this.processedApps.length > 0) {
                console.log('📱 Sample apps:', this.processedApps.slice(0, 5).map(a => a.title));
            }
            
            // Save to localStorage as cache
            this.saveToCache();
            
            return this.processedApps;
            
        } catch (error) {
            console.error('❌ Fatal sync error:', error);
            console.error('Stack:', error.stack);
            this.syncStatus.isRunning = false;
            throw error;
        }
    }

    /**
     * Fetch uploads using the uploads page JSON endpoint
     * Direct method for user uploads at /details/@username/uploads
     */
    async fetchUploadsViaJSON() {
        const allItems = [];
        let page = 1;
        let hasMore = true;
        
        console.log(`🔍 Fetching from https://archive.org/details/@${this.username}/uploads...`);
        
        while (hasMore && page <= 30) { // 260 items = ~5-6 pages at 50/page
            try {
                // Use the uploads page with JSON output
                // Format: https://archive.org/details/@username/uploads?output=json&page=X
                const url = `https://archive.org/details/@${this.username}/uploads?output=json&page=${page}`;
                
                console.log(`📄 Fetching page ${page}: ${url}`);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.warn(`⚠️  HTTP ${response.status} for page ${page}`);
                    if (page === 1) {
                        // Try without /uploads
                        console.log('Trying without /uploads suffix...');
                        const altUrl = `https://archive.org/details/@${this.username}?output=json&page=${page}`;
                        const altResponse = await fetch(altUrl);
                        if (altResponse.ok) {
                            const altData = await altResponse.json();
                            const items = this.extractItemsFromResponse(altData);
                            if (items.length > 0) {
                                console.log(`✓ Success with alternate URL! Found ${items.length} items`);
                                allItems.push(...items);
                                page++;
                                continue;
                            }
                        }
                    }
                    break;
                }
                
                const data = await response.json();
                const items = this.extractItemsFromResponse(data);
                
                if (items && items.length > 0) {
                    allItems.push(...items);
                    console.log(`✓ Page ${page}: Found ${items.length} items (total so far: ${allItems.length})`);
                    
                    // Check if there might be more
                    // Archive.org typically returns 50 items per page
                    hasMore = items.length >= 50;
                    page++;
                } else {
                    console.log(`📭 Page ${page} returned no items, stopping pagination`);
                    hasMore = false;
                }
                
                // Small delay to be respectful
                await this.delay(400);
                
            } catch (error) {
                console.error(`❌ Error fetching page ${page}:`, error.message);
                hasMore = false;
            }
        }
        
        console.log(`📊 Total items found: ${allItems.length}`);
        return allItems;
    }

    /**
     * Extract items from various Archive.org JSON response formats
     */
    extractItemsFromResponse(data) {
        // Try different possible locations for items in the response
        if (data.items && Array.isArray(data.items)) {
            return data.items;
        }
        if (data.response && data.response.docs && Array.isArray(data.response.docs)) {
            return data.response.docs;
        }
        if (data.response && data.response.items && Array.isArray(data.response.items)) {
            return data.response.items;
        }
        if (Array.isArray(data)) {
            return data;
        }
        // Check for metadata.items
        if (data.metadata && data.metadata.items && Array.isArray(data.metadata.items)) {
            return data.metadata.items;
        }
        
        console.warn('⚠️  Unknown JSON structure:', Object.keys(data));
        return [];
    }

    /**
     * FALLBACK: Try the advanced search API
     */
    async fetchAllUserItems() {
        console.log('🔄 Trying advanced search API as fallback...');
        const allItems = [];
        let page = 1;
        const rows = 100;
        
        // Try multiple query formats
        const queryFormats = [
            `uploader:"${this.username}"`,
            `uploader:@${this.username}`,
            `uploader:${this.username}`,
            `creator:"${this.username}"`,
            `creator:${this.username}`
        ];
        
        for (const query of queryFormats) {
            try {
                const encodedQuery = encodeURIComponent(query);
                const url = `https://archive.org/advancedsearch.php?q=${encodedQuery}&fl[]=identifier&fl[]=title&fl[]=description&output=json&rows=${rows}&page=${page}`;
                
                console.log(`🔍 Trying query: ${query}...`);
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.response && data.response.docs && data.response.docs.length > 0) {
                    console.log(`✅ Success with query: ${query}`);
                    console.log(`Found ${data.response.docs.length} items`);
                    allItems.push(...data.response.docs);
                    break; // Found items, stop trying other formats
                }
                
                await this.delay(200);
                
            } catch (error) {
                console.warn(`Query "${query}" failed:`, error.message);
            }
        }
        
        return allItems;
    }

    /**
     * Process a single Archive.org item to extract IPA files and metadata
     */
    async processItem(item) {
        const identifier = item.identifier || item.id;
        
        if (!identifier) {
            return;
        }
        
        // Fetch detailed metadata for this item
        const metadata = await this.fetchItemMetadata(identifier);
        
        if (!metadata || !metadata.files) {
            return;
        }
        
        // Find all IPA files in this item
        const ipaFiles = metadata.files.filter(file => 
            file.name && file.name.toLowerCase().endsWith('.ipa')
        );
        
        if (ipaFiles.length === 0) {
            return; // No IPAs in this item
        }
        
        // Find PNG icon files
        const iconFiles = metadata.files.filter(file => 
            file.name && file.name.toLowerCase().endsWith('.png') && 
            (file.name.toLowerCase().includes('icon') || 
             file.name.toLowerCase().includes('logo') ||
             file.name.toLowerCase().match(/^[^\/]+\.png$/))
        );
        
        // Get item description from metadata
        const description = metadata.metadata.description || 
                          metadata.metadata.title || 
                          '';
        
        // Process each IPA file as a separate app
        for (const ipaFile of ipaFiles) {
            const app = this.createAppFromIPA(ipaFile, iconFiles, description, identifier);
            if (app) {
                this.processedApps.push(app);
            }
        }
    }

    /**
     * Create an app object from an IPA file
     */
    createAppFromIPA(ipaFile, iconFiles, itemDescription, itemIdentifier) {
        const filename = ipaFile.name;
        const parsed = this.parseIPAFilename(filename);
        
        // Generate app ID from filename
        const appId = this.generateAppId(filename);
        
        // Try to find matching icon
        let iconUrl = null;
        if (iconFiles.length > 0) {
            const appName = parsed.appName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchingIcon = iconFiles.find(icon => {
                const iconName = icon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return iconName.includes(appName) || appName.includes(iconName);
            });
            
            const selectedIcon = matchingIcon || iconFiles[0];
            iconUrl = `https://archive.org/download/${itemIdentifier}/${encodeURIComponent(selectedIcon.name)}`;
        }
        
        // Build download URL
        const downloadUrl = `https://archive.org/download/${itemIdentifier}/${encodeURIComponent(filename)}`;
        
        // Create app object
        const app = {
            id: appId,
            title: parsed.appName,
            developer: parsed.developer || "Unknown Developer",
            featuredDescription: this.generateFeaturedDescription(parsed.appName, itemDescription),
            description: itemDescription || `${parsed.appName} - Archived from legacy iOS devices.`,
            versions: {
                archived: [{
                    version: parsed.version || "1.0",
                    url: downloadUrl
                }],
                unarchived: []
            },
            compatibility: parsed.iosVersion ? `iOS ${parsed.iosVersion} and Later` : "Legacy iOS",
            icon: iconUrl,
            featured: false,
            categories: this.guessCategories(parsed.appName, itemDescription),
            archiveOrgItem: itemIdentifier,
            archiveOrgFile: filename,
            devices: this.guessDevices(filename)
        };
        
        return app;
    }

    // [Rest of the helper methods remain the same - parseIPAFilename, generateAppId, etc.]
    // I'll include them for completeness:

    parseIPAFilename(filename) {
        const nameWithoutExt = filename.replace(/\.ipa$/i, '');
        
        const result = {
            appName: '',
            version: null,
            iosVersion: null,
            developer: null
        };
        
        // Extract iOS version
        const iosMatch = nameWithoutExt.match(/iOS[\s-]*(\d+\.\d+(?:\.\d+)?)/i);
        if (iosMatch) {
            result.iosVersion = iosMatch[1];
        }
        
        // Extract version number
        const versionMatch = nameWithoutExt.match(/[vV][\s-]*(\d+\.\d+(?:\.\d+)?)/);
        if (versionMatch) {
            result.version = versionMatch[1];
        }
        
        // Extract app name
        let appName = nameWithoutExt;
        appName = appName.replace(/[-_\s]*(iOS|iPhoneOS)[\s-]*\d+\.\d+.*/i, '');
        appName = appName.replace(/[-_\s]*[vV][\s-]*\d+\.\d+.*/,'');
        appName = appName.replace(/[-_\s]*\(.*?\)/g, '');
        appName = appName.replace(/[-_]+/g, ' ');
        appName = appName.trim();
        
        const bundleMatch = appName.match(/^[a-z]+\.[a-z]+\.(.+)$/i);
        if (bundleMatch) {
            result.appName = this.titleCase(bundleMatch[1].replace(/[-_.]/g, ' '));
            const parts = appName.split('.');
            if (parts.length >= 2) {
                result.developer = this.titleCase(parts[1]);
            }
        } else {
            result.appName = this.titleCase(appName);
        }
        
        result.appName = result.appName || filename.replace(/\.ipa$/i, '');
        
        return result;
    }

    generateAppId(filename) {
        return filename
            .replace(/\.ipa$/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    generateFeaturedDescription(appName, description) {
        if (description && description.length > 50) {
            return description.substring(0, 100) + '...';
        }
        return `${appName} - A preserved legacy iOS application.`;
    }

    guessCategories(appName, description) {
        const text = (appName + ' ' + description).toLowerCase();
        const categories = [];
        
        if (text.match(/game|play|racing|puzzle|adventure|arcade|action|rpg|strategy/)) {
            categories.push('Games');
        }
        if (text.match(/productivity|office|document|note|calendar|task/)) {
            categories.push('Productivity');
        }
        if (text.match(/social|chat|messenger|facebook|twitter|instagram/)) {
            categories.push('Social');
        }
        if (text.match(/music|video|movie|tv|entertainment|streaming/)) {
            categories.push('Entertainment');
        }
        if (text.match(/utility|tool|calculator|converter|weather/)) {
            categories.push('Utilities');
        }
        if (text.match(/education|learn|study|school|math|science/)) {
            categories.push('Education');
        }
        
        if (categories.length === 0) {
            categories.push('Apps');
        }
        
        return categories;
    }

    guessDevices(filename) {
        const lower = filename.toLowerCase();
        const devices = [];
        
        if (lower.includes('ipad')) {
            devices.push('iPad');
        }
        if (lower.includes('iphone') || lower.includes('universal')) {
            devices.push('iPhone');
        }
        if (lower.includes('ipod')) {
            devices.push('iPod Touch');
        }
        
        if (devices.length === 0) {
            devices.push('iPhone');
        }
        
        return devices;
    }

    async fetchItemMetadata(identifier) {
        try {
            const url = `https://archive.org/metadata/${identifier}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching metadata for ${identifier}:`, error.message);
            return null;
        }
    }

    titleCase(str) {
        return str.replace(/\w\S*/g, txt => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    saveToCache() {
        try {
            const cacheData = {
                apps: this.processedApps,
                syncStatus: this.syncStatus,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('archiveOrgCache', JSON.stringify(cacheData));
            console.log('💾 Saved to cache');
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    loadFromCache() {
        try {
            const cached = localStorage.getItem('archiveOrgCache');
            if (cached) {
                const data = JSON.parse(cached);
                this.processedApps = data.apps || [];
                this.syncStatus = data.syncStatus || this.syncStatus;
                console.log(`📂 Loaded ${this.processedApps.length} apps from cache`);
                console.log(`⏰ Last sync: ${this.syncStatus.lastSync}`);
                return true;
            }
        } catch (error) {
            console.error('Error loading from cache:', error);
        }
        return false;
    }

    isCacheFresh() {
        if (!this.syncStatus.lastSync) return false;
        
        const lastSync = new Date(this.syncStatus.lastSync);
        const now = new Date();
        const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
        
        return hoursSinceSync < 24;
    }

    async getApps(forceSync = false) {
        if (!forceSync) {
            const hasCachedData = this.loadFromCache();
            if (hasCachedData && this.isCacheFresh()) {
                console.log('✨ Using cached data (fresh)');
                return this.processedApps;
            }
        }
        
        console.log('🔄 Cache miss or stale, syncing from Archive.org...');
        return await this.syncFromArchiveOrg();
    }

    getSyncStatus() {
        return {
            ...this.syncStatus,
            totalApps: this.processedApps.length
        };
    }

    exportAppsJSON() {
        return JSON.stringify(this.processedApps, null, 2);
    }
}

// Create global instance
window.archiveSync = new ArchiveOrgAutoSync();
