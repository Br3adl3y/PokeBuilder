// ====================================
// PVE MANAGER - RAID & ROCKET BATTLES
// ====================================
// Handles PvE raid counters and Team Rocket battle recommendations
// Manages wishlist calculation, user Pokemon evaluation, and list rendering

/**
 * PvEManager - Manages all PvE-related functionality
 * Handles Raid/Gym battles and Team Rocket encounters
 */
class PvEManager {
    constructor(app) {
        this.app = app;
        
        // ---- PVE STATE ----
        this.pveTab = 'raid';
        this.raidDefenderType1 = '';
        this.raidDefenderType2 = '';
        this.rocketMember = '';
        this.rocketGender = 'male'; 
        this.gruntHasBothGenders = false;
        
        // ---- PVE LISTS ----
        this.raidLists = {
            wishlist: { damage: [], survivability: [] },
            currentBest: { damage: [], survivability: [] },
            toDo: { damage: [], survivability: [] }
        };
        this.rocketLists = {
            spam: [],
            damage: [],
            currentBest: [],
            toDo: []
        };

        // ---- PVE FILTERS ----
        this.pveFilters = {
            special: true,  // Covers legendary, mythical, ultra beast
            mega: true,
            shadow: true,
            xl: true
        };
        
        // ---- SCORING EXPONENTS ----
        this.dmgDpsExponent = 3;
        this.dmgTdoExponent = 1;
        this.surviveDpsExponent = 1;
        this.surviveTdoExponent = 1;
    }

    // ====================================
    // RENDERING
    // ====================================

    /**
     * Render PvE view with Raid/Gym and Rocket tabs
     * @returns {string} HTML string
     */
    render() {
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
        
        // Type mapping to sprite numbers
        const typeSprites = {
            'NORMAL': 1, 'FIGHTING': 2, 'FLYING': 3, 'POISON': 4, 'GROUND': 5, 'ROCK': 6,
            'BUG': 7, 'GHOST': 8, 'STEEL': 9, 'FIRE': 10, 'WATER': 11, 'GRASS': 12,
            'ELECTRIC': 13, 'PSYCHIC': 14, 'ICE': 15, 'DRAGON': 16, 'DARK': 17, 'FAIRY': 18
        };
        
        const types = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
        
        // Arrange in 3 rows of 6
        const typeRows = [
            types.slice(0, 6),
            types.slice(6, 12),
            types.slice(12, 18)
        ];
        
        return `
            <!-- Controls -->
            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                <div class="flex items-start justify-between mb-4">
                    <label class="text-white text-lg font-semibold">Select Defender Type(s)</label>
                    <button 
                        data-action="raid-help"
                        class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                        title="Help"
                    >
                        <i class="fa-solid fa-question text-sm"></i>
                    </button>
                </div>
                
                <!-- Type Sprite Grid -->
                <div class="space-y-2 mb-6">
                    ${typeRows.map(row => `
                        <div class="flex gap-2 justify-center">
                            ${row.map(type => {
                                const isSelected = type === defenderType1 || type === defenderType2;
                                const spriteNum = typeSprites[type];
                                return `
                                    <button
                                        data-action="select-type"
                                        data-type="${type}"
                                        class="relative rounded-full transition-all hover:scale-105 ${isSelected ? 'outline outline-4 outline-black shadow-lg' : 'hover:ring-2 hover:ring-white/50'}"
                                        title="${type.charAt(0) + type.slice(1).toLowerCase()}"
                                    >
                                        <img 
                                            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-ix/scarlet-violet/${spriteNum}.png"
                                            alt="${type}"
                                            class="w-40 h-8"
                                        />
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
                
                <div class="flex gap-4 mt-4">
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="special" ${this.pveFilters.special ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Special*</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mega" ${this.pveFilters.mega ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Mega</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="shadow" ${this.pveFilters.shadow ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Shadow</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="xl" ${this.pveFilters.xl ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include XL (Lv50)</span>
                    </label>
                </div>
                <div class="text-white/60 text-xs mt-2">
                    *Special includes Legendary, Mythical, and Ultra Beast Pokémon
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
        const currentMember = this.rocketMember || '';
        
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
                                <option value="leader:giovanni" ${currentMember === 'leader:giovanni' ? 'selected' : ''}>Giovanni</option>
                                <option value="leader:cliff" ${currentMember === 'leader:cliff' ? 'selected' : ''}>Cliff</option>
                                <option value="leader:arlo" ${currentMember === 'leader:arlo' ? 'selected' : ''}>Arlo</option>
                                <option value="leader:sierra" ${currentMember === 'leader:sierra' ? 'selected' : ''}>Sierra</option>
                            </optgroup>
                            <optgroup label="Grunts">
                                <option value="grunt:Bug" ${currentMember === 'grunt:Bug' ? 'selected' : ''}>Bug Grunt</option>
                                <option value="grunt:Dark" ${currentMember === 'grunt:Dark' ? 'selected' : ''}>Dark Grunt</option>
                                <option value="grunt:Dragon" ${currentMember === 'grunt:Dragon' ? 'selected' : ''}>Dragon Grunt</option>
                                <option value="grunt:Electric" ${currentMember === 'grunt:Electric' ? 'selected' : ''}>Electric Grunt</option>
                                <option value="grunt:Fairy" ${currentMember === 'grunt:Fairy' ? 'selected' : ''}>Fairy Grunt</option>
                                <option value="grunt:Fighting" ${currentMember === 'grunt:Fighting' ? 'selected' : ''}>Fighting Grunt</option>
                                <option value="grunt:Fire" ${currentMember === 'grunt:Fire' ? 'selected' : ''}>Fire Grunt</option>
                                <option value="grunt:Flying" ${currentMember === 'grunt:Flying' ? 'selected' : ''}>Flying Grunt</option>
                                <option value="grunt:Ghost" ${currentMember === 'grunt:Ghost' ? 'selected' : ''}>Ghost Grunt</option>
                                <option value="grunt:Grass" ${currentMember === 'grunt:Grass' ? 'selected' : ''}>Grass Grunt</option>
                                <option value="grunt:Ground" ${currentMember === 'grunt:Ground' ? 'selected' : ''}>Ground Grunt</option>
                                <option value="grunt:Ice" ${currentMember === 'grunt:Ice' ? 'selected' : ''}>Ice Grunt</option>
                                <option value="grunt:Normal" ${currentMember === 'grunt:Normal' ? 'selected' : ''}>Normal Grunt</option>
                                <option value="grunt:Poison" ${currentMember === 'grunt:Poison' ? 'selected' : ''}>Poison Grunt</option>
                                <option value="grunt:Psychic" ${currentMember === 'grunt:Psychic' ? 'selected' : ''}>Psychic Grunt</option>
                                <option value="grunt:Rock" ${currentMember === 'grunt:Rock' ? 'selected' : ''}>Rock Grunt</option>
                                <option value="grunt:Steel" ${currentMember === 'grunt:Steel' ? 'selected' : ''}>Steel Grunt</option>
                                <option value="grunt:Water" ${currentMember === 'grunt:Water' ? 'selected' : ''}>Water Grunt</option>
                                <option value="grunt:Typeless" ${currentMember === 'grunt:Typeless' ? 'selected' : ''}>Typeless Grunt</option>
                                <option value="grunt:Decoy" ${currentMember === 'grunt:Decoy' ? 'selected' : ''}>Decoy Grunt</option>
                            </optgroup>
                        </select>
                    </div>
                    
                    <!-- Gender toggle - only show if grunt has both genders -->
                    ${this.gruntHasBothGenders ? `
                        <div class="flex flex-col gap-2 mt-7">
                            <label class="flex items-center gap-2 text-white cursor-pointer text-sm">
                                <input type="radio" name="rocket-gender" value="male" ${this.rocketGender === 'male' ? 'checked' : ''} data-action="rocket-gender">
                                Male
                            </label>
                            <label class="flex items-center gap-2 text-white cursor-pointer text-sm">
                                <input type="radio" name="rocket-gender" value="female" ${this.rocketGender === 'female' ? 'checked' : ''} data-action="rocket-gender">
                                Female
                            </label>
                        </div>
                    ` : ''}
                    
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
                        <input type="checkbox" data-filter="special" ${this.pveFilters.special ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Special*</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="mega" ${this.pveFilters.mega ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Mega</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="shadow" ${this.pveFilters.shadow ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include Shadow</span>
                    </label>
                    <label class="flex items-center gap-2 text-white cursor-pointer">
                        <input type="checkbox" data-filter="xl" ${this.pveFilters.xl ? 'checked' : ''} class="w-4 h-4">
                        <span class="text-sm">Include XL (Lv50)</span>
                    </label>
                </div>
                <div class="text-white/60 text-xs mt-2">
                    *Special includes Legendary, Mythical, and Ultra Beast Pokémon
                </div>
            </div>

            ${currentMember ? this.renderRocketLists() : `
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
                    <i class="fa-solid fa-rocket text-white/50 text-6xl mb-4"></i>
                    <p class="text-white text-lg">Select a Rocket member to see recommendations</p>
                </div>
            `}
        `;
    }

    /**
     * Render the three-column layout for raid lists (each with damage/survivability)
     */
    renderRaidLists() {
        const lists = this.raidLists || {
            wishlist: { damage: [], survivability: [] },
            currentBest: { damage: [], survivability: [] },
            toDo: { damage: [], survivability: [] }
        };
        
        return `
            <div class="grid grid-cols-3 gap-6">
                <!-- Current Best -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-star mr-2"></i>
                        Current Best
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-bolt mr-1"></i>
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4" data-raid-current-best-damage>
                        ${lists.currentBest.damage.length > 0 
                            ? lists.currentBest.damage.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-shield mr-1"></i>
                        Survivability Focused
                    </h4>
                    <div class="space-y-2" data-raid-current-best-survivability>
                        ${lists.currentBest.survivability.length > 0 
                            ? lists.currentBest.survivability.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                </div>

                <!-- To-Do -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-list-check mr-2"></i>
                        To-Do
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-bolt mr-1"></i>
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4" data-raid-todo-damage>
                        ${lists.toDo.damage.length > 0 
                            ? lists.toDo.damage.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-shield mr-1"></i>
                        Survivability Focused
                    </h4>
                    <div class="space-y-2" data-raid-todo-survivability>
                        ${lists.toDo.survivability.length > 0 
                            ? lists.toDo.survivability.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                </div>

                <!-- Wishlist -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
                        Wishlist
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-bolt mr-1"></i>
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4">
                        ${lists.wishlist.damage.length > 0
                            ? lists.wishlist.damage.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No recommendations</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <i class="fa-solid fa-shield mr-1"></i>
                        Survivability Focused
                    </h4>
                    <div class="space-y-2">
                        ${lists.wishlist.survivability.length > 0
                            ? lists.wishlist.survivability.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No recommendations</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the four-column layout for rocket lists
     * @returns {string} HTML string
     */
    renderRocketLists() {
        const lists = this.rocketLists || { damage: [], spam: [], currentBest: [], toDo: [] };
        
        return `
            <div class="grid grid-cols-4 gap-6">
                <!-- Current Best -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-star mr-2"></i>
                        Current Best
                    </h3>
                    <div class="space-y-2">
                        ${lists.currentBest.length > 0 
                            ? lists.currentBest.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-sm text-center py-8">No Pokemon in collection</div>'}
                    </div>
                </div>

                <!-- To-Do -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-list-check mr-2"></i>
                        To-Do
                    </h3>
                    <div class="space-y-2">
                        ${lists.toDo.length > 0 
                            ? lists.toDo.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-sm text-center py-8">No improvements needed</div>'}
                    </div>
                </div>

                <!-- Damage Focused -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-bolt mr-2"></i>
                        Damage Focused
                    </h3>
                    <div class="space-y-2">
                        ${lists.damage.length > 0
                            ? lists.damage.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-sm text-center py-8">No recommendations available</div>'}
                    </div>
                </div>

                <!-- Spam Focused -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <i class="fa-solid fa-gauge-high mr-2"></i>
                        Spam Focused
                    </h3>
                    <div class="space-y-2">
                        ${lists.spam.length > 0
                            ? lists.spam.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-sm text-center py-8">No recommendations available</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single Pokemon list item for PvE lists (wishlist)
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
     * Render a user Pokemon list item (currentBest/toDo)
     * @param {Object} pokemon - User Pokemon data
     * @param {boolean} showImprovement - Whether to show improvement percentage
     * @returns {string} HTML string
     */
    renderUserPokemonListItem(pokemon, showImprovement = false) {
        const badges = [];
        if (pokemon.isShadow) badges.push('<span class="text-xs px-2 py-0.5 rounded-full bg-purple-500/80">Shadow</span>');
        if (pokemon.level > 40) badges.push('<span class="text-xs px-2 py-0.5 rounded-full bg-red-500/80">XL</span>');
        
        const displayName = pokemon.nickname || (pokemon.name + (pokemon.form ? ` (${pokemon.form})` : ''));
        
        return `
            <div class="bg-white/10 hover:bg-white/20 rounded-lg p-3 cursor-pointer transition-colors">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-white text-sm font-medium">${displayName}</span>
                    <div class="flex gap-1 flex-shrink-0">
                        ${badges.join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ====================================
    // CALCULATION LOGIC
    // ====================================

    /**
     * Calculate wishlist rankings for current defender type
     */
    calculateRaidWishlist() {
            if (!this.raidDefenderType1) {
                this.raidLists = { 
                    wishlist: { damage: [], survivability: [] },
                    currentBest: { damage: [], survivability: [] },
                    toDo: { damage: [], survivability: [] }
                };
                return;
            }
            
            // Build defender type key
            let defenderType = this.raidDefenderType1;
            if (this.raidDefenderType2 && this.raidDefenderType2 !== this.raidDefenderType1) {
                // Sort by position in POKEMON_TYPES array (same as demo)
                const POKEMON_TYPES = [
                    'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
                    'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
                    'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'
                ];
                const index1 = POKEMON_TYPES.indexOf(this.raidDefenderType1);
                const index2 = POKEMON_TYPES.indexOf(this.raidDefenderType2);
                
                if (index1 < index2) {
                    defenderType = this.raidDefenderType1 + '/' + this.raidDefenderType2;
                } else {
                    defenderType = this.raidDefenderType2 + '/' + this.raidDefenderType1;
                }
            }
            
            // Get filters
            const filters = this.getRaidFilters();
            
            // Build candidate list for WISHLIST
            const candidates = [];
            
            for (const pokemon of this.app.pokemon) {
                // Apply filters
                if (!filters.special && (
                    pokemon.pokemonClass === 'POKEMON_CLASS_LEGENDARY' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_MYTHIC' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_ULTRA_BEAST'
                )) continue;
                
                // Regular form - L40 and L50
                if (pokemon.raidTDO && pokemon.raidTDO[defenderType]) {
                    const l40Data = pokemon.raidTDO[defenderType].L40_15_15_15;
                    const l50Data = pokemon.raidTDO[defenderType].L50_15_15_15;
                    
                    if (l40Data) {
                        const damageScore = Math.pow(l40Data.dps, this.dmgDpsExponent) * Math.pow(l40Data.tdo, this.dmgTdoExponent);
                        const surviveScore = Math.pow(l40Data.dps, this.surviveDpsExponent) * Math.pow(l40Data.tdo, this.surviveTdoExponent);
                        
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
                            damageScore: damageScore,
                            surviveScore: surviveScore,
                            moveset: l40Data.moveset
                        });
                    }

                    if (l50Data && filters.xl) {
                    const damageScore = Math.pow(l50Data.dps, this.dmgDpsExponent) * Math.pow(l50Data.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l50Data.dps, this.surviveDpsExponent) * Math.pow(l50Data.tdo, this.surviveTdoExponent);
                    
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
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data.moveset
                    });
                }
            }
            
            // Shadow form - L40 and L50
            if (filters.shadow && pokemon.shadowRaidTDO && pokemon.shadowRaidTDO[defenderType]) {
                const l40Data = pokemon.shadowRaidTDO[defenderType].L40_15_15_15;
                const l50Data = pokemon.shadowRaidTDO[defenderType].L50_15_15_15;
                
                if (l40Data) {
                    const damageScore = Math.pow(l40Data.dps, this.dmgDpsExponent) * Math.pow(l40Data.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l40Data.dps, this.surviveDpsExponent) * Math.pow(l40Data.tdo, this.surviveTdoExponent);
                    
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
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l40Data.moveset
                    });
                }
                
                if (l50Data && filters.xl) {
                    const damageScore = Math.pow(l50Data.dps, this.dmgDpsExponent) * Math.pow(l50Data.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l50Data.dps, this.surviveDpsExponent) * Math.pow(l50Data.tdo, this.surviveTdoExponent);
                    
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
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data.moveset
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
                            const damageScore = Math.pow(l40Data.dps, this.dmgDpsExponent) * Math.pow(l40Data.tdo, this.dmgTdoExponent);
                            const surviveScore = Math.pow(l40Data.dps, this.surviveDpsExponent) * Math.pow(l40Data.tdo, this.surviveTdoExponent);
                            
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
                                damageScore: damageScore,
                                surviveScore: surviveScore,
                                moveset: l40Data.moveset
                            });
                        }
                        
                        if (l50Data && filters.xl) {
                            const damageScore = Math.pow(l50Data.dps, this.dmgDpsExponent) * Math.pow(l50Data.tdo, this.dmgTdoExponent);
                            const surviveScore = Math.pow(l50Data.dps, this.surviveDpsExponent) * Math.pow(l50Data.tdo, this.surviveTdoExponent);
                            
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
                                damageScore: damageScore,
                                surviveScore: surviveScore,
                                moveset: l50Data.moveset
                            });
                        }
                    }
                }
            }
        }
        
        // WISHLIST: Sort by damage score
        const wishlistDamage = [...candidates].sort((a, b) => b.damageScore - a.damageScore).slice(0, 6);
        
        // Remove damage picks from survivability pool
        const damageIds = new Set(wishlistDamage.map(p => 
            `${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}`
        ));
        const remainingForSurvivability = candidates.filter(p => 
            !damageIds.has(`${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}`)
        );
        
        // Sort by survivability score
        const wishlistSurvivability = remainingForSurvivability
            .sort((a, b) => b.surviveScore - a.surviveScore)
            .slice(0, 6);
        
        // Store wishlist immediately
        this.raidLists = { 
            wishlist: { 
                damage: wishlistDamage, 
                survivability: wishlistSurvivability 
            },
            currentBest: { damage: [], survivability: [] },
            toDo: { damage: [], survivability: [] }
        };
        
        // Kick off async user Pokemon calculation
        this.calculateUserPokemonRaidLists(defenderType, filters);
    }

    /**
     * Calculate Current Best and To-Do lists from user Pokemon for Raid battles
     * @param {string} defenderType - Defender type key
     * @param {Object} filters - Filter settings
     */
    calculateUserPokemonRaidLists(defenderType, filters) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['userPokemon'], 'readonly');
            const store = tx.objectStore('userPokemon');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const userPokemon = request.result || [];
                const currentBest = [];
                const toDo = [];
                
                for (const userMon of userPokemon) {
                    // Find base Pokemon data for filter checks
                    const basePokemon = this.app.pokemon.find(p => 
                        p.name === userMon.name && 
                        (p.form === userMon.form || (!p.form && !userMon.form))
                    );
                    
                    if (!basePokemon) continue;
                    
                    // Apply filters
                    if (!filters.shadow && userMon.shadow) continue;
                    if (!filters.special && (
                        basePokemon.pokemonClass === 'POKEMON_CLASS_LEGENDARY' ||
                        basePokemon.pokemonClass === 'POKEMON_CLASS_MYTHIC' ||
                        basePokemon.pokemonClass === 'POKEMON_CLASS_ULTRA_BEAST'
                    )) continue;
                    
                    // CURRENT BEST: Only use actual level
                    const currentScore = this.calculateUserMonRaidScore(
                        userMon.currentRaidTDO,
                        defenderType
                    );
                    
                    if (currentScore) {
                        currentBest.push({
                            ...currentScore,
                            userMonId: userMon.id,
                            name: userMon.name,
                            form: userMon.form,
                            nickname: userMon.nickname,
                            isShadow: userMon.shadow,
                            level: userMon.level
                        });
                    }
                    
                    // TO-DO: Add L40 version
                    if (userMon.assignedRaidTDO && userMon.assignedRaidTDO[defenderType]) {
                        const l40Data = userMon.assignedRaidTDO[defenderType].L40;
                        
                        if (l40Data) {
                            const damageScore = Math.pow(l40Data.dps, this.dmgDpsExponent) * Math.pow(l40Data.tdo, this.dmgTdoExponent);
                            const surviveScore = Math.pow(l40Data.dps, this.surviveDpsExponent) * Math.pow(l40Data.tdo, this.surviveTdoExponent);
                            
                            toDo.push({
                                userMonId: userMon.id + '-L40',
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                level: 40,
                                dps: l40Data.dps,
                                tdo: l40Data.tdo,
                                damageScore: damageScore,
                                surviveScore: surviveScore,
                                moveset: l40Data.moveset
                            });
                        }
                        
                        // TO-DO: Add L50 version if XL filter enabled
                        const l50Data = userMon.assignedRaidTDO[defenderType].L50;
                        
                        if (l50Data && filters.xl) {
                            const damageScore = Math.pow(l50Data.dps, this.dmgDpsExponent) * Math.pow(l50Data.tdo, this.dmgTdoExponent);
                            const surviveScore = Math.pow(l50Data.dps, this.surviveDpsExponent) * Math.pow(l50Data.tdo, this.surviveTdoExponent);
                            
                            toDo.push({
                                userMonId: userMon.id + '-L50',
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                level: 50,
                                dps: l50Data.dps,
                                tdo: l50Data.tdo,
                                damageScore: damageScore,
                                surviveScore: surviveScore,
                                moveset: l50Data.moveset
                            });
                        }
                    }
                }
                
                // Sort all currentBest by damage score
                const currentBestDamage = [...currentBest].sort((a, b) => b.damageScore - a.damageScore).slice(0, 6);

                // Remove damage picks from survivability pool
                const currentBestDamageIds = new Set(currentBestDamage.map(p => p.userMonId));
                const currentBestForSurvivability = currentBest.filter(p => !currentBestDamageIds.has(p.userMonId));

                // Sort remaining by survivability score
                const currentBestSurvivability = currentBestForSurvivability.sort((a, b) => b.surviveScore - a.surviveScore).slice(0, 6);

                // Sort all toDo by damage score
                const toDoDamage = [...toDo].sort((a, b) => b.damageScore - a.damageScore).slice(0, 6);

                // Remove damage picks from survivability pool
                const toDoDamageIds = new Set(toDoDamage.map(p => p.userMonId));
                const toDoForSurvivability = toDo.filter(p => !toDoDamageIds.has(p.userMonId));

                // Sort remaining by survivability score
                const toDoSurvivability = toDoForSurvivability.sort((a, b) => b.surviveScore - a.surviveScore).slice(0, 6);

                // Update with correct structure
                this.raidLists.currentBest = {
                    damage: currentBestDamage,
                    survivability: currentBestSurvivability
                };

                this.raidLists.toDo = {
                    damage: toDoDamage,
                    survivability: toDoSurvivability
                };

                this.updateRaidListsDOM();
            };
        };
    }

    /**
     * Update just the Raid lists DOM without full re-render
     */
    updateRaidListsDOM() {
        const damageContainer = document.querySelector('[data-raid-current-best-damage]');
        const survContainer = document.querySelector('[data-raid-current-best-survivability]');
        const todoDamageContainer = document.querySelector('[data-raid-todo-damage]');
        const todoSurvContainer = document.querySelector('[data-raid-todo-survivability]');
        
        if (damageContainer && this.raidLists.currentBest.damage) {
            damageContainer.innerHTML = this.raidLists.currentBest.damage.length > 0
                ? this.raidLists.currentBest.damage.map(p => this.renderUserPokemonListItem(p)).join('')
                : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>';
        }
        
        if (survContainer && this.raidLists.currentBest.survivability) {
            survContainer.innerHTML = this.raidLists.currentBest.survivability.length > 0
                ? this.raidLists.currentBest.survivability.map(p => this.renderUserPokemonListItem(p)).join('')
                : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>';
        }
        
        if (todoDamageContainer && this.raidLists.toDo.damage) {
            todoDamageContainer.innerHTML = this.raidLists.toDo.damage.length > 0
                ? this.raidLists.toDo.damage.map(p => this.renderUserPokemonListItem(p, true)).join('')
                : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>';
        }
        
        if (todoSurvContainer && this.raidLists.toDo.survivability) {
            todoSurvContainer.innerHTML = this.raidLists.toDo.survivability.length > 0
                ? this.raidLists.toDo.survivability.map(p => this.renderUserPokemonListItem(p, true)).join('')
                : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>';
        }
    }

    /**
     * Calculate Raid score for a specific user Pokemon
     * @param {Object} raidTDO - User's raidTDO object (currentRaidTDO or assignedRaidTDO)
     * @param {string} defenderType - Defender type key
     * @returns {Object|null} Score data or null
     */
    calculateUserMonRaidScore(raidTDO, defenderType) {
        if (!raidTDO || !raidTDO[defenderType]) return null;
        
        const data = raidTDO[defenderType];
        
        const damageScore = Math.pow(data.dps, this.dmgDpsExponent) * Math.pow(data.tdo, this.dmgTdoExponent);
        const surviveScore = Math.pow(data.dps, this.surviveDpsExponent) * Math.pow(data.tdo, this.surviveTdoExponent);
        
        return {
            dps: data.dps,
            tdo: data.tdo,
            damageScore: damageScore,
            surviveScore: surviveScore,
            moveset: data.moveset
        };
    }

    /**
     * Get current filter states
     * @returns {Object} Filter states
     */
    getRaidFilters() {
        return this.pveFilters;
    }

    /**
     * Calculate all lists for Rocket battles
     */
    calculateRocketWishlist() { 
        if (!this.rocketMember) {
            this.rocketLists = { damage: [], spam: [], currentBest: [], toDo: [] };
            return;
        }
        
        // Get Rocket lineup from metadata store
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['metadata'], 'readonly');
            const store = tx.objectStore('metadata');
            const request = store.get('rocketTeams');
            
            request.onsuccess = () => {
                const rocketData = request.result?.value || {};
                const [memberType, memberId] = this.rocketMember.split(':');
                
                let lineup = null;
                let lookupKey = memberId; // For logging
                const gender = 'male'; // Default to male for now
                
                if (memberType === 'leader') {
                    if (memberId === 'giovanni') {
                        lineup = rocketData.giovanni;
                    } else {
                        lineup = rocketData.leaders?.[memberId];
                    }
                    lookupKey = memberId;
                } else {
                    // Grunt - just search for the memberId in the key
                    const allGrunts = {
                        ...rocketData.grunts?.male,
                        ...rocketData.grunts?.female
                    };
                    
                    // Find all grunts matching this type
                    const matchingKeys = Object.keys(allGrunts).filter(key => {
                        if (memberId === 'Typeless') {
                            return key === 'Male Grunt' || key === 'Female Grunt';
                        } else if (memberId === 'Decoy') {
                            return key.includes('Decoy');
                        } else {
                            return key.includes(`${memberId}-type`);
                        }
                    });
                    
                    if (matchingKeys.length === 0) {
                        this.gruntHasBothGenders = false;
                        lineup = null;
                    } else if (matchingKeys.length === 1) {
                        this.gruntHasBothGenders = false;
                        lineup = allGrunts[matchingKeys[0]];
                        lookupKey = matchingKeys[0];
                    } else {
                        // Has both genders
                        this.gruntHasBothGenders = true;
                        const preferredKey = matchingKeys.find(k => k.includes(this.rocketGender === 'male' ? 'Male' : 'Female'));
                        lineup = allGrunts[preferredKey || matchingKeys[0]];
                        lookupKey = preferredKey || matchingKeys[0];
                    }
                }
                
                this.calculateRocketListsForLineup(lineup);
            };
        };
    }

    /**
     * Calculate Rocket lists for a specific lineup
     * @param {Object} lineup - Lineup with slot1, slot2, slot3 arrays
     */
    calculateRocketListsForLineup(lineup) {
        const filters = this.getRaidFilters();
        
        const spamWishlist = [];
        const damageWishlist = [];
        
        // Process each slot
        for (let slotNum = 1; slotNum <= 3; slotNum++) {
            const slotKey = `slot${slotNum}`;
            const possibleTypes = this.formatSlotTypes(lineup[slotKey]); //1019
            
            if (!possibleTypes || possibleTypes.length === 0) continue;
            
            // Get IDs of mons already chosen in previous slots (for exclusion)
            const usedSpamIds = spamWishlist.map(p => `${p.name}-${p.form}-${p.isShadow}-${p.level}`);
            const usedDamageIds = damageWishlist.map(p => `${p.name}-${p.form}-${p.isShadow}-${p.level}`);
            
            // SPAM WISHLIST for this slot
            const spamCandidates = [];
            
            for (const pokemon of this.app.pokemon) {
                // Apply filters
                if (!filters.special && (
                    pokemon.pokemonClass === 'POKEMON_CLASS_LEGENDARY' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_MYTHIC' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_ULTRA_BEAST'
                )) continue;
                
                // Regular spam
                if (pokemon.spamTDO) {
                    for (const spamMoveset of pokemon.spamTDO) {
                        const l40Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L40');
                        
                        if (l40Score.tdoSum > 0) {
                            const pokemonId = `${pokemon.name}-${pokemon.form}-false-40`;
                            if (usedSpamIds.includes(pokemonId)) continue;
                            
                            const compositeScore = spamMoveset.spamScore * 
                                Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                            
                            spamCandidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: false,
                                requiresXL: false,
                                moveset: spamMoveset.moveset,
                                spamScore: spamMoveset.spamScore,
                                dpsSum: l40Score.dpsSum,
                                tdoSum: l40Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 40,
                                slot: slotNum
                            });
                        }
                        
                        if (filters.xl) {
                            const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                            
                            if (l50Score.tdoSum > 0) {
                                const pokemonId = `${pokemon.name}-${pokemon.form}-false-50`;
                                if (usedSpamIds.includes(pokemonId)) continue;
                                
                                const compositeScore = spamMoveset.spamScore * 
                                    Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                    Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                                
                                spamCandidates.push({
                                    name: pokemon.name,
                                    form: pokemon.form,
                                    isShadow: false,
                                    requiresXL: true,
                                    moveset: spamMoveset.moveset,
                                    spamScore: spamMoveset.spamScore,
                                    dpsSum: l50Score.dpsSum,
                                    tdoSum: l50Score.tdoSum,
                                    compositeScore: compositeScore,
                                    level: 50,
                                    slot: slotNum
                                });
                            }
                        }
                    }
                }
                
                // Shadow spam
                if (filters.shadow && pokemon.shadowSpamTDO) {
                    for (const spamMoveset of pokemon.shadowSpamTDO) {
                        const l40Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L40');
                        
                        if (l40Score.tdoSum > 0) {
                            const pokemonId = `${pokemon.name}-${pokemon.form}-true-40`;
                            if (usedSpamIds.includes(pokemonId)) continue;
                            
                            const compositeScore = spamMoveset.spamScore * 
                                Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                            
                            spamCandidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: true,
                                requiresXL: false,
                                moveset: spamMoveset.moveset,
                                spamScore: spamMoveset.spamScore,
                                dpsSum: l40Score.dpsSum,
                                tdoSum: l40Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 40,
                                slot: slotNum
                            });
                        }
                        
                        if (filters.xl) {
                            const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                            
                            if (l50Score.tdoSum > 0) {
                                const pokemonId = `${pokemon.name}-${pokemon.form}-true-50`;
                                if (usedSpamIds.includes(pokemonId)) continue;
                                
                                const compositeScore = spamMoveset.spamScore * 
                                    Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                    Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                                
                                spamCandidates.push({
                                    name: pokemon.name,
                                    form: pokemon.form,
                                    isShadow: true,
                                    requiresXL: true,
                                    moveset: spamMoveset.moveset,
                                    spamScore: spamMoveset.spamScore,
                                    dpsSum: l50Score.dpsSum,
                                    tdoSum: l50Score.tdoSum,
                                    compositeScore: compositeScore,
                                    level: 50,
                                    slot: slotNum
                                });
                            }
                        }
                    }
                }
            }
            
            // Pick best spam for this slot
            spamCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
            if (spamCandidates.length > 0) {
                spamWishlist.push(spamCandidates[0]);
            }
            
            // DAMAGE WISHLIST for this slot
            const damageCandidates = [];
            
            for (const pokemon of this.app.pokemon) {
                // Apply filters
                if (!filters.special && (
                    pokemon.pokemonClass === 'POKEMON_CLASS_LEGENDARY' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_MYTHIC' ||
                    pokemon.pokemonClass === 'POKEMON_CLASS_ULTRA_BEAST'
                )) continue;
                
                // Regular rocketTDO
                if (pokemon.rocketTDO) {
                    const l40Score = this.calculateSlotScoreFromRocketTDO(pokemon.rocketTDO, possibleTypes, 'L40');
                    
                    if (l40Score.tdoSum > 0) {
                        const pokemonId = `${pokemon.name}-${pokemon.form}-false-40`;
                        if (usedDamageIds.includes(pokemonId)) continue;
                        
                        const compositeScore = 
                            Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                            Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                        
                        damageCandidates.push({
                            name: pokemon.name,
                            form: pokemon.form,
                            isShadow: false,
                            requiresXL: false,
                            moveset: l40Score.moveset,
                            dpsSum: l40Score.dpsSum,
                            tdoSum: l40Score.tdoSum,
                            compositeScore: compositeScore,
                            level: 40,
                            slot: slotNum
                        });
                    }
                    
                    if (filters.xl) {
                        const l50Score = this.calculateSlotScoreFromRocketTDO(pokemon.rocketTDO, possibleTypes, 'L50');
                        
                        if (l50Score.tdoSum > 0) {
                            const pokemonId = `${pokemon.name}-${pokemon.form}-false-50`;
                            if (usedDamageIds.includes(pokemonId)) continue;
                            
                            const compositeScore = 
                                Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                            
                            damageCandidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: false,
                                requiresXL: true,
                                moveset: l50Score.moveset,
                                dpsSum: l50Score.dpsSum,
                                tdoSum: l50Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 50,
                                slot: slotNum
                            });
                        }
                    }
                }
                
                // Shadow rocketTDO
                if (filters.shadow && pokemon.shadowRocketTDO) {
                    const l40Score = this.calculateSlotScoreFromRocketTDO(pokemon.shadowRocketTDO, possibleTypes, 'L40');
                    
                    if (l40Score.tdoSum > 0) {
                        const pokemonId = `${pokemon.name}-${pokemon.form}-true-40`;
                        if (usedDamageIds.includes(pokemonId)) continue;
                        
                        const compositeScore = 
                            Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                            Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                        
                        damageCandidates.push({
                            name: pokemon.name,
                            form: pokemon.form,
                            isShadow: true,
                            requiresXL: false,
                            moveset: l40Score.moveset,
                            dpsSum: l40Score.dpsSum,
                            tdoSum: l40Score.tdoSum,
                            compositeScore: compositeScore,
                            level: 40,
                            slot: slotNum
                        });
                    }
                    
                    if (filters.xl) {
                        const l50Score = this.calculateSlotScoreFromRocketTDO(pokemon.shadowRocketTDO, possibleTypes, 'L50');
                        
                        if (l50Score.tdoSum > 0) {
                            const pokemonId = `${pokemon.name}-${pokemon.form}-true-50`;
                            if (usedDamageIds.includes(pokemonId)) continue;
                            
                            const compositeScore = 
                                Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                            
                            damageCandidates.push({
                                name: pokemon.name,
                                form: pokemon.form,
                                isShadow: true,
                                requiresXL: true,
                                moveset: l50Score.moveset,
                                dpsSum: l50Score.dpsSum,
                                tdoSum: l50Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 50,
                                slot: slotNum
                            });
                        }
                    }
                }
            }
            
            // Pick best damage for this slot
            damageCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
            if (damageCandidates.length > 0) {
                damageWishlist.push(damageCandidates[0]);
            }
        }
        
        // Store wishlist
        this.rocketLists = {
            spam: spamWishlist,
            damage: damageWishlist,
            currentBest: [],
            toDo: []
        };
        
        // Calculate user Pokemon lists (no filters applied)
        this.calculateUserPokemonRocketLists(lineup);
    }

    /**
     * Format slot types from array format to string keys
     * @param {Array} slotTypes - Array of type arrays like [['FIRE'], ['WATER', 'GROUND']]
     * @returns {Array} Array of type keys like ['FIRE', 'GROUND/WATER']
     */
    formatSlotTypes(slotTypes) {
        return slotTypes.map(typeArray => {
            if (typeArray.length === 1) {
                return typeArray[0];
            } else {
                // Sort same way as raid (alphabetically by POKEMON_TYPES order)
                const POKEMON_TYPES = [
                    'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
                    'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
                    'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'
                ];
                const index1 = POKEMON_TYPES.indexOf(typeArray[0]);
                const index2 = POKEMON_TYPES.indexOf(typeArray[1]);
                
                if (index1 < index2) {
                    return typeArray[0] + '/' + typeArray[1];
                } else {
                    return typeArray[1] + '/' + typeArray[0];
                }
            }
        });
    }

    /**
     * Calculate summed DPS and TDO for a slot from spamTDO data
     * @param {Object} tdoByType - spamTDO's tdoByType object
     * @param {Array} possibleTypes - Array of type keys for this slot
     * @param {string} level - 'L40' or 'L50'
     * @returns {Object} {dpsSum, tdoSum}
     */
    calculateSlotScore(tdoByType, possibleTypes, level) {
        let dpsSum = 0;
        let tdoSum = 0;
        
        for (const defenderType of possibleTypes) {
            const typeData = tdoByType[defenderType];
            if (typeData && typeData[level]) {
                dpsSum += typeData[level].dps;
                tdoSum += typeData[level].tdo;
            }
        }
        
        return { dpsSum, tdoSum };
    }

    /**
     * Calculate summed DPS and TDO for a slot from rocketTDO data
     * @param {Object} rocketTDO - rocketTDO object
     * @param {Array} possibleTypes - Array of type keys for this slot
     * @param {string} level - 'L40' or 'L50'
     * @returns {Object} {dpsSum, tdoSum, moveset}
     */
    calculateSlotScoreFromRocketTDO(rocketTDO, possibleTypes, level) {
        let dpsSum = 0;
        let tdoSum = 0;
        let moveset = null;
        
        for (const defenderType of possibleTypes) {
            const typeData = rocketTDO[defenderType];
            if (typeData && typeData[level]) {
                dpsSum += typeData[level].dps;
                tdoSum += typeData[level].tdo;
                if (!moveset) moveset = typeData[level].moveset;
            }
        }
        
        return { dpsSum, tdoSum, moveset };
    }

    /**
     * Calculate Current Best and To-Do lists from user Pokemon for Rocket battles
     * @param {Object} lineup - Lineup with slot1, slot2, slot3 arrays
     */
    calculateUserPokemonRocketLists(lineup) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['userPokemon'], 'readonly');
            const store = tx.objectStore('userPokemon');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const userPokemon = request.result || [];
                const currentBestSpam = [];
                const currentBestDamage = [];
                const toDoSpam = [];
                const toDoDamage = [];
                
                // Process each slot
                for (let slotNum = 1; slotNum <= 3; slotNum++) {
                    const slotKey = `slot${slotNum}`;
                    const possibleTypes = this.formatSlotTypes(lineup[slotKey]);
                    
                    if (!possibleTypes || possibleTypes.length === 0) continue;
                    
                    // CURRENT BEST SPAM for this slot
                    const currentSpamCandidates = [];
                    
                    for (const userMon of userPokemon) {
                        if (!userMon.currentSpamTDO || userMon.currentSpamTDO.length === 0) continue;
                        
                        // User's current spam (only one moveset)
                        const spamMoveset = userMon.currentSpamTDO[0];
                        const score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L40');
                        
                        if (score.tdoSum > 0) {
                            const compositeScore = spamMoveset.spamScore * 
                                Math.pow(score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(score.tdoSum, this.dmgTdoExponent);
                            
                            currentSpamCandidates.push({
                                userMonId: userMon.id,
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: spamMoveset.moveset,
                                spamScore: spamMoveset.spamScore,
                                dpsSum: score.dpsSum,
                                tdoSum: score.tdoSum,
                                compositeScore: compositeScore,
                                level: userMon.level,
                                slot: slotNum
                            });
                        }
                    }
                    
                    currentSpamCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (currentSpamCandidates.length > 0) {
                        currentBestSpam.push(currentSpamCandidates[0]);
                    }
                    
                    // CURRENT BEST DAMAGE for this slot
                    const currentDamageCandidates = [];
                    
                    for (const userMon of userPokemon) {
                        if (!userMon.currentRocketTDO) continue;
                        
                        const score = this.calculateSlotScoreFromRocketTDO(userMon.currentRocketTDO, possibleTypes, 'L40');
                        
                        if (score.tdoSum > 0) {
                            const compositeScore = 
                                Math.pow(score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(score.tdoSum, this.dmgTdoExponent);
                            
                            currentDamageCandidates.push({
                                userMonId: userMon.id,
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: score.moveset,
                                dpsSum: score.dpsSum,
                                tdoSum: score.tdoSum,
                                compositeScore: compositeScore,
                                level: userMon.level,
                                slot: slotNum
                            });
                        }
                    }
                    
                    currentDamageCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (currentDamageCandidates.length > 0) {
                        currentBestDamage.push(currentDamageCandidates[0]);
                    }
                    
                    // TO-DO SPAM for this slot (L40 and L50 versions)
                    const toDoSpamCandidates = [];
                    
                    for (const userMon of userPokemon) {
                        if (!userMon.assignedSpamTDO || userMon.assignedSpamTDO.length === 0) continue;
                        
                        // Each assigned spam moveset is a separate entry
                        for (const spamMoveset of userMon.assignedSpamTDO) {
                            const l40Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L40');
                            const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                            
                            if (l40Score.tdoSum > 0) {
                                const compositeScore = spamMoveset.spamScore * 
                                    Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                                    Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                                
                                toDoSpamCandidates.push({
                                    userMonId: userMon.id + '-spam-L40-' + spamMoveset.moveset.fast,
                                    name: userMon.name,
                                    form: userMon.form,
                                    nickname: userMon.nickname,
                                    isShadow: userMon.shadow,
                                    moveset: spamMoveset.moveset,
                                    spamScore: spamMoveset.spamScore,
                                    dpsSum: l40Score.dpsSum,
                                    tdoSum: l40Score.tdoSum,
                                    compositeScore: compositeScore,
                                    level: 40,
                                    slot: slotNum
                                });
                            }
                            
                            if (l50Score.tdoSum > 0) {
                                const compositeScore = spamMoveset.spamScore * 
                                    Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                    Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                                
                                toDoSpamCandidates.push({
                                    userMonId: userMon.id + '-spam-L50-' + spamMoveset.moveset.fast,
                                    name: userMon.name,
                                    form: userMon.form,
                                    nickname: userMon.nickname,
                                    isShadow: userMon.shadow,
                                    moveset: spamMoveset.moveset,
                                    spamScore: spamMoveset.spamScore,
                                    dpsSum: l50Score.dpsSum,
                                    tdoSum: l50Score.tdoSum,
                                    compositeScore: compositeScore,
                                    level: 50,
                                    slot: slotNum
                                });
                            }
                        }
                    }
                    
                    toDoSpamCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (toDoSpamCandidates.length > 0) {
                        toDoSpam.push(toDoSpamCandidates[0]);
                    }
                    
                    // TO-DO DAMAGE for this slot (L40 and L50 versions)
                    const toDoDamageCandidates = [];
                    
                    for (const userMon of userPokemon) {
                        if (!userMon.assignedRocketTDO) continue;
                        
                        const l40Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L40');
                        const l50Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L50');
                        
                        if (l40Score.tdoSum > 0) {
                            const compositeScore = 
                                Math.pow(l40Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l40Score.tdoSum, this.dmgTdoExponent);
                            
                            toDoDamageCandidates.push({
                                userMonId: userMon.id + '-damage-L40',
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: l40Score.moveset,
                                dpsSum: l40Score.dpsSum,
                                tdoSum: l40Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 40,
                                slot: slotNum
                            });
                        }
                        
                        if (l50Score.tdoSum > 0) {
                            const compositeScore = 
                                Math.pow(l50Score.dpsSum, this.dmgDpsExponent) * 
                                Math.pow(l50Score.tdoSum, this.dmgTdoExponent);
                            
                            toDoDamageCandidates.push({
                                userMonId: userMon.id + '-damage-L50',
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: l50Score.moveset,
                                dpsSum: l50Score.dpsSum,
                                tdoSum: l50Score.tdoSum,
                                compositeScore: compositeScore,
                                level: 50,
                                slot: slotNum
                            });
                        }
                    }
                    
                    toDoDamageCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (toDoDamageCandidates.length > 0) {
                        toDoDamage.push(toDoDamageCandidates[0]);
                    }
                }
                
                // Update lists
                this.rocketLists.currentBest = [...currentBestSpam, ...currentBestDamage];
                this.rocketLists.toDo = [...toDoSpam, ...toDoDamage];
                
                this.app.render();
            };
        };
    }

    /**
     * Get current filter states
     * @returns {Object} Filter states
     */
    getRaidFilters() {
        return this.pveFilters;
    }

    // ====================================
    // EVENT LISTENERS
    // ====================================

    /**
     * Attach PvE-specific event listeners
     */
    attachEventListeners() {
        // PvE tab switching
        document.querySelectorAll('[data-action="pve-tab"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pveTab = btn.dataset.tab;
                this.app.render();
            });
        });

        // Type sprite selectors
        document.querySelectorAll('[data-action="select-type"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const clickedType = e.currentTarget.dataset.type;
                
                // If clicking type1 again (either alone or with type2), set both to same type (mono-type)
                if (clickedType === this.raidDefenderType1) {
                    this.raidDefenderType1 = clickedType;
                    this.raidDefenderType2 = clickedType;
                }
                // If clicking type2 again, set both to same type (mono-type)
                else if (clickedType === this.raidDefenderType2) {
                    this.raidDefenderType1 = clickedType;
                    this.raidDefenderType2 = clickedType;
                }
                // If no types selected, make this type1
                else if (!this.raidDefenderType1) {
                    this.raidDefenderType1 = clickedType;
                }
                // If only type1 selected, make this type2
                else if (!this.raidDefenderType2) {
                    this.raidDefenderType2 = clickedType;
                }
                // If both selected, remove type1 and shift (sliding window)
                else {
                    this.raidDefenderType1 = this.raidDefenderType2;
                    this.raidDefenderType2 = clickedType;
                }
                
                if (this.raidDefenderType1) {
                    this.calculateRaidWishlist();
                }
                this.app.render();
            });
        });

        // Rocket member selector
        const rocketMember = document.querySelector('[data-action="rocket-member"]');
        if (rocketMember) {
            rocketMember.addEventListener('change', (e) => {
                this.rocketMember = e.target.value;
                if (this.rocketMember) {
                    this.calculateRocketWishlist();
                }
            });
        }

        // Gender toggle for Rocket grunts
        document.querySelectorAll('[data-action="rocket-gender"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            this.rocketGender = e.target.value;
            if (this.rocketMember) {
                this.calculateRocketWishlist();
            }
        });
        });

        // Filter checkboxes
        document.querySelectorAll('[data-filter]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                // Update stored filter state
                const filterName = e.target.getAttribute('data-filter');
                this.pveFilters[filterName] = e.target.checked;
                
                // Recalculate based on current tab
                if (this.pveTab === 'raid' && this.raidDefenderType1) {
                    this.calculateRaidWishlist();
                    this.app.render();
                } else if (this.pveTab === 'rocket' && this.rocketMember) {
                    this.calculateRocketWishlist();
                }
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
}