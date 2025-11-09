// ====================================
// USER COLLECTION MANAGER
// ====================================

class UserCollectionManager {
    constructor(app) {
        this.app = app;
        this.collection = [];
        this.sortMethod = 'recent'; // 'recent', 'uploaded', 'cp', 'number', 'name'
        this.sortDirection = 'desc'; // 'asc' or 'desc'
        this.searchTerm = '';
        this.scrollPosition = 0;
        this.showSortMenu = false;
        this.initialized = false;
    }

    // ====================================
    // INITIALIZATION & TEST DATA
    // ====================================

    async initialize() {
        if (this.initialized) return;
        
        await this.loadCollection();
        
        // If empty, populate with test data
        if (this.collection.length === 0) {
            await this.populateTestData();
        }
        
        this.initialized = true;
    }

    async populateTestData() {
        const testPokemon = [
            { name: 'Pikachu', dexNumber: 25, cp: 1523, level: 25, attackIV: 15, defenseIV: 14, staminaIV: 13, form: 'Normal', isFavorite: true },
            { name: 'Charizard', dexNumber: 6, cp: 2847, level: 30, attackIV: 12, defenseIV: 15, staminaIV: 14, form: 'Normal', isFavorite: false },
            { name: 'Blastoise', dexNumber: 9, cp: 2456, level: 28, attackIV: 14, defenseIV: 13, staminaIV: 15, form: 'Normal', isFavorite: true },
            { name: 'Mewtwo', dexNumber: 150, cp: 4178, level: 40, attackIV: 15, defenseIV: 15, staminaIV: 15, form: 'Normal', isFavorite: true },
            { name: 'Dragonite', dexNumber: 149, cp: 3581, level: 35, attackIV: 14, defenseIV: 14, staminaIV: 13, form: 'Normal', isFavorite: false },
            { name: 'Gyarados', dexNumber: 130, cp: 3012, level: 32, attackIV: 13, defenseIV: 15, staminaIV: 14, form: 'Normal', isFavorite: false },
            { name: 'Snorlax', dexNumber: 143, cp: 2789, level: 29, attackIV: 15, defenseIV: 12, staminaIV: 15, form: 'Normal', isFavorite: true },
            { name: 'Lapras', dexNumber: 131, cp: 2345, level: 26, attackIV: 14, defenseIV: 14, staminaIV: 12, form: 'Normal', isFavorite: false },
            { name: 'Gengar', dexNumber: 94, cp: 2678, level: 30, attackIV: 15, defenseIV: 13, staminaIV: 14, form: 'Normal', isFavorite: false },
            { name: 'Alakazam', dexNumber: 65, cp: 2134, level: 27, attackIV: 13, defenseIV: 14, staminaIV: 13, form: 'Normal', isFavorite: false },
            { name: 'Machamp', dexNumber: 68, cp: 2890, level: 31, attackIV: 15, defenseIV: 15, staminaIV: 12, form: 'Normal', isFavorite: true },
            { name: 'Arcanine', dexNumber: 59, cp: 2567, level: 28, attackIV: 14, defenseIV: 13, staminaIV: 15, form: 'Normal', isFavorite: false }
        ];

        const now = new Date();
        
        for (let i = 0; i < testPokemon.length; i++) {
            const mon = testPokemon[i];
            const dateCaught = new Date(now.getTime() - (i * 86400000)); // Each day older
            const dateUploaded = new Date(now.getTime() - (i * 43200000)); // Each 12 hours older
            
            // Fetch sprite as blob
            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.dexNumber}.png`;
            const spriteBlob = await this.fetchImageAsBlob(spriteUrl);
            
            await this.addPokemon({
                ...mon,
                roles: [],
                dateCaught: dateCaught.toISOString(),
                dateUploaded: dateUploaded.toISOString(),
                spriteThumb: spriteBlob
            });
        }
    }

    async fetchImageAsBlob(url) {
        try {
            const response = await fetch(url);
            return await response.blob();
        } catch (error) {
            console.error('Failed to fetch sprite:', error);
            return null;
        }
    }

    // ====================================
    // DATABASE OPERATIONS
    // ====================================

    async loadCollection() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PokemonGoDB');
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readonly');
                const store = tx.objectStore('userPokemon');
                const getRequest = store.getAll();
                
                getRequest.onsuccess = () => {
                    this.collection = getRequest.result || [];
                    resolve();
                };
                
                getRequest.onerror = () => reject(getRequest.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async addPokemon(pokemon) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PokemonGoDB');
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                const pokemonData = {
                    id: crypto.randomUUID(),
                    ...pokemon
                };
                
                const addRequest = store.add(pokemonData);
                
                addRequest.onsuccess = () => {
                    this.collection.push(pokemonData);
                    resolve(pokemonData);
                };
                
                addRequest.onerror = () => reject(addRequest.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async deletePokemon(id) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PokemonGoDB');
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                const deleteRequest = store.delete(id);
                
                deleteRequest.onsuccess = () => {
                    this.collection = this.collection.filter(p => p.id !== id);
                    resolve();
                };
                
                deleteRequest.onerror = () => reject(deleteRequest.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // ====================================
    // SORTING & FILTERING
    // ====================================

    getSortedCollection() {
        let sorted = [...this.collection];
        
        switch (this.sortMethod) {
            case 'recent':
                sorted.sort((a, b) => new Date(b.dateCaught) - new Date(a.dateCaught));
                break;
            case 'uploaded':
                sorted.sort((a, b) => new Date(b.dateUploaded) - new Date(a.dateUploaded));
                break;
            case 'cp':
                sorted.sort((a, b) => b.cp - a.cp);
                break;
            case 'number':
                sorted.sort((a, b) => a.dexNumber - b.dexNumber);
                break;
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }
        
        if (this.sortDirection === 'asc') {
            sorted.reverse();
        }
        
        return sorted;
    }

    getFilteredCollection() {
        let filtered = this.getSortedCollection();
        
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(term) ||
                p.dexNumber.toString().includes(term)
            );
        }
        
        return filtered;
    }

    toggleSort(method) {
        if (this.sortMethod === method) {
            // Toggle direction
            this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            // New sort method
            this.sortMethod = method;
            this.sortDirection = 'desc';
        }
        this.showSortMenu = false;
        this.app.render();
    }

    getSortIcon() {
        const icons = {
            'recent': 'fa-clock',
            'uploaded': 'fa-arrow-up',
            'cp': 'CP',
            'number': 'fa-hashtag',
            'name': 'AZ'
        };
        return icons[this.sortMethod];
    }

    // ====================================
    // RENDERING
    // ====================================

    render() {
        // Show loading if not initialized
        if (!this.initialized) {
            this.initialize().then(() => {
                this.app.render();
            });
            return `
                <div class="min-h-screen bg-white flex items-center justify-center">
                    <div class="text-gray-800 text-2xl">Loading collection...</div>
                </div>
            `;
        }
        
        const filtered = this.getFilteredCollection();
        
        return `
            <div class="min-h-screen bg-white pb-20">
                <!-- Search Bar - Pinned -->
                <div class="bg-gray-100 p-4 sticky top-0 z-20">
                    <div class="max-w-6xl mx-auto">
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                            <input
                                type="text"
                                placeholder="Search Pokémon..."
                                value="${this.searchTerm}"
                                data-action="collection-search"
                                class="w-full bg-white rounded-full py-3 pl-12 pr-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                            />
                        </div>
                    </div>
                </div>

                <!-- Collection Grid -->
                <div class="max-w-6xl mx-auto p-4" data-collection-scroll>
                    ${filtered.length === 0 ? 
                        '<div class="text-gray-800 text-center py-20">No Pokémon found</div>' :
                        `<div class="grid grid-cols-3 gap-4">
                            ${filtered.map(mon => this.renderPokemonCard(mon)).join('')}
                        </div>`
                    }
                </div>

                <!-- Sort FAB -->
                <button 
                    class="fab-button fab-right bg-teal-500 text-white shadow-lg"
                    data-action="toggle-sort-menu"
                    style="z-index: 60;"
                >
                    ${this.renderSortIcon()}
                </button>

                <!-- Close FAB -->
                <button 
                    class="fab-button fab-center bg-gray-600 text-white"
                    data-action="close-collection"
                >
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>

                <!-- Sort Menu -->
                ${this.showSortMenu ? this.renderSortMenu() : ''}
            </div>
        `;
    }

    renderSortIcon() {
        const icon = this.getSortIcon();
        const arrow = this.sortDirection === 'desc' ? '↓' : '↑';
        
        if (icon === 'CP' || icon === 'AZ') {
            return `
                <div class="relative">
                    <span class="text-sm font-bold">${icon}</span>
                    <span class="absolute -top-1 -right-1 text-xs">${arrow}</span>
                </div>
            `;
        } else {
            return `
                <div class="relative">
                    <i class="fa-solid ${icon} text-xl"></i>
                    <span class="absolute -top-1 -right-1 text-xs">${arrow}</span>
                </div>
            `;
        }
    }

    renderSortMenu() {
        const sortOptions = [
            { id: 'recent', icon: 'fa-clock', label: 'RECENT' },
            { id: 'uploaded', icon: 'fa-arrow-up', label: 'UPLOADED' },
            { id: 'cp', text: 'CP', label: 'COMBAT POWER' },
            { id: 'number', icon: 'fa-hashtag', label: 'NUMBER' },
            { id: 'name', text: 'A-Z', label: 'NAME' }
        ];

        return `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-end p-4" data-action="close-sort-menu">
                <div class="bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl p-6 mb-20 mr-2 shadow-2xl" style="min-width: 280px;" onclick="event.stopPropagation()">
                    ${sortOptions.map(opt => {
                        const isActive = this.sortMethod === opt.id;
                        const arrow = isActive ? (this.sortDirection === 'desc' ? '↓' : '↑') : '';
                        
                        return `
                            <button 
                                class="w-full text-right py-3 text-cyan-100 hover:text-white transition-colors flex items-center justify-between"
                                data-action="set-sort"
                                data-sort="${opt.id}"
                            >
                                <span class="text-sm font-light tracking-wider">${opt.label}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-lg font-bold" style="min-width: 20px; text-align: center;">${arrow}</span>
                                    <div style="min-width: 30px; text-align: center;">
                                        ${opt.icon ? `<i class="fa-solid ${opt.icon} text-lg"></i>` : 
                                          `<span class="text-sm font-bold">${opt.text}</span>`}
                                    </div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderPokemonCard(pokemon) {
        const spriteUrl = pokemon.spriteThumb ? 
            URL.createObjectURL(pokemon.spriteThumb) :
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.dexNumber}.png`;
        
        const favoriteIcon = pokemon.isFavorite ? 
            '<i class="fa-solid fa-star text-yellow-300 text-xs absolute top-1 right-1 drop-shadow-md"></i>' : '';

        return `
            <div 
                class="relative cursor-pointer"
                data-collection-pokemon="${pokemon.id}"
            >
                ${favoriteIcon}
                <div class="text-center">
                    <!-- CP above sprite -->
                    <div class="text-gray-700 text-lg font-bold mb-1">
                        <span class="text-xs">CP </span>${pokemon.cp}
                    </div>
                    
                    <!-- Pokemon sprite -->
                    <img 
                        src="${spriteUrl}" 
                        alt="${pokemon.name}" 
                        class="w-full h-auto mx-auto mb-2"
                        style="max-width: 120px;"
                    >
                    
                    <!-- Name in pill below sprite -->
                    <div class="flex justify-center">
                        <div class="bg-white bg-opacity-80 backdrop-blur-sm rounded-full px-3 py-1 inline-block">
                            <span class="text-gray-800 font-semibold text-sm">${pokemon.name}</span>
                        </div>
                    </div>
                    
                    <!-- Underline bar like in game -->
                    <div class="mt-1 mx-auto bg-teal-400 h-1 rounded-full" style="width: 80%;"></div>
                </div>
            </div>
        `;
    }

    // ====================================
    // EVENT HANDLERS
    // ====================================

    attachEventListeners() {
        // Search
        const searchInput = document.querySelector('[data-action="collection-search"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.app.render();
            });
        }

        // Sort menu toggle
        const sortBtn = document.querySelector('[data-action="toggle-sort-menu"]');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                this.showSortMenu = !this.showSortMenu;
                this.app.render();
            });
        }

        // Close sort menu
        document.querySelectorAll('[data-action="close-sort-menu"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showSortMenu = false;
                this.app.render();
            });
        });

        // Set sort
        document.querySelectorAll('[data-action="set-sort"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleSort(btn.dataset.sort);
            });
        });

        // Close collection
        const closeBtn = document.querySelector('[data-action="close-collection"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.saveScrollPosition();
                this.app.setView('menu');
            });
        }

        // Pokemon click
        document.querySelectorAll('[data-collection-pokemon]').forEach(card => {
            card.addEventListener('click', () => {
                this.saveScrollPosition();
                alert('Pokémon detail view - Under Construction');
                // TODO: Open pokemon detail view
            });
        });

        // Restore scroll position
        this.restoreScrollPosition();
    }

    saveScrollPosition() {
        const scrollContainer = document.querySelector('[data-collection-scroll]');
        if (scrollContainer) {
            this.scrollPosition = window.scrollY || document.documentElement.scrollTop;
        }
    }

    restoreScrollPosition() {
        if (this.scrollPosition > 0) {
            setTimeout(() => {
                window.scrollTo(0, this.scrollPosition);
            }, 0);
        }
    }
}