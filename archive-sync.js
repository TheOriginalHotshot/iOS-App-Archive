/**
 * Archive.org Auto-Sync System for iOS App Archive
 * Fetches all items from @legacyios_archive and automatically populates the app database
 * Works entirely client-side on GitHub Pages
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
     * Main sync function - fetches all your Archive.org items
     */
    async syncFromArchiveOrg() {
        console.log('🔄 Starting Archive.org sync...');
        console.log(`📡 Searching for items from: @${this.username}`);
        this.syncStatus.isRunning = true;
        this.syncStatus.itemsProcessed = 0;
        this.syncStatus.errors = [];
        
        try {
            // Fetch all items from your Archive.org account
            const items = await this.fetchAllUserItems();
            this.allItems = items;
            this.syncStatus.totalItems = items.length;
            
            if (items.length === 0) {
                console.error('❌ No items found! Please check:');
                console.error('   1. Username is correct: @legacyios_archive');
                console.error('   2. Items exist at: https://archive.org/details/@legacyios_archive');
                console.error('   3. Items are public (not dark)');
                return [];
            }
            
            console.log(`📦 Found ${items.length} items in your Archive.org collection`);
            console.log(`🔍 Sample items:`, items.slice(0, 3).map(i => i.identifier || i.id));
            
            // Process each item to extract IPA files
            for (const item of items) {
                try {
                    await this.processItem(item);
                    this.syncStatus.itemsProcessed++;
                    
                    // Update progress
                    if (this.syncStatus.itemsProcessed % 10 === 0) {
                        console.log(`⏳ Progress: ${this.syncStatus.itemsProcessed}/${this.syncStatus.totalItems}`);
                    }
                } catch (error) {
                    console.error(`❌ Error processing item ${item.identifier || item.id}:`, error);
                    this.syncStatus.errors.push({
                        item: item.identifier || item.id,
                        error: error.message
                    });
                }
            }
            
            this.syncStatus.lastSync = new Date().toISOString();
            this.syncStatus.isRunning = false;
            
            console.log(`✅ Sync complete! Processed ${this.processedApps.length} apps from ${items.length} items`);
            console.log(`📊 Success: ${this.syncStatus.itemsProcessed}/${this.syncStatus.totalItems}`);
            if (this.syncStatus.errors.length > 0) {
                console.log(`⚠️  Errors: ${this.syncStatus.errors.length}`);
                console.log('Error details:', this.syncStatus.errors);
            }
            
            // Log some sample apps
            if (this.processedApps.length > 0) {
                console.log('📱 Sample apps found:', this.processedApps.slice(0, 3).map(a => a.title));
            }
            
            // Save to localStorage as cache
            this.saveToCache();
            
            return this.processedApps;
            
        } catch (error) {
            console.error('❌ Fatal sync error:', error);
            console.error('Stack trace:', error.stack);
            this.syncStatus.isRunning = false;
            throw error;
        }
    }

    /**
     * Fetch all items uploaded by your Archive.org account
     * Uses the Archive.org Advanced Search API
     */
    async fetchAllUserItems() {
        const allItems = [];
        let page = 1;
        const rows = 100;
        let hasMore = true;
        
        while (hasMore) {
            try {
                // Use Archive.org Advanced Search API
                // Query format: uploader:@username or creator:username
                const url = `https://archive.org/advancedsearch.php?q=uploader%3A%40${this.username}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=item_size&output=json&rows=${rows}&page=${page}`;
                
                console.log(`🔍 Fetching page ${page} from Archive.org...`);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.response && data.response.docs && data.response.docs.length > 0) {
                    allItems.push(...data.response.docs);
                    console.log(`📄 Found ${data.response.docs.length} items on page ${page}`);
                    
                    // Check if there are more pages
                    const totalResults = data.response.numFound || 0;
                    const fetchedSoFar = page * rows;
                    hasMore = fetchedSoFar < totalResults && data.response.docs.length === rows;
                    page++;
                } else {
                    hasMore = false;
                }
                
                // Small delay to be respectful to Archive.org servers
                await this.delay(500);
                
            } catch (error) {
                console.error('Error fetching user items:', error);
                
                // Try alternate query format (creator instead of uploader)
                if (page === 1) {
                    try {
                        console.log('🔄 Trying alternate query format (creator)...');
                        const altUrl = `https://archive.org/advancedsearch.php?q=creator%3A${this.username}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=item_size&output=json&rows=${rows}&page=${page}`;
                        
                        const altResponse = await fetch(altUrl);
                        const altData = await altResponse.json();
                        
                        if (altData.response && altData.response.docs && altData.response.docs.length > 0) {
                            allItems.push(...altData.response.docs);
                            console.log(`✅ Found ${altData.response.docs.length} items with alternate query`);
                            page++;
                            hasMore = true;
                            continue;
                        }
                    } catch (altError) {
                        console.error('Alternate query also failed:', altError);
                    }
                }
                
                hasMore = false;
            }
        }
        
        if (allItems.length === 0) {
            console.warn(`⚠️  No items found for username: @${this.username}`);
            console.warn('Please check:');
            console.warn('1. Username is correct (currently: @legacyios_archive)');
            console.warn('2. Items are public on Archive.org');
            console.warn('3. You have actually uploaded items');
        }
        
        return allItems;
    }

    /**
     * Process a single Archive.org item to extract IPA files and metadata
     */
    async processItem(item) {
        // Fetch detailed metadata for this item
        const metadata = await this.fetchItemMetadata(item.identifier);
        
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
        
        // Find PNG icon files (usually named like app icon, icon.png, etc.)
        const iconFiles = metadata.files.filter(file => 
            file.name && file.name.toLowerCase().endsWith('.png') && 
            (file.name.toLowerCase().includes('icon') || 
             file.name.toLowerCase().includes('logo') ||
             file.name.toLowerCase().match(/^[^\/]+\.png$/)) // Simple filename.png
        );
        
        // Get item description from metadata
        const description = metadata.metadata.description || 
                          metadata.metadata.title || 
                          '';
        
        // Process each IPA file as a separate app
        for (const ipaFile of ipaFiles) {
            const app = this.createAppFromIPA(ipaFile, iconFiles, description, item.identifier);
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
            // Prefer icons with similar names to the IPA
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
        
        // Create app object matching your existing format
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

    /**
     * Parse IPA filename to extract app info
     * Common patterns:
     * - AppName-v1.0--iOS6.0-(Clutch-1.4.6).ipa
     * - com.developer.appname-iOS4.0-(Clutch-2.0.4).ipa
     * - AppName (V1.0) (iOS4.0).ipa
     */
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
        
        // Extract app name (before version or iOS indicators)
        let appName = nameWithoutExt;
        
        // Remove common suffixes
        appName = appName.replace(/[-_\s]*(iOS|iPhoneOS)[\s-]*\d+\.\d+.*/i, '');
        appName = appName.replace(/[-_\s]*[vV][\s-]*\d+\.\d+.*/,'');
        appName = appName.replace(/[-_\s]*\(.*?\)/g, ''); // Remove parentheses content
        appName = appName.replace(/[-_]+/g, ' '); // Replace dashes/underscores with spaces
        appName = appName.trim();
        
        // If it starts with bundle ID format (com.developer.app), extract app name
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
        
        // Clean up app name
        result.appName = result.appName || filename.replace(/\.ipa$/i, '');
        
        return result;
    }

    /**
     * Generate a unique app ID from filename
     */
    generateAppId(filename) {
        return filename
            .replace(/\.ipa$/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Generate a featured description
     */
    generateFeaturedDescription(appName, description) {
        if (description && description.length > 50) {
            return description.substring(0, 100) + '...';
        }
        return `${appName} - A preserved legacy iOS application.`;
    }

    /**
     * Guess app categories based on name and description
     */
    guessCategories(appName, description) {
        const text = (appName + ' ' + description).toLowerCase();
        const categories = [];
        
        // Game indicators
        if (text.match(/game|play|racing|puzzle|adventure|arcade|action|rpg|strategy/)) {
            categories.push('Games');
        }
        
        // Productivity
        if (text.match(/productivity|office|document|note|calendar|task/)) {
            categories.push('Productivity');
        }
        
        // Social
        if (text.match(/social|chat|messenger|facebook|twitter|instagram/)) {
            categories.push('Social');
        }
        
        // Entertainment
        if (text.match(/music|video|movie|tv|entertainment|streaming/)) {
            categories.push('Entertainment');
        }
        
        // Utility
        if (text.match(/utility|tool|calculator|converter|weather/)) {
            categories.push('Utilities');
        }
        
        // Education
        if (text.match(/education|learn|study|school|math|science/)) {
            categories.push('Education');
        }
        
        // If no categories matched, use "Apps"
        if (categories.length === 0) {
            categories.push('Apps');
        }
        
        return categories;
    }

    /**
     * Guess which devices the app supports
     */
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
        
        // Default to iPhone if nothing specified
        if (devices.length === 0) {
            devices.push('iPhone');
        }
        
        return devices;
    }

    /**
     * Fetch detailed metadata for a specific Archive.org item
     */
    async fetchItemMetadata(identifier) {
        try {
            const url = `https://archive.org/metadata/${identifier}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching metadata for ${identifier}:`, error);
            return null;
        }
    }

    /**
     * Helper: Title case conversion
     */
    titleCase(str) {
        return str.replace(/\w\S*/g, txt => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    /**
     * Helper: Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Save processed apps to localStorage cache
     */
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

    /**
     * Load processed apps from localStorage cache
     */
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

    /**
     * Check if cache is fresh (less than 24 hours old)
     */
    isCacheFresh() {
        if (!this.syncStatus.lastSync) return false;
        
        const lastSync = new Date(this.syncStatus.lastSync);
        const now = new Date();
        const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);
        
        return hoursSinceSync < 24;
    }

    /**
     * Get apps - from cache if fresh, otherwise sync
     */
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

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            ...this.syncStatus,
            totalApps: this.processedApps.length
        };
    }

    /**
     * Export apps as JSON (for debugging or manual download)
     */
    exportAppsJSON() {
        return JSON.stringify(this.processedApps, null, 2);
    }
}

// Create global instance
window.archiveSync = new ArchiveOrgAutoSync();
