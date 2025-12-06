// ====================================
// POKEMON GO TEAM BUILDER - MAIN APP
// ====================================
// Main application controller and database initialization
// Handles app state, navigation, search, and data loading

// ====================================
// DATABASE INITIALIZATION
// ====================================

/**
 * Initialize IndexedDB with all required object stores
 * Creates stores for: pokemon, moves, metadata, typeEffectiveness, rankings, userPokemon
 * Database is populated by AutoUpdateManager in index.html
 * @returns {Promise<IDBDatabase>} The initialized database instance
 */
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PokemonGoDB', 5);
        
        request.onerror = () => reject(request.error);
        
        // Create/upgrade database schema
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Cup data store (Default Leagues, Special Cups)
            if (!db.objectStoreNames.contains('cups')) {
                db.createObjectStore('cups', { keyPath: 'id' });
            }
            
            // Pokemon data store with dexNumber index for lookups
            if (!db.objectStoreNames.contains('pokemon')) {
                const pokemonStore = db.createObjectStore('pokemon', { keyPath: 'id' });
                pokemonStore.createIndex('dexNumber', 'dexNumber', { unique: false });
            }
            
            // Move data store (Fast Moves & Charged Moves)
            if (!db.objectStoreNames.contains('moves')) {
                db.createObjectStore('moves', { keyPath: 'id' });
            }
            
            // Metadata store (game constants, version info, etc.)
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
            
            // Type effectiveness matrix
            if (!db.objectStoreNames.contains('typeEffectiveness')) {
                db.createObjectStore('typeEffectiveness', { keyPath: 'id' });
            }
            
            // PVP rankings data (Great League, Ultra League, Master League, Cups)
            if (!db.objectStoreNames.contains('rankings')) {
                const rankingsStore = db.createObjectStore('rankings', { keyPath: 'id' });
                rankingsStore.createIndex('league', 'league', { unique: false });
                rankingsStore.createIndex('cupName', 'cupName', { unique: false });
                rankingsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // User's pokemon collection
            if (!db.objectStoreNames.contains('userPokemon')) {
                const userPokemonStore = db.createObjectStore('userPokemon', { keyPath: 'id' });
                userPokemonStore.createIndex('name', 'name', { unique: false });
                userPokemonStore.createIndex('dateAdded', 'dateUploaded', { unique: false });
                userPokemonStore.createIndex('dateCaught', 'dateCaught', { unique: false });
            }
        };
        
        // Database is ready - no need to load initial data
        // AutoUpdateManager handles all data population
        request.onsuccess = (event) => {
            const db = event.target.result;
            resolve(db);
        };
    });
}

// ====================================
// MAIN APP CLASS
// ====================================

/**
 * PokeApp - Main application controller
 * Manages app state, navigation, data loading, and rendering
 */
class PokeApp {
    constructor() {
        // ---- VIEW STATE ----
        this.currentView = 'menu';              // Current screen: 'menu', 'pokedex', 'collection'
        this.currentList = 'pokemon';           // Current list type: 'pokemon', 'fast', 'charge'
        this.searchTerm = '';                   // Current search query
        this.loading = false;                   // Loading state for data fetch
        
        // ---- DATA CACHES ----
        this.pokemon = [];                      // All pokemon data from IndexedDB
        this.moves = [];                        // All moves data from IndexedDB
        
        // ---- SELECTION STATE ----
        this.selectedPokemon = null;            // Currently selected pokemon for detail view
        this.selectedForm = null;               // Currently selected form variant
        this.selectedMove = null;               // Currently selected move for detail view
        
        // ---- UI STATE ----
        this.expandedSections = {};             // Track which detail sections are expanded
        this.expandedMoves = {};                // Track which move cards are expanded
        this.moveMode = 'pvp';                  // Move display mode: 'pvp' or 'pve'
        this.showTagInput = false;              // Show/hide tag input field
        
        // ---- USER DATA (localStorage) ----
        this.userTags = {};                     // User tags for pokemon {pokemonId: [tag1, tag2]}
        this.moveTags = {};                     // User tags for moves {moveId: [tag1, tag2]}
        
        // ---- TOUCH INTERACTION STATE ----
        this.touchStartX = 0;                   // Touch start X coordinate
        this.touchStartY = 0;                   // Touch start Y coordinate
        this.touchEndY = 0;                     // Touch end Y coordinate
        this.longPressTimer = null;             // Timer for long-press detection
        
        // ---- FEATURE MODULES ----
        this.screenshotProcessor = new ScreenshotProcessor(this);   // OCR screenshot handler
        this.userCollection = new UserCollectionManager(this);      // User collection manager
        this.catchReport = new CatchReport(this);                   // Catch report generator
        
        // Initialize app
        this.loadUserTags();
        this.loadFromIndexedDB();
        this.render();
    }

    // ====================================
    // DATABASE LOADING
    // ====================================

    /**
     * Load pokemon and moves data from IndexedDB
     * Sets loading state and triggers render when complete
     */
    loadFromIndexedDB() {
        this.loading = true;
        this.render();

        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            
            // Load all pokemon
            const pokemonTransaction = db.transaction(['pokemon'], 'readonly');
            const pokemonStore = pokemonTransaction.objectStore('pokemon');
            const pokemonRequest = pokemonStore.getAll();
            
            pokemonRequest.onsuccess = () => {
                this.pokemon = pokemonRequest.result || [];
                this.checkLoadComplete();
            };

            // Load all moves
            const movesTransaction = db.transaction(['moves'], 'readonly');
            const movesStore = movesTransaction.objectStore('moves');
            const movesRequest = movesStore.getAll();
            
            movesRequest.onsuccess = () => {
                this.moves = movesRequest.result || [];
                this.checkLoadComplete();
            };
        };

        dbRequest.onerror = () => {
            this.loading = false;
            this.render();
        };
    }

    /**
     * Check if both pokemon and moves data have loaded
     * Triggers render when both datasets are ready
     */
    checkLoadComplete() {
        if (this.pokemon.length > 0 && this.moves.length > 0) {
            this.loading = false;
            this.render();
        }
    }

    // ====================================
    // USER TAGS (localStorage)
    // ====================================
    // Tags are stored in localStorage for quick access
    // Format: {itemId: [tag1, tag2, ...]}

    /**
     * Load user tags from localStorage
     * Loads both pokemon tags and move tags
     */
    loadUserTags() {
        const stored = localStorage.getItem('pokemonTags');
        if (stored) this.userTags = JSON.parse(stored);
        
        const moveTags = localStorage.getItem('moveTags');
        if (moveTags) this.moveTags = JSON.parse(moveTags);
    }

    /**
     * Save pokemon tags to localStorage
     */
    saveUserTags() {
        localStorage.setItem('pokemonTags', JSON.stringify(this.userTags));
    }

    /**
     * Save move tags to localStorage
     */
    saveMoveTags() {
        localStorage.setItem('moveTags', JSON.stringify(this.moveTags));
    }

    /**
     * Add a tag to a pokemon or move
     * @param {string} itemId - The pokemon or move ID
     * @param {string} tag - The tag text to add
     * @param {boolean} isMove - Whether this is a move tag (default: false for pokemon)
     */
    addTag(itemId, tag, isMove = false) {
        const tags = isMove ? this.moveTags : this.userTags;
        if (!tags[itemId]) tags[itemId] = [];
        if (!tags[itemId].includes(tag)) {
            tags[itemId].push(tag);
            isMove ? this.saveMoveTags() : this.saveUserTags();
            this.showTagInput = false;
            this.render();
        }
    }

    /**
     * Remove a tag from a pokemon or move
     * @param {string} itemId - The pokemon or move ID
     * @param {string} tag - The tag text to remove
     * @param {boolean} isMove - Whether this is a move tag (default: false for pokemon)
     */
    removeTag(itemId, tag, isMove = false) {
        const tags = isMove ? this.moveTags : this.userTags;
        if (tags[itemId]) {
            tags[itemId] = tags[itemId].filter(t => t !== tag);
            isMove ? this.saveMoveTags() : this.saveUserTags();
            this.render();
        }
    }

    // ====================================
    // SEARCH & FILTERING
    // ====================================

    /**
     * Update search term and refresh the current view
     * @param {string} term - The search query
     */
    setSearchTerm(term) {
        this.searchTerm = term;
        this.updateCurrentView();
    }

    /**
     * Group pokemon by dex number (handles multiple forms)
     * @returns {Array<Array>} Array of pokemon form groups
     */
    getGroupedPokemon() {
        const grouped = {};
        this.pokemon.forEach(p => {
            if (!grouped[p.dexNumber]) grouped[p.dexNumber] = [];
            grouped[p.dexNumber].push(p);
        });
        return Object.values(grouped);
    }

    /**
     * Filter pokemon groups by search term
     * Searches both name and dex number
     * @returns {Array<Array>} Filtered array of pokemon form groups
     */
    getFilteredPokemonGroups() {
        if (!this.searchTerm) return this.getGroupedPokemon();
        const term = this.searchTerm.toLowerCase();
        return this.getGroupedPokemon().filter(forms => 
            forms[0].name.toLowerCase().includes(term) ||
            forms[0].dexNumber.toString().includes(term)
        );
    }

    /**
     * Get search results across all categories (fast moves, charge moves, pokemon)
     * @returns {Object|null} Object with fast, charge, and pokemon arrays, or null if no search
     */
    getSearchResults() {
        if (!this.searchTerm) return null;
        
        const term = this.searchTerm.toLowerCase();
        return {
            fast: this.getUniqueMoves('fast').filter(m => m.name.toLowerCase().includes(term)),
            charge: this.getUniqueMoves('charge').filter(m => m.name.toLowerCase().includes(term)),
            pokemon: this.getGroupedPokemon().filter(forms => 
                forms[0].name.toLowerCase().includes(term) ||
                forms[0].dexNumber.toString().includes(term)
            )
        };
    }

    /**
     * Get unique moves by category (removes duplicates by name)
     * @param {string} category - Move category: 'fast' or 'charge'
     * @returns {Array} Array of unique move objects
     */
    getUniqueMoves(category) {
        const unique = new Map();
        this.moves.filter(m => m.category === category && m.mode === this.moveMode)
            .forEach(m => unique.set(m.name, m));
        return Array.from(unique.values());
    }

    /**
     * Get filtered moves by category and search term
     * @param {string} category - Move category: 'fast' or 'charge'
     * @returns {Array} Filtered array of move objects
     */
    getFilteredMoves(category) {
        const moves = this.getUniqueMoves(category);
        if (!this.searchTerm) return moves;
        const term = this.searchTerm.toLowerCase();
        return moves.filter(m => m.name.toLowerCase().includes(term));
    }

    /**
     * Update the current view's content (without full re-render)
     * Used for search updates to avoid losing scroll position
     */
    updateCurrentView() {
        const gridContainer = document.querySelector('[data-content-grid]');
        if (gridContainer && !this.selectedPokemon && !this.selectedMove) {
            if (this.searchTerm) {
                gridContainer.innerHTML = this.renderSearchResults();
            } else if (this.currentList === 'pokemon') {
                gridContainer.innerHTML = this.renderPokemonGrid();
            } else if (this.currentList === 'fast') {
                gridContainer.innerHTML = renderMoveList.call(this, 'fast');
            } else if (this.currentList === 'charge') {
                gridContainer.innerHTML = renderMoveList.call(this, 'charge');
            }
            this.attachListListeners();
        }
    }

    // ====================================
    // NAVIGATION & VIEW MANAGEMENT
    // ====================================

    /**
     * Change the main view and reset selection state
     * @param {string} view - View name: 'menu', 'pokedex', 'collection'
     */
    setView(view) {
        this.currentView = view;
        this.selectedPokemon = null;
        this.selectedForm = null;
        this.selectedMove = null;
        this.expandedSections = {};
        this.expandedMoves = {};
        this.searchTerm = '';
        this.moveMode = 'pvp';
        this.currentList = 'pokemon';
        this.showTagInput = false;
        this.render();
    }

    /**
     * Change the current list type in pokedex view
     * @param {string} list - List type: 'pokemon', 'fast', 'charge'
     */
    setList(list) {
        this.currentList = list;
        this.searchTerm = '';
        this.render();
    }

    /**
     * Get all forms for a specific pokemon by dex number
     * @param {number} dexNumber - The pokemon's dex number
     * @returns {Array} Array of pokemon form objects
     */
    getPokemonForms(dexNumber) {
        return this.pokemon.filter(p => p.dexNumber === dexNumber);
    }

    // ====================================
    // TOUCH HANDLING
    // ====================================

    /**
     * Handle touch start event
     * Records touch position and starts long-press timer for moves
     * @param {TouchEvent} e - Touch event
     * @param {string} context - Context: 'detail', 'move', etc.
     */
    handleTouchStart(e, context) {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
        
        // Long-press on move card opens move detail
        if (context === 'move') {
            this.longPressTimer = setTimeout(() => {
                const moveCard = e.target.closest('[data-move-name]');
                if (moveCard) {
                    const moveName = moveCard.dataset.moveName;
                    const category = moveCard.dataset.moveCategory;
                    const moveData = this.getMoveDetails(moveName, category, this.moveMode);
                    if (moveData) selectMove.call(this, moveData);
                }
            }, 500); // 500ms long-press threshold
        }
    }

    /**
     * Handle touch end event
     * Clears long-press timer and detects swipe gestures
     * @param {TouchEvent} e - Touch event
     * @param {string} context - Context: 'detail', 'move', etc.
     */
    handleTouchEnd(e, context) {
        clearTimeout(this.longPressTimer);
        this.touchEndY = e.changedTouches[0].screenY;
        
        // Swipe down on detail view to close
        if (context === 'detail' && this.selectedPokemon) {
            const diffY = this.touchStartY - this.touchEndY;
            if (diffY < -100) { // 100px swipe down threshold
                this.selectedPokemon = null;
                this.selectedForm = null;
                this.render();
            }
        }
    }

    // ====================================
    // RENDERING - MAIN VIEWS
    // ====================================

    /**
     * Main render function - routes to appropriate view renderer
     */
    async render() {
        const app = document.getElementById('app');
        
        if (this.currentView === 'menu') {
            app.innerHTML = this.renderMenu();
        } else if (this.currentView === 'collection') {
            app.innerHTML = this.userCollection.render();
        } else if (this.currentView === 'pve') {  // ADD THIS
            app.innerHTML = this.renderPvEView();
        } else if (this.currentView === 'pokedex') {
            if (this.selectedPokemon) {
                app.innerHTML = await renderPokemonDetail.call(this);
            } else if (this.selectedMove) {
                app.innerHTML = renderMoveDetail.call(this);
            } else {
                app.innerHTML = this.renderPokedexView();
            }
        }

        this.attachEventListeners();
    }

    /**
     * Render main menu view
     * Shows 5 menu items and 2 FAB buttons
     * @returns {string} HTML string
     */
    renderMenu() {
        const buildTime = document.lastModified || new Date().toISOString();
        const commitHash = '{{COMMIT_HASH}}'; // Replaced by GitHub Actions during build
        
        return `
            <div class="min-h-screen bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 flex flex-col items-center justify-center p-8">
                <div class="w-full max-w-md space-y-4">
                    ${this.renderMenuItem('fa-solid fa-book', 'POKÉDEX', 'pokedex')}
                    ${this.renderMenuItem('fa-solid fa-star', 'COLLECTION', 'collection')}
                    ${this.renderMenuItem('fa-solid fa-users', 'PVP', null)}
                    ${this.renderMenuItem('fa-solid fa-rocket', 'PVE', 'pve')}
                    ${this.renderMenuItem('fa-solid fa-message', 'FEEDBACK', null)}
                </div>
                
                <!-- FAB: Team Builder (left) - may change -->
                <button class="fab-button fab-left bg-blue-500 text-white" data-action="team-builder">
                    <i class="fa-solid fa-calculator text-xl"></i>
                </button>
                
                <!-- FAB: Add Pokemon (right) - primary action -->
                <button class="fab-button fab-right bg-purple-500 text-white" data-action="add-pokemon">
                    <i class="fa-solid fa-plus text-xl"></i>
                </button>
                
                <!-- Build timestamp (dev purposes) -->
                <div class="fixed bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm font-mono">
                    ${buildTime.split(' ')[0]} ${buildTime.split(' ')[1]?.substring(0,5) || ''}
                    ${commitHash !== '{{COMMIT_HASH}}' ? `<br>${commitHash}` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render a single menu item button
     * @param {string} icon - FontAwesome icon class
     * @param {string} label - Button label text
     * @param {string|null} view - View to navigate to, null for disabled items
     * @returns {string} HTML string
     */
    renderMenuItem(icon, label, view) {
        const disabled = view === null;
        return `
            <button 
                class="menu-item w-full bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6 flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                ${disabled ? 'disabled' : `data-view="${view}"`}
            >
                <span class="text-white text-xl font-light tracking-widest">${label}</span>
                <i class="${icon} text-white text-opacity-80 text-2xl"></i>
            </button>
        `;
    }

    /**
     * Render pokedex view (list view with search and FABs)
     * Shows pokemon grid, fast moves, or charge moves based on currentList
     * @returns {string} HTML string
     */
    renderPokedexView() {
        const fabsHidden = this.searchTerm ? 'hidden' : '';
        
        // Determine FAB button configuration based on current list
        let leftFab, rightFab;
        if (this.currentList === 'pokemon') {
            leftFab = { icon: 'fa-bolt', color: 'bg-yellow-500', action: 'fast' };
            rightFab = { icon: 'fa-battery-three-quarters', color: 'bg-blue-500', action: 'charge' };
        } else if (this.currentList === 'fast') {
            leftFab = { icon: 'fa-battery-three-quarters', color: 'bg-blue-500', action: 'charge' };
            rightFab = { icon: 'fa-dragon', color: 'bg-red-500', action: 'pokemon' };
        } else {
            leftFab = { icon: 'fa-dragon', color: 'bg-red-500', action: 'pokemon' };
            rightFab = { icon: 'fa-bolt', color: 'bg-yellow-500', action: 'fast' };
        }

        return `
            <div class="min-h-screen pokedex-bg pb-20">
                <!-- Search header (sticky) -->
                <div class="bg-white bg-opacity-15 backdrop-blur-sm p-4 sticky top-0 z-20">
                    <div class="max-w-6xl mx-auto">
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 transform -translate-y-1/2 text-teal-600"></i>
                            <input
                                type="text"
                                placeholder="Search..."
                                value="${this.searchTerm}"
                                data-action="search"
                                class="w-full bg-white bg-opacity-90 rounded-full py-3 pl-12 pr-4 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
                            />
                        </div>
                        <button data-action="advanced-filters" class="mt-2 text-white text-sm opacity-75 hover:opacity-100">
                            <i class="fa-solid fa-filter mr-1"></i> Advanced Filters
                        </button>
                    </div>
                </div>

                <!-- Content grid -->
                <div class="max-w-6xl mx-auto p-4" data-content-grid>
                    ${this.loading ? 
                        '<div class="text-black text-center py-20">Loading...</div>' :
                        this.searchTerm ? this.renderSearchResults() :
                        this.currentList === 'pokemon' ? this.renderPokemonGrid() :
                        this.currentList === 'fast' ? renderMoveList.call(this, 'fast') :
                        renderMoveList.call(this, 'charge')
                    }
                </div>
                
                <!-- FAB buttons (hidden during search) -->
                <button class="fab-button fab-left ${leftFab.color} text-white ${fabsHidden}" data-action="set-list" data-list="${leftFab.action}">
                    <i class="fa-solid ${leftFab.icon} text-xl"></i>
                </button>
                <button class="fab-button fab-right ${rightFab.color} text-white ${fabsHidden}" data-action="set-list" data-list="${rightFab.action}">
                    <i class="fa-solid ${rightFab.icon} text-xl"></i>
                </button>
                <button class="fab-button fab-center bg-gray-600 text-white" data-action="back">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render PvE view with Raid/Gym and Rocket tabs
     * @returns {string} HTML string
     */
    renderPvEView() {
        const currentTab = this.pveTab || 'raid';
        
        return `
            <div class="min-h-screen pokedex-bg pb-20">
                <!-- Header with tabs -->
                <div class="bg-white bg-opacity-15 backdrop-blur-sm p-4 sticky top-0 z-20">
                    <div class="max-w-7xl mx-auto">
                        <div class="flex gap-2 mb-4">
                            <button 
                                data-action="pve-tab" 
                                data-tab="raid"
                                class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${currentTab === 'raid' ? 'bg-white text-teal-600' : 'bg-white/20 text-white'}"
                            >
                                <i class="fa-solid fa-tower-observation mr-2"></i>
                                Raid / Gym
                            </button>
                            <button 
                                data-action="pve-tab" 
                                data-tab="rocket"
                                class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${currentTab === 'rocket' ? 'bg-white text-teal-600' : 'bg-white/20 text-white'}"
                            >
                                <i class="fa-solid fa-rocket mr-2"></i>
                                Team Rocket
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Content -->
                <div class="max-w-7xl mx-auto p-4">
                    ${currentTab === 'raid' ? this.renderRaidTab() : this.renderRocketTab()}
                </div>
                
                <!-- Back FAB -->
                <button class="fab-button fab-center bg-gray-600 text-white" data-action="back">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
        `;
    }

    /**
     * Render Raid/Gym tab content
     * @returns {string} HTML string
     */
    renderRaidTab() {
        const defenderType1 = this.raidDefenderType1 || '';
        const defenderType2 = this.raidDefenderType2 || '';
        
        const types = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
        
        return `
            <!-- Controls -->
            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                <div class="flex items-start gap-4">
                    <div class="flex-1">
                        <label class="text-white text-sm font-semibold mb-2 block">Defender Type</label>
                        <div class="flex gap-3">
                            <select 
                                data-action="raid-type-1" 
                                class="flex-1 bg-white/90 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-white"
                            >
                                <option value="">Select Type 1</option>
                                ${types.map(t => `<option value="${t}" ${t === defenderType1 ? 'selected' : ''}>${t.charAt(0) + t.slice(1).toLowerCase()}</option>`).join('')}
                            </select>
                            <select 
                                data-action="raid-type-2" 
                                class="flex-1 bg-white/90 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-white"
                            >
                                <option value="">Type 2 (Optional)</option>
                                ${types.map(t => `<option value="${t}" ${t === defenderType2 ? 'selected' : ''}>${t.charAt(0) + t.slice(1).toLowerCase()}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <button 
                        data-action="raid-help"
                        class="mt-7 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                        title="Help"
                    >
                        <i class="fa-solid fa-question text-sm"></i>
                    </button>
                </div>
                
                <div class="flex gap-4 mt-4">
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="legendary" checked class="w-4 h-4">
                        <span class="text-sm">Include Legendary</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mythical" checked class="w-4 h-4">
                        <span class="text-sm">Include Mythical</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mega" checked class="w-4 h-4">
                        <span class="text-sm">Include Mega</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="shadow" checked class="w-4 h-4">
                        <span class="text-sm">Include Shadow</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="xl" checked class="w-4 h-4">
                        <span class="text-sm">Include XL (Lv50)</span>
                    </label>
                </div>
            </div>

            ${defenderType1 ? this.renderRaidLists() : `
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
                    <i class="fa-solid fa-tower-observation text-white/50 text-6xl mb-4"></i>
                    <p class="text-white text-lg">Select a defender type to see recommendations</p>
                </div>
            `}
        `;
    }

    /**
     * Render Rocket tab content
     * @returns {string} HTML string
     */
    renderRocketTab() {
        return `
            <!-- Controls -->
            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                <div class="flex items-start gap-4">
                    <div class="flex-1">
                        <label class="text-white text-sm font-semibold mb-2 block">Rocket Member</label>
                        <select 
                            data-action="rocket-member" 
                            class="w-full bg-white/90 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-white"
                        >
                            <option value="">Select Member</option>
                            <optgroup label="Leaders">
                                <option value="leader:giovanni">Giovanni</option>
                                <option value="leader:cliff">Cliff</option>
                                <option value="leader:arlo">Arlo</option>
                                <option value="leader:sierra">Sierra</option>
                            </optgroup>
                            <optgroup label="Grunts">
                                <option value="grunt:Bug">Bug Grunt</option>
                                <option value="grunt:Dark">Dark Grunt</option>
                                <option value="grunt:Dragon">Dragon Grunt</option>
                                <option value="grunt:Electric">Electric Grunt</option>
                                <option value="grunt:Fairy">Fairy Grunt</option>
                                <option value="grunt:Fighting">Fighting Grunt</option>
                                <option value="grunt:Fire">Fire Grunt</option>
                                <option value="grunt:Flying">Flying Grunt</option>
                                <option value="grunt:Ghost">Ghost Grunt</option>
                                <option value="grunt:Grass">Grass Grunt</option>
                                <option value="grunt:Ground">Ground Grunt</option>
                                <option value="grunt:Ice">Ice Grunt</option>
                                <option value="grunt:Normal">Normal Grunt</option>
                                <option value="grunt:Poison">Poison Grunt</option>
                                <option value="grunt:Psychic">Psychic Grunt</option>
                                <option value="grunt:Rock">Rock Grunt</option>
                                <option value="grunt:Steel">Steel Grunt</option>
                                <option value="grunt:Water">Water Grunt</option>
                                <option value="grunt:Typeless">Typeless Grunt</option>
                                <option value="grunt:Decoy">Decoy Grunt</option>
                            </optgroup>
                        </select>
                    </div>
                    <button 
                        data-action="rocket-help"
                        class="mt-7 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                        title="Help"
                    >
                        <i class="fa-solid fa-question text-sm"></i>
                    </button>
                </div>
                
                <div class="flex gap-4 mt-4">
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="legendary" checked class="w-4 h-4">
                        <span class="text-sm">Include Legendary</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mythical" checked class="w-4 h-4">
                        <span class="text-sm">Include Mythical</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mega" checked class="w-4 h-4">
                        <span class="text-sm">Include Mega</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="shadow" checked class="w-4 h-4">
                        <span class="text-sm">Include Shadow</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="xl" checked class="w-4 h-4">
                        <span class="text-sm">Include XL (Lv50)</span>
                    </label>
                </div>
            </div>

            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
                <i class="fa-solid fa-rocket text-white/50 text-6xl mb-4"></i>
                <p class="text-white text-lg">Select a Rocket member to see recommendations</p>
            </div>
        `;
    }

    /**
     * Render the three-column layout for raid lists
     * @returns {string} HTML string
     */
    renderRaidLists() {
        const wishlist = this.calculateRaidWishlist();
        
        return `
            <div class="grid grid-cols-3 gap-6">
                <!-- Current Best -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-star mr-2"></i>
                        Current Best
                    </h3>
                    <div class="space-y-4">
                        <div class="text-white/70 text-sm text-center py-8">
                            Coming soon - will show your best Pokemon from your collection
                        </div>
                    </div>
                </div>

                <!-- To-Do -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-list-check mr-2"></i>
                        To-Do
                    </h3>
                    <div class="space-y-4">
                        <div class="text-white/70 text-sm text-center py-8">
                            Coming soon - will show investment priorities from your collection
                        </div>
                    </div>
                </div>

                <!-- Wishlist -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
                        Wishlist
                    </h3>
                    
                    ${wishlist.damage.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="text-white/80 text-sm font-semibold mb-3">
                                <i class="fa-solid fa-bolt mr-1"></i>
                                Damage Focused
                            </h4>
                            <div class="space-y-2">
                                ${wishlist.damage.map(p => this.renderPokemonListItem(p)).join('')}
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-white/80 text-sm font-semibold mb-3">
                                <i class="fa-solid fa-shield mr-1"></i>
                                Survivability Focused
                            </h4>
                            <div class="space-y-2">
                                ${wishlist.survivability.map(p => this.renderPokemonListItem(p)).join('')}
                            </div>
                        </div>
                    ` : `
                        <div class="text-white/70 text-sm text-center py-8">
                            No recommendations available for this type combination
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Render a single Pokemon list item for PvE lists
     * @param {Object} pokemon - Pokemon data with name, form, badges, level
     * @returns {string} HTML string
     */
    renderPokemonListItem(pokemon) {
        const badges = [];
        if (pokemon.isShadow) badges.push('<span class="text-xs px-2 py-0.5 rounded-full bg-purple-500/80">Shadow</span>');
        if (pokemon.isMega) badges.push('<span class="text-xs px-2 py-0.5 rounded-full bg-orange-500/80">Mega</span>');
        if (pokemon.requiresXL) badges.push('<span class="text-xs px-2 py-0.5 rounded-full bg-red-500/80">XL</span>');
        
        const displayName = pokemon.name + (pokemon.form ? ` (${pokemon.form})` : '') + (pokemon.megaForm ? ` ${pokemon.megaForm}` : '');
        
        return `
            <div class="bg-white/10 hover:bg-white/20 rounded-lg p-3 cursor-pointer transition-colors flex items-center justify-between gap-2">
                <span class="text-white text-sm font-medium">${displayName}</span>
                <div class="flex gap-1 flex-shrink-0">
                    ${badges.join('')}
                </div>
            </div>
        `;
    }

    /**
     * Calculate wishlist rankings for current defender type
     * Uses simulation functions from AutoUpdateManager
     * @returns {Object} Object with damage and survivability arrays
     */
    calculateRaidWishlist() {
        if (!this.raidDefenderType1) {
            return { damage: [], survivability: [] };
        }
        
        // Get defender type key
        let defenderType = this.raidDefenderType1;
        if (this.raidDefenderType2 && this.raidDefenderType2 !== this.raidDefenderType1) {
            const types = [this.raidDefenderType1, this.raidDefenderType2].sort();
            defenderType = types.join('/');
        }
        
        // Get filters
        const filters = this.getRaidFilters();
        
        // Build candidate list
        const candidates = [];
        
        for (const pokemon of this.pokemon) {
            // Apply filters
            if (!filters.legendary && pokemon.pokemonClass === 'POKEMON_CLASS_LEGENDARY') continue;
            if (!filters.mythical && pokemon.pokemonClass === 'POKEMON_CLASS_MYTHIC') continue;
            
            // Regular form - L40 and L50
            if (pokemon.raidTDO && pokemon.raidTDO[defenderType]) {
                const l40Data = pokemon.raidTDO[defenderType].L40_15_15_15;
                const l50Data = pokemon.raidTDO[defenderType].L50_15_15_15;
                
                if (l40Data) {
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: false,
                        isMega: false,
                        megaForm: null,
                        requiresXL: false,
                        level: 40,
                        dps: l40Data.dps,
                        tdo: l40Data.tdo,
                        dps3tdo: Math.pow(l40Data.dps, 3) * l40Data.tdo,
                        dpstdo: l40Data.dps * l40Data.tdo
                    });
                }
                
                if (l50Data && filters.xl) {
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: false,
                        isMega: false,
                        megaForm: null,
                        requiresXL: true,
                        level: 50,
                        dps: l50Data.dps,
                        tdo: l50Data.tdo,
                        dps3tdo: Math.pow(l50Data.dps, 3) * l50Data.tdo,
                        dpstdo: l50Data.dps * l50Data.tdo
                    });
                }
            }
            
            // Shadow form - L40 and L50
            if (filters.shadow && pokemon.shadowRaidTDO && pokemon.shadowRaidTDO[defenderType]) {
                const l40Data = pokemon.shadowRaidTDO[defenderType].L40_15_15_15;
                const l50Data = pokemon.shadowRaidTDO[defenderType].L50_15_15_15;
                
                if (l40Data) {
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: true,
                        isMega: false,
                        megaForm: null,
                        requiresXL: false,
                        level: 40,
                        dps: l40Data.dps,
                        tdo: l40Data.tdo,
                        dps3tdo: Math.pow(l40Data.dps, 3) * l40Data.tdo,
                        dpstdo: l40Data.dps * l40Data.tdo
                    });
                }
                
                if (l50Data && filters.xl) {
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: true,
                        isMega: false,
                        megaForm: null,
                        requiresXL: true,
                        level: 50,
                        dps: l50Data.dps,
                        tdo: l50Data.tdo,
                        dps3tdo: Math.pow(l50Data.dps, 3) * l50Data.tdo,
                        dpstdo: l50Data.dps * l50Data.tdo
                    });
                }
            }
            
            // Mega forms - L40 and L50
            if (filters.mega && pokemon.megas) {
                for (const mega of pokemon.megas) {
                    if (mega.raidTDO && mega.raidTDO[defenderType]) {
                        const l40Data = mega.raidTDO[defenderType].L40_15_15_15;
                        const l50Data = mega.raidTDO[defenderType].L50_15_15_15;
                        
                        if (l40Data) {
                            candidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: false,
                                isMega: true,
                                megaForm: mega.form,
                                requiresXL: false,
                                level: 40,
                                dps: l40Data.dps,
                                tdo: l40Data.tdo,
                                dps3tdo: Math.pow(l40Data.dps, 3) * l40Data.tdo,
                                dpstdo: l40Data.dps * l40Data.tdo
                            });
                        }
                        
                        if (l50Data && filters.xl) {
                            candidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: false,
                                isMega: true,
                                megaForm: mega.form,
                                requiresXL: true,
                                level: 50,
                                dps: l50Data.dps,
                                tdo: l50Data.tdo,
                                dps3tdo: Math.pow(l50Data.dps, 3) * l50Data.tdo,
                                dpstdo: l50Data.dps * l50Data.tdo
                            });
                        }
                    }
                }
            }
        }
        
        // Sort and pick top 6 for each category
        const damageList = [...candidates].sort((a, b) => b.dps3tdo - a.dps3tdo).slice(0, 6);
        
        // Remove damage picks from survivability pool
        const damageIds = new Set(damageList.map(p => 
            `${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}`
        ));
        const remainingForSurvivability = candidates.filter(p => 
            !damageIds.has(`${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}`)
        );
        
        const survivabilityList = remainingForSurvivability
            .sort((a, b) => b.dpstdo - a.dpstdo)
            .slice(0, 6);
        
        return { damage: damageList, survivability: survivabilityList };
    }

    /**
     * Get current filter states for raid lists
     * @returns {Object} Filter states
     */
    getRaidFilters() {
        return {
            legendary: document.querySelector('[data-filter="legendary"]')?.checked ?? true,
            mythical: document.querySelector('[data-filter="mythical"]')?.checked ?? true,
            mega: document.querySelector('[data-filter="mega"]')?.checked ?? true,
            shadow: document.querySelector('[data-filter="shadow"]')?.checked ?? true,
            xl: document.querySelector('[data-filter="xl"]')?.checked ?? true
        };
    }

    /**
     * Render search results (grouped by category)
     * Shows fast moves, charge moves, and pokemon that match search term
     * @returns {string} HTML string
     */
    renderSearchResults() {
        const results = this.getSearchResults();
        if (!results) return '';

        let html = '';
        
        // Fast moves section
        if (results.fast.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Fast Moves</h2>
                ${results.fast.map(m => renderMoveListItem.call(this, m, this.expandedMoves[m.id])).join('')}
            </div>`;
        }
        
        // Charge moves section
        if (results.charge.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Charge Moves</h2>
                ${results.charge.map(m => renderMoveListItem.call(this, m, this.expandedMoves[m.id])).join('')}
            </div>`;
        }
        
        // Pokemon section
        if (results.pokemon.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Pokémon</h2>
                <div class="grid grid-cols-4 gap-3">
                    ${results.pokemon.map(forms => renderPokemonCard.call(this, forms)).join('')}
                </div>
            </div>`;
        }
        
        // No results message
        if (!html) {
            html = '<div class="text-white text-center py-12">No results found</div>';
        }
        
        return html;
    }

    /**
     * Render pokemon grid (grouped by dex number)
     * @returns {string} HTML string
     */
    renderPokemonGrid() {
        const filtered = this.getFilteredPokemonGroups();
        return `
            <div class="grid grid-cols-4 gap-3">
                ${filtered.map(forms => renderPokemonCard.call(this, forms)).join('')}
            </div>
        `;
    }

    // ====================================
    // EVENT LISTENERS
    // ====================================

    /**
     * Attach all event listeners after render
     * Central hub for all click, input, and touch event handlers
     */
    attachEventListeners() {
        // Menu navigation buttons
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view));
        });

        // Back to menu button
        const backBtn = document.querySelector('[data-action="back"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.setView('menu'));
        }

        // Search input
        const searchInput = document.querySelector('[data-action="search"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.setSearchTerm(e.target.value));
        }

        // List toggle FAB buttons
        document.querySelectorAll('[data-action="set-list"]').forEach(btn => {
            btn.addEventListener('click', () => this.setList(btn.dataset.list));
        });

        // Advanced filters button (TBD)
        document.querySelectorAll('[data-action="advanced-filters"]').forEach(btn => {
            btn.addEventListener('click', () => alert('Advanced Filters - Under Construction'));
        });

        // Attach list-specific listeners (pokemon cards, move cards, etc.)
        this.attachListListeners();
        
        // Attach pokemon detail view listeners (from Pokedex.js)
        attachPokemonEventListeners.call(this);
        
        // Attach move detail view listeners (from Pokedex.js)
        attachMoveEventListeners.call(this);

        // ---- TAG MANAGEMENT ----
        
        // Show tag input button
        const showTagInput = document.querySelector('[data-action="show-tag-input"]');
        if (showTagInput) {
            showTagInput.addEventListener('click', () => {
                this.showTagInput = true;
                this.render();
            });
        }

        // Add tag button and input field
        const addTagBtn = document.querySelector('[data-action="add-tag"]');
        const tagInput = document.querySelector('[data-action="tag-input"]');
        if (addTagBtn && tagInput) {
            const addTag = () => {
                const tag = tagInput.value.trim();
                const isMove = addTagBtn.dataset.isMove === 'true';
                const currentItem = isMove ? this.selectedMove : (this.selectedForm || this.selectedPokemon);
                if (tag && currentItem) {
                    this.addTag(currentItem.id, tag, isMove);
                }
            };
            addTagBtn.addEventListener('click', addTag);
            tagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTag();
            });
        }

        // Remove tag buttons
        document.querySelectorAll('[data-action="remove-tag"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const isMove = btn.dataset.isMove === 'true';
                const currentItem = isMove ? this.selectedMove : (this.selectedForm || this.selectedPokemon);
                if (currentItem) {
                    this.removeTag(currentItem.id, btn.dataset.tag, isMove);
                }
            });
        });

        // ---- FAB BUTTONS ----
        
        // Add Pokemon FAB (OCR screenshot)
        const addPokemonBtn = document.querySelector('[data-action="add-pokemon"]');
        if (addPokemonBtn) {
            addPokemonBtn.addEventListener('click', () => {
                this.screenshotProcessor.showCaptureModal();
            });
        }

        // Team Builder FAB (TBD)
        const teamBuilderBtn = document.querySelector('[data-action="team-builder"]');
        if (teamBuilderBtn) {
            teamBuilderBtn.addEventListener('click', () => alert('Team Builder feature coming soon!'));
        }

        // ---- COLLECTION VIEW ----
        
        // If we're in collection view, attach its specific listeners
        if (this.currentView === 'collection') {
            this.userCollection.attachEventListeners();
        }

        // ---- TOUCH GESTURES ----
        
        // Swipe down to close detail view
        const detailContainer = document.querySelector('[data-detail-container]');
        if (detailContainer) {
            detailContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'detail'), false);
            detailContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'detail'), false);
        }

        // ---- IV SPREAD BUTTONS (TBD) ----
        
        document.querySelectorAll('[data-action="iv-spread"]').forEach(btn => {
            btn.addEventListener('click', () => alert('IV Spreads - Under Construction'));
        });

                // PvE tab switching
        document.querySelectorAll('[data-action="pve-tab"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pveTab = btn.dataset.tab;
                this.render();
            });
        });

        // Raid type selectors
        const raidType1 = document.querySelector('[data-action="raid-type-1"]');
        if (raidType1) {
            raidType1.addEventListener('change', (e) => {
                this.raidDefenderType1 = e.target.value;
                this.render();
            });
        }

        const raidType2 = document.querySelector('[data-action="raid-type-2"]');
        if (raidType2) {
            raidType2.addEventListener('change', (e) => {
                this.raidDefenderType2 = e.target.value;
                this.render();
            });
        }

        // Filter checkboxes
        document.querySelectorAll('[data-filter]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.render();
            });
        });

        // Help buttons
        const raidHelp = document.querySelector('[data-action="raid-help"]');
        if (raidHelp) {
            raidHelp.addEventListener('click', () => {
                alert('All pokemon are scored based on Damage Per Second (DPS) and Total Damage Output (TDO). Damage Focused pokemon maximize DPS (DPS³×TDO) to deal the most damage in the shortest amount of time. Shadow variants with low defense perform best in this ranking. Survivability Focused pokemon give more weight to survivability (DPS×TDO) to prevent re-lobbying. Non-shadow Pokémon with high defense generally perform best in this ranking. This can be adjusted in user settings.');
            });
        }

        const rocketHelp = document.querySelector('[data-action="rocket-help"]');
        if (rocketHelp) {
            rocketHelp.addEventListener('click', () => {
                alert('Rocket battles require different strategies than raids. Spam Focused pokemon use fast-charging moves to pressure opponents and build energy quickly. Damage Focused pokemon prioritize raw TDO to finish battles efficiently. Team Rocket battles have different mechanics than raids, so optimal movesets may differ from raid counters.');
            });
        }
    }

    /**
     * Attach listeners for list items (pokemon cards, move cards)
     * These need to be reattached after search updates
     */
    attachListListeners() {
        // Pokemon card click handlers
        document.querySelectorAll('[data-pokemon-id]').forEach(card => {
            card.addEventListener('click', () => {
                const pokemon = this.pokemon.find(p => p.id === card.dataset.pokemonId);
                if (pokemon) selectPokemon.call(this, pokemon);
            });
        });

        // Move card expand/collapse toggles
        document.querySelectorAll('[data-toggle-move]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const moveId = toggle.dataset.toggleMove;
                this.expandedMoves[moveId] = !this.expandedMoves[moveId];
                this.render();
            });
        });
    }

    // ====================================
    // UTILITY FUNCTIONS
    // ====================================

    /**
     * Get detailed move data by name, category, and mode
     * @param {string} moveName - Move name
     * @param {string} category - Move category: 'fast' or 'charge'
     * @param {string} mode - Move mode: 'pvp' or 'pve'
     * @returns {Object|undefined} Move object or undefined if not found
     */
    getMoveDetails(moveName, category, mode) {
        return this.moves.find(m => 
            m.name === moveName && 
            m.category === category && 
            m.mode === mode
        );
    }
}

// ====================================
// SHARED CONSTANTS AND UTILITIES
// ====================================

/**
 * Type color mapping for UI display
 * Maps Pokemon types to their official hex colors
 */
const TYPE_COLORS = {
    NORMAL: '#A8A878', 
    FIRE: '#F08030', 
    WATER: '#6890F0', 
    ELECTRIC: '#F8D030',
    GRASS: '#78C850', 
    ICE: '#98D8D8', 
    FIGHTING: '#C03028', 
    POISON: '#A040A0',
    GROUND: '#E0C068', 
    FLYING: '#A890F0', 
    PSYCHIC: '#F85888', 
    BUG: '#A8B820',
    ROCK: '#B8A038', 
    GHOST: '#705898', 
    DRAGON: '#7038F8', 
    DARK: '#705848',
    STEEL: '#B8B8D0', 
    FAIRY: '#EE99AC'
};

/**
 * Format numbers to 2 decimal places
 * Handles null/undefined gracefully
 * @param {number} num - Number to format
 * @returns {string|number} Formatted number or 'N/A' if invalid
 */
function formatNumber(num) {
    if (num === undefined || num === null) return 'N/A';
    return Number(num.toFixed(2));
}

/**
 * Get Showdown sprite ID for Pokemon with forms
 * Fetches the correct sprite ID from PokeAPI for form variants
 * Falls back to dex number if form lookup fails
 * 
 * @param {Object} pokemon - Pokemon object with dexNumber, name, and form
 * @returns {Promise<number>} The sprite ID to use in sprite URL
 */
async function getShowdownSpriteId(pokemon) {
    // Base form - use dex number directly
    if (!pokemon.form) {
        return pokemon.dexNumber;
    }
    
    const pokemonName = pokemon.name.toLowerCase();
    let formName = pokemon.form.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/%/g, '');
    
    // Handle regional form naming conventions
    // PokeAPI uses "galar" instead of "galarian", etc.
    if (formName === 'galarian') formName = 'galar';
    if (formName === 'alolan') formName = 'alola';
    if (formName === 'hisuian') formName = 'hisui';
    if (formName === 'paldean') formName = 'paldea';
    
    const apiUrl = `https://pokeapi.co/api/v2/pokemon/${pokemonName}-${formName}`;
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Form not found');
        const data = await response.json();
        return data.id;
    } catch (error) {
        console.warn(`Could not fetch sprite ID for ${pokemon.name} (${pokemon.form})`, error);
        return pokemon.dexNumber; // Fallback to base dex number
    }
}