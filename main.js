// ====================================
// DATABASE FUNCTIONS
// ====================================

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PokemonGoDB', 5);
        
        request.onerror = () => reject(request.error);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('pokemon')) {
                const pokemonStore = db.createObjectStore('pokemon', { keyPath: 'id' });
                pokemonStore.createIndex('dexNumber', 'dexNumber', { unique: false });
            }
            if (!db.objectStoreNames.contains('moves')) {
                db.createObjectStore('moves', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('typeEffectiveness')) {
                db.createObjectStore('typeEffectiveness', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('rankings')) {
                const rankingsStore = db.createObjectStore('rankings', { keyPath: 'id' });
                rankingsStore.createIndex('league', 'league', { unique: false });
                rankingsStore.createIndex('cupName', 'cupName', { unique: false });
                rankingsStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            if (!db.objectStoreNames.contains('userPokemon')) {
                const userPokemonStore = db.createObjectStore('userPokemon', { keyPath: 'id' });
                userPokemonStore.createIndex('name', 'name', { unique: false });
                userPokemonStore.createIndex('dateAdded', 'dateUploaded', { unique: false });
                userPokemonStore.createIndex('dateCaught', 'dateCaught', { unique: false });
            }
        };
        
        request.onsuccess = async (event) => {
            const db = event.target.result;
            
            const tx = db.transaction(['pokemon'], 'readonly');
            const store = tx.objectStore('pokemon');
            const countRequest = store.count();
            
            countRequest.onsuccess = async () => {
                if (countRequest.result === 0) {
                    console.log('Database empty, loading from JSON...');
                    
                    try {
                        const response = await fetch('./go-database103125.json');
                        const data = await response.json();
                        
                        console.log('JSON loaded, populating database...');
                        
                        const writeTx = db.transaction(['pokemon', 'moves', 'metadata', 'typeEffectiveness'], 'readwrite');
                        
                        if (data.pokemon && Array.isArray(data.pokemon)) {
                            const pokemonStore = writeTx.objectStore('pokemon');
                            data.pokemon.forEach(p => pokemonStore.add(p));
                        }
                        if (data.moves && Array.isArray(data.moves)) {
                            const movesStore = writeTx.objectStore('moves');
                            data.moves.forEach(m => movesStore.add(m));
                        }
                        if (data.metadata) {
                            const metadataStore = writeTx.objectStore('metadata');
                            if (Array.isArray(data.metadata)) {
                                data.metadata.forEach(m => metadataStore.add(m));
                            } else {
                                Object.entries(data.metadata).forEach(([key, value]) => {
                                    metadataStore.add({ key, ...value });
                                });
                            }
                        }
                        if (data.typeEffectiveness && Array.isArray(data.typeEffectiveness)) {
                            const typeStore = writeTx.objectStore('typeEffectiveness');
                            data.typeEffectiveness.forEach(t => typeStore.add(t));
                        }
                        
                        writeTx.oncomplete = () => {
                            console.log('Database initialized successfully!');
                            resolve(db);
                        };
                        
                        writeTx.onerror = () => {
                            console.error('Error populating database:', writeTx.error);
                            resolve(db);
                        };
                        
                    } catch (error) {
                        console.error('Error loading JSON:', error);
                        resolve(db);
                    }
                } else {
                    console.log('Database already populated');
                    resolve(db);
                }
            };
        };
    });
}

// ====================================
// MAIN APP CLASS
// ====================================

class PokeApp {
    constructor() {
        this.currentView = 'menu';
        this.currentList = 'pokemon';
        this.searchTerm = '';
        this.loading = false;
        
        this.pokemon = [];
        this.moves = [];
        
        this.selectedPokemon = null;
        this.selectedForm = null;
        this.selectedMove = null;
        
        this.expandedSections = {};
        this.expandedMoves = {};
        this.moveMode = 'pvp';
        this.showTagInput = false;
        
        this.userTags = {};
        this.moveTags = {};
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.longPressTimer = null;
        this.screenshotProcessor = new ScreenshotProcessor(this);

        this.loadUserTags();
        this.loadFromIndexedDB();
        this.render();
    }

    // ====================================
    // DATABASE LOADING
    // ====================================

    loadFromIndexedDB() {
        this.loading = true;
        this.render();

        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            
            const pokemonTransaction = db.transaction(['pokemon'], 'readonly');
            const pokemonStore = pokemonTransaction.objectStore('pokemon');
            const pokemonRequest = pokemonStore.getAll();
            
            pokemonRequest.onsuccess = () => {
                this.pokemon = pokemonRequest.result || [];
                this.checkLoadComplete();
            };

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

    checkLoadComplete() {
        if (this.pokemon.length > 0 && this.moves.length > 0) {
            this.loading = false;
            this.render();
        }
    }

    // ====================================
    // USER TAGS (localStorage)
    // ====================================

    loadUserTags() {
        const stored = localStorage.getItem('pokemonTags');
        if (stored) this.userTags = JSON.parse(stored);
        
        const moveTags = localStorage.getItem('moveTags');
        if (moveTags) this.moveTags = JSON.parse(moveTags);
    }

    saveUserTags() {
        localStorage.setItem('pokemonTags', JSON.stringify(this.userTags));
    }

    saveMoveTags() {
        localStorage.setItem('moveTags', JSON.stringify(this.moveTags));
    }

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

    setSearchTerm(term) {
        this.searchTerm = term;
        this.updateCurrentView();
    }

    getGroupedPokemon() {
        const grouped = {};
        this.pokemon.forEach(p => {
            if (!grouped[p.dexNumber]) grouped[p.dexNumber] = [];
            grouped[p.dexNumber].push(p);
        });
        const result = Object.values(grouped);
        console.log('getGroupedPokemon returning:', result);
        console.log('First group:', result[0]);
        return result;
    }

    getFilteredPokemonGroups() {
        if (!this.searchTerm) return this.getGroupedPokemon();
        const term = this.searchTerm.toLowerCase();
        return this.getGroupedPokemon().filter(forms => 
            forms[0].name.toLowerCase().includes(term) ||
            forms[0].dexNumber.toString().includes(term)
        );
    }

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

    getUniqueMoves(category) {
        const unique = new Map();
        this.moves.filter(m => m.category === category && m.mode === this.moveMode)
            .forEach(m => unique.set(m.name, m));
        return Array.from(unique.values());
    }

    getFilteredMoves(category) {
        const moves = this.getUniqueMoves(category);
        if (!this.searchTerm) return moves;
        const term = this.searchTerm.toLowerCase();
        return moves.filter(m => m.name.toLowerCase().includes(term));
    }

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

    setList(list) {
        this.currentList = list;
        this.searchTerm = '';
        this.render();
    }

    getPokemonForms(dexNumber) {
        return this.pokemon.filter(p => p.dexNumber === dexNumber);
    }

    // ====================================
    // TOUCH HANDLING
    // ====================================

    handleTouchStart(e, context) {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
        
        if (context === 'move') {
            this.longPressTimer = setTimeout(() => {
                const moveCard = e.target.closest('[data-move-name]');
                if (moveCard) {
                    const moveName = moveCard.dataset.moveName;
                    const category = moveCard.dataset.moveCategory;
                    const moveData = this.getMoveDetails(moveName, category, this.moveMode);
                    if (moveData) selectMove.call(this, moveData);
                }
            }, 500);
        }
    }

    handleTouchEnd(e, context) {
        clearTimeout(this.longPressTimer);
        this.touchEndY = e.changedTouches[0].screenY;
        
        if (context === 'detail' && this.selectedPokemon) {
            const diffY = this.touchStartY - this.touchEndY;
            if (diffY < -100) {
                this.selectedPokemon = null;
                this.selectedForm = null;
                this.render();
            }
        }
    }

    // ====================================
    // RENDERING
    // ====================================

    async render() {
        const app = document.getElementById('app');
        
        if (this.currentView === 'menu') {
            app.innerHTML = this.renderMenu();
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

    renderMenu() {
        return `
            <div class="min-h-screen bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 flex flex-col items-center justify-center p-8">
                <div class="w-full max-w-md space-y-4">
                    ${this.renderMenuItem('fa-solid fa-book', 'POKÉDEX', 'pokedex')}
                    ${this.renderMenuItem('fa-solid fa-star', 'COLLECTION', null)}
                    ${this.renderMenuItem('fa-solid fa-users', 'PVP', null)}
                    ${this.renderMenuItem('fa-solid fa-rocket', 'PVE', null)}
                    ${this.renderMenuItem('fa-solid fa-message', 'FEEDBACK', null)}
                </div>
                
                <button class="fab-button fab-left bg-blue-500 text-white" data-action="team-builder">
                    <i class="fa-solid fa-calculator text-xl"></i>
                </button>
                <button class="fab-button fab-right bg-purple-500 text-white" data-action="add-pokemon">
                    <i class="fa-solid fa-plus text-xl"></i>
                </button>
            </div>
        `;
    }

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

    renderPokedexView() {
        const fabsHidden = this.searchTerm ? 'hidden' : '';
        
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

                <div class="max-w-6xl mx-auto p-4" data-content-grid>
                    ${this.loading ? 
                        '<div class="text-black text-center py-20">Loading...</div>' :
                        this.searchTerm ? this.renderSearchResults() :
                        this.currentList === 'pokemon' ? this.renderPokemonGrid() :
                        this.currentList === 'fast' ? renderMoveList.call(this, 'fast') :
                        renderMoveList.call(this, 'charge')
                    }
                </div>
                
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

    renderSearchResults() {
        const results = this.getSearchResults();
        if (!results) return '';

        let html = '';
        
        if (results.fast.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Fast Moves</h2>
                ${results.fast.map(m => renderMoveListItem.call(this, m, this.expandedMoves[m.id])).join('')}
            </div>`;
        }
        
        if (results.charge.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Charge Moves</h2>
                ${results.charge.map(m => renderMoveListItem.call(this, m, this.expandedMoves[m.id])).join('')}
            </div>`;
        }
        
        if (results.pokemon.length > 0) {
            html += `<div class="mb-6">
                <h2 class="text-white text-xl font-bold mb-3">Pokémon</h2>
                <div class="grid grid-cols-4 gap-3">
                    ${results.pokemon.map(forms => renderPokemonCard.call(this, forms)).join('')}
                </div>
            </div>`;
        }
        
        if (!html) {
            html = '<div class="text-white text-center py-12">No results found</div>';
        }
        return html;
    }

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

    attachEventListeners() {
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view));
        });

        const backBtn = document.querySelector('[data-action="back"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.setView('menu'));
        }

        const searchInput = document.querySelector('[data-action="search"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.setSearchTerm(e.target.value));
        }

        document.querySelectorAll('[data-action="set-list"]').forEach(btn => {
            btn.addEventListener('click', () => this.setList(btn.dataset.list));
        });

        document.querySelectorAll('[data-action="advanced-filters"]').forEach(btn => {
            btn.addEventListener('click', () => alert('Advanced Filters - Under Construction'));
        });

        this.attachListListeners();
        attachPokemonEventListeners.call(this);
        attachMoveEventListeners.call(this);

        // Tags
        const showTagInput = document.querySelector('[data-action="show-tag-input"]');
        if (showTagInput) {
            showTagInput.addEventListener('click', () => {
                this.showTagInput = true;
                this.render();
            });
        }

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

        document.querySelectorAll('[data-action="remove-tag"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const isMove = btn.dataset.isMove === 'true';
                const currentItem = isMove ? this.selectedMove : (this.selectedForm || this.selectedPokemon);
                if (currentItem) {
                    this.removeTag(currentItem.id, btn.dataset.tag, isMove);
                }
            });
        });

        // FAB buttons
        const addPokemonBtn = document.querySelector('[data-action="add-pokemon"]');
        if (addPokemonBtn) {
            addPokemonBtn.addEventListener('click', () => {
                this.screenshotProcessor.showCaptureModal();
            });
        }

        const teamBuilderBtn = document.querySelector('[data-action="team-builder"]');
        if (teamBuilderBtn) {
            teamBuilderBtn.addEventListener('click', () => alert('Team Builder feature coming soon!'));
        }

        // Swipe gestures
        const detailContainer = document.querySelector('[data-detail-container]');
        if (detailContainer) {
            detailContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'detail'), false);
            detailContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'detail'), false);
        }

        // IV spread buttons
        document.querySelectorAll('[data-action="iv-spread"]').forEach(btn => {
            btn.addEventListener('click', () => alert('IV Spreads - Under Construction'));
        });
    }

    attachListListeners() {
        document.querySelectorAll('[data-pokemon-id]').forEach(card => {
            card.addEventListener('click', () => {
                const pokemon = this.pokemon.find(p => p.id === card.dataset.pokemonId);
                if (pokemon) selectPokemon.call(this, pokemon);
            });
        });

        document.querySelectorAll('[data-toggle-move]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const moveId = toggle.dataset.toggleMove;
                this.expandedMoves[moveId] = !this.expandedMoves[moveId];
                this.render();
            });
        });
    }

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

// Format numbers to 2 decimal places
function formatNumber(num) {
    if (num === undefined || num === null) return 'N/A';
    return Number(num.toFixed(2));
}

// Get Showdown sprite ID for Pokemon with forms
async function getShowdownSpriteId(pokemon) {
    if (!pokemon.form) {
        return pokemon.dexNumber;
    }
    
    const pokemonName = pokemon.name.toLowerCase();
    let formName = pokemon.form.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/%/g, '');
    
    // Special case: "Galarian" -> "galar", "Alolan" -> "alola", etc.
    if (formName === 'galarian') formName = 'galar';
    if (formName === 'alolan') formName = 'alola';
    if (formName === 'hisuian') formName = 'hisui';
    if (formName === 'paldean') formName = 'paldea';
    
    const apiUrl = `https://pokeapi.co/api/v2/pokemon/${pokemonName}-${formName}`;
    
    console.log('Fetching sprite ID for:', pokemonName, formName, 'from', apiUrl);
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Form not found');
        const data = await response.json();
        console.log('Got sprite ID:', data.id);
        return data.id;
    } catch (error) {
        console.warn(`Could not fetch sprite ID for ${pokemon.name} (${pokemon.form})`, error);
        return pokemon.dexNumber;
    }
}