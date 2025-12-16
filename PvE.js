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
        this.availableGruntTypes_male = null;
        this.availableGruntTypes_female = null;
        
        // ---- PVE LISTS ----
        this.raidLists = {
            wishlist: { damage: [], survivability: [] },
            currentBest: { damage: [], survivability: [] },
            toDo: { damage: [], survivability: [] }
        };
        this.rocketLists = {
            wishlist: { spam: [], damage: [] },
            currentBest: { spam: [], damage: [] },
            toDo: { spam: [], damage: [] }
        };

        // ---- PVE FILTERS ----
        this.pveFilters = {
            special: true,  // Covers legendary, mythical, ultra beast
            mega: true,
            shadow: true,
            xl: true
        };
        
        // ---- DETAIL PANEL STATE ----
        this.detailPanelOpen = false;
        this.detailPanelData = null;
        
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
            <div class="min-h-screen ${currentTab === 'rocket' ? 'rocket-bg' : 'raid-bg'} pb-20 relative">
                <!-- Dark overlay -->
                <div class="absolute inset-0 bg-black/40 pointer-events-none"></div>
                
                <!-- Content wrapper with relative positioning -->
                <div class="relative z-10">
                    <!-- Header with tabs -->
                    <div class="${currentTab === 'rocket' ? 'bg-red-900/30' : 'bg-purple-900/30'} backdrop-blur-sm p-4 sticky top-0 z-20">
                        <div class="max-w-7xl mx-auto">
                            <div class="flex gap-2 mb-4">
                                <button 
                                    data-action="pve-tab" 
                                    data-tab="raid"
                                    class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${currentTab === 'raid' ? 'bg-white text-purple-600' : 'bg-white/20 text-white'}"
                                >
                                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Pokestops%20and%20Gyms/ActivityLogGymLogo.png" class="inline-block w-6 h-6 mr-2" alt="Gym">
                                    Raid / Gym
                                </button>
                                <button 
                                    data-action="pve-tab" 
                                    data-tab="rocket"
                                    class="flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${currentTab === 'rocket' ? 'bg-white text-red-600' : 'bg-white/20 text-white'}"
                                >
                                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Rocket/teamrocket_r.png" class="inline-block w-6 h-6 mr-2" alt="Rocket">
                                    Team Rocket
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="max-w-7xl mx-auto p-4">
                        ${currentTab === 'raid' ? this.renderRaidTab() : this.renderRocketTab()}
                    </div>
                </div>

                <!-- Back FAB -->
                <button class="fab-button fab-center bg-gray-600 text-white" data-action="back">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
            
            <!-- Detail Panel -->
            ${this.renderDetailPanel()}
        `;
    }

    /**
     * Render Raid/Gym tab content
     * @returns {string} HTML string
     */
    renderRaidTab() {
        const defenderType1 = this.raidDefenderType1 || '';
        const defenderType2 = this.raidDefenderType2 || '';
        
        // Type mapping to image filenames
        const typeImages = {
            'NORMAL': 'POKEMON_TYPE_NORMAL.png',
            'FIGHTING': 'POKEMON_TYPE_FIGHTING.png',
            'FLYING': 'POKEMON_TYPE_FLYING.png',
            'POISON': 'POKEMON_TYPE_POISON.png',
            'GROUND': 'POKEMON_TYPE_GROUND.png',
            'ROCK': 'POKEMON_TYPE_ROCK.png',
            'BUG': 'POKEMON_TYPE_BUG.png',
            'GHOST': 'POKEMON_TYPE_GHOST.png',
            'STEEL': 'POKEMON_TYPE_STEEL.png',
            'FIRE': 'POKEMON_TYPE_FIRE.png',
            'WATER': 'POKEMON_TYPE_WATER.png',
            'GRASS': 'POKEMON_TYPE_GRASS.png',
            'ELECTRIC': 'POKEMON_TYPE_ELECTRIC.png',
            'PSYCHIC': 'POKEMON_TYPE_PSYCHIC.png',
            'ICE': 'POKEMON_TYPE_ICE.png',
            'DRAGON': 'POKEMON_TYPE_DRAGON.png',
            'DARK': 'POKEMON_TYPE_DARK.png',
            'FAIRY': 'POKEMON_TYPE_FAIRY.png'
        };
        
        const types = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
        
        // Arrange in 2 rows of 9
        const typeRows = [
            types.slice(0, 9),
            types.slice(9, 18)
        ];
        
        return `
            <!-- Controls -->
            <div class="bg-white/40 backdrop-blur-sm rounded-xl p-6 mb-6">
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
                
                <!-- Type Image Grid -->
                <div class="space-y-2 mb-6">
                    ${typeRows.map(row => `
                        <div class="flex gap-2 justify-center">
                            ${row.map(type => {
                                const isSelected = type === defenderType1 || type === defenderType2;
                                const imageFile = typeImages[type];
                                return `
                                    <button
                                        data-action="select-type"
                                        data-type="${type}"
                                        class="relative transition-all hover:scale-105 ${isSelected ? 'ring-4 ring-white shadow-lg' : 'hover:ring-2 hover:ring-white/50'} rounded-full"
                                        title="${type.charAt(0) + type.slice(1).toLowerCase()}"
                                    >
                                        <img 
                                            src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Types/${imageFile}"
                                            alt="${type}"
                                            class="w-16 h-16 rounded-full"
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
                    *Special includes Legendary, Mythical, Ultra Beast, and Paradox Pokémon
                </div>
            </div>

            ${defenderType1 ? `
                ${this.renderRaidLists()}
                ${this.renderRaidHeatMap()}
            ` : `
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Pokestops%20and%20Gyms/ActivityLogGymLogo.png" class="inline-block w-24 h-24 opacity-50 mb-4" alt="Gym">
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
        const [memberType, memberId] = currentMember.split(':');
        
        // Determine which icon is selected
        const isGiovanniSelected = currentMember === 'leader:giovanni';
        const isArloSelected = currentMember === 'leader:arlo';
        const isSierraSelected = currentMember === 'leader:sierra';
        const isCliffSelected = currentMember === 'leader:cliff';
        const isMaleGruntSelected = memberType === 'grunt' && this.rocketGender === 'male';
        const isFemaleGruntSelected = memberType === 'grunt' && this.rocketGender === 'female';
        
        // Show dropdown if a grunt is clicked but no specific type selected yet
        const showGruntDropdown = (isMaleGruntSelected || isFemaleGruntSelected) && memberType === 'grunt';
        
        return `
            <!-- Controls -->
            <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
                <div class="flex items-start justify-between mb-4">
                    <label class="text-white text-lg font-semibold">Select Rocket Member</label>
                    <button 
                        data-action="rocket-help"
                        class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                        title="Help"
                    >
                        <i class="fa-solid fa-question text-sm"></i>
                    </button>
                </div>
                
                <!-- Member Selection Icons -->
                <div class="flex gap-3 justify-center mb-4">
                    <!-- Giovanni -->
                    <button
                        data-action="select-rocket-member"
                        data-member="leader:giovanni"
                        class="relative rounded-lg transition-all hover:scale-105 ${isGiovanniSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Giovanni"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/ZeChrales/PogoAssets/master/static_assets/png/Giovanni_icon.png"
                                alt="Giovanni"
                                class="w-full h-auto"
                                style="transform: scale(2); transform-origin: top center;"
                            />
                        </div>
                    </button>
                    
                    <!-- Arlo -->
                    <button
                        data-action="select-rocket-member"
                        data-member="leader:arlo"
                        class="relative rounded-lg transition-all hover:scale-105 ${isArloSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Arlo"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/NPCs/ExecRed_icon.png"
                                alt="Arlo"
                                class="w-full h-auto"
                                style="transform: scale(1); transform-origin: top center;"
                            />
                        </div>
                    </button>

                    <!-- Sierra -->
                    <button
                        data-action="select-rocket-member"
                        data-member="leader:sierra"
                        class="relative rounded-lg transition-all hover:scale-105 ${isSierraSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Sierra"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/NPCs/ExecYellow_icon.png"
                                alt="Sierra"
                                class="w-full h-auto"
                                style="transform: scale(1); transform-origin: top center;"
                            />
                        </div>
                    </button>

                    <!-- Cliff -->
                    <button
                        data-action="select-rocket-member"
                        data-member="leader:cliff"
                        class="relative rounded-lg transition-all hover:scale-105 ${isCliffSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Cliff"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/NPCs/ExecBlue_icon.png"
                                alt="Cliff"
                                class="w-full h-auto"
                                style="transform: scale(1); transform-origin: top center;"
                            />
                        </div>
                    </button>
                    
                    <!-- Male Grunt -->
                    <button
                        data-action="toggle-grunt-dropdown"
                        data-gender="male"
                        class="relative rounded-lg transition-all hover:scale-105 ${isMaleGruntSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Male Grunt"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/ZeChrales/PogoAssets/master/static_assets/png/MaleGrunt_icon.png"
                                alt="Male Grunt"
                                class="w-full h-auto"
                                style="transform: scale(2); transform-origin: top center;"
                            />
                        </div>
                    </button>
                    
                    <!-- Female Grunt -->
                    <button
                        data-action="toggle-grunt-dropdown"
                        data-gender="female"
                        class="relative rounded-lg transition-all hover:scale-105 ${isFemaleGruntSelected ? 'ring-4 ring-red-500 shadow-lg shadow-red-500/50' : 'hover:ring-2 hover:ring-white/50'}"
                        title="Female Grunt"
                    >
                        <div class="w-20 h-20 overflow-hidden rounded-lg bg-gray-800/50">
                            <img 
                                src="https://raw.githubusercontent.com/ZeChrales/PogoAssets/master/static_assets/png/FemaleGrunt_icon.png"
                                alt="Female Grunt"
                                class="w-full h-auto"
                                style="transform: scale(2); transform-origin: top center;"
                            />
                        </div>
                    </button>
                </div>
                
                <!-- Grunt Type Dropdown -->
                ${showGruntDropdown ? `
                    <div class="mb-4 flex justify-center">
                        <select 
                            data-action="select-grunt-type" 
                            class="bg-white/90 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
                        >
                            <option value="">Select Grunt Type</option>
                            ${this.getGruntOptionsForGender(this.rocketGender, memberId)}
                        </select>
                    </div>
                ` : ''}
                
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
                    *Special includes Legendary, Mythical, Ultra Beast, and Paradox Pokémon
                </div>
            </div>

            ${currentMember && memberId ? this.renderRocketLists() : `
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center">
                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Rocket/teamrocket_r.png" class="inline-block w-24 h-24 opacity-50 mb-4" alt="Rocket">
                    <p class="text-white text-lg">Select a Rocket member to see recommendations</p>
                </div>
            `}
        `;
    }

    /**
     * Get grunt options filtered by gender
     * @param {string} gender - 'male' or 'female'
     * @param {string} selectedType - Currently selected grunt type (e.g., 'Bug', 'Dark')
     * @returns {string} HTML options for the select
     */
    getGruntOptionsForGender(gender, selectedType = '') {
        // Use cached available types if we have them for this gender
        const cacheKey = `availableGruntTypes_${gender}`;
        if (this[cacheKey]) {
            return this[cacheKey].map(type => 
                `<option value="grunt:${type}" ${selectedType === type ? 'selected' : ''}>${type} Grunt</option>`
            ).join('');
        }
        
        // Otherwise fetch from DB (async - will trigger re-render when complete)
        this.fetchAvailableGruntTypes(gender);
        
        // Return loading state
        return '<option value="">Loading...</option>';
    }

    /**
     * Fetch available grunt types from the database
     * @param {string} gender - 'male' or 'female'
     */
    fetchAvailableGruntTypes(gender) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['metadata'], 'readonly');
            const store = tx.objectStore('metadata');
            const request = store.get('rocketTeams');
            
            request.onsuccess = () => {
                const rocketData = request.result?.value || {};
                const grunts = rocketData.grunts?.[gender] || {};
                
                // Extract available grunt types from keys
                const availableTypes = new Set();
                
                const genderPrefix = gender.charAt(0).toUpperCase() + gender.slice(1);
                console.log('Looking for:', `${genderPrefix} Grunt`);
                
                Object.keys(grunts).forEach(key => {
                    const trimmedKey = key.trim();
                    
                    if (trimmedKey === `${genderPrefix} Grunt` || trimmedKey === `${genderPrefix}\u00A0Grunt`) {
                        console.log('MATCH! Adding Typeless');
                        availableTypes.add('Typeless');
                    } else {
                        // Log character codes for debugging the "Male Grunt" case
                        if (trimmedKey.includes('Grunt') && !trimmedKey.includes('-type') && !trimmedKey.includes('Decoy')) {
                            console.log('Typeless key char codes:', trimmedKey.split('').map(c => c.charCodeAt(0)));
                            console.log('Expected char codes:', `${genderPrefix} Grunt`.split('').map(c => c.charCodeAt(0)));
                        }
                        
                        if (trimmedKey.includes('Decoy')) {
                            availableTypes.add('Decoy');
                        } else if (trimmedKey.includes('-type')) {
                            const match = trimmedKey.match(/^(\w+)-type/);
                            if (match) {
                                availableTypes.add(match[1]);
                            }
                        }
                    }
                });
                
                console.log('Final types:', Array.from(availableTypes));
                
                // Sort alphabetically
                const sortedTypes = Array.from(availableTypes).sort();
                
                // Cache the result
                const cacheKey = `availableGruntTypes_${gender}`;
                this[cacheKey] = sortedTypes;
                
                // Re-render to show the options
                this.app.render();
            };
        };
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
                <div class="bg-white/60 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" class="inline-block w-6 h-6 mr-2" alt="Current Best">
                        Current Best
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4" data-raid-current-best-damage>
                        ${lists.currentBest.damage.length > 0 
                            ? lists.currentBest.damage.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png" class="inline-block w-5 h-5 mr-1" alt="Survivability">
                        Survivability Focused
                    </h4>
                    <div class="space-y-2" data-raid-current-best-survivability>
                        ${lists.currentBest.survivability.length > 0 
                            ? lists.currentBest.survivability.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                </div>

                <!-- Potential Best -->
                <div class="bg-white/60 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png" class="inline-block w-6 h-6 mr-2" alt="Potential Best">
                        Potential Best
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4" data-raid-todo-damage>
                        ${lists.toDo.damage.length > 0 
                            ? lists.toDo.damage.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png" class="inline-block w-5 h-5 mr-1" alt="Survivability">
                        Survivability Focused
                    </h4>
                    <div class="space-y-2" data-raid-todo-survivability>
                        ${lists.toDo.survivability.length > 0 
                            ? lists.toDo.survivability.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                </div>

                <!-- Wishlist -->
                <div class="bg-white/60 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png" class="inline-block w-6 h-6 mr-2" alt="Wishlist">
                        Wishlist
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2 mb-4">
                        ${lists.wishlist.damage.length > 0
                            ? lists.wishlist.damage.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No recommendations</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/leftovers.png" class="inline-block w-5 h-5 mr-1" alt="Survivability">
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
     * Render the three-column layout for rocket lists (each with spam/damage)
     * @returns {string} HTML string
     */
    renderRocketLists() {
        const lists = this.rocketLists || { 
            wishlist: { spam: [], damage: [] },
            currentBest: { spam: [], damage: [] },
            toDo: { spam: [], damage: [] }
        };
        
        return `
            <div class="grid grid-cols-3 gap-6">
                <!-- Current Best -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" class="inline-block w-6 h-6 mr-2" alt="Current Best">
                        Current Best
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png" class="inline-block w-5 h-5 mr-1" alt="Spam">
                        Spam Focused
                    </h4>
                    <div class="space-y-2 mb-4">
                        ${lists.currentBest.spam.length > 0 
                            ? lists.currentBest.spam.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2">
                        ${lists.currentBest.damage.length > 0 
                            ? lists.currentBest.damage.map(p => this.renderUserPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No Pokemon</div>'}
                    </div>
                </div>

                <!-- Potential Best -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png" class="inline-block w-6 h-6 mr-2" alt="Potential Best">
                        Potential Best
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png" class="inline-block w-5 h-5 mr-1" alt="Spam">
                        Spam Focused
                    </h4>
                    <div class="space-y-2 mb-4">
                        ${lists.toDo.spam.length > 0 
                            ? lists.toDo.spam.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2">
                        ${lists.toDo.damage.length > 0 
                            ? lists.toDo.damage.map(p => this.renderUserPokemonListItem(p, true)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No improvements</div>'}
                    </div>
                </div>

                <!-- Wishlist -->
                <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                    <h3 class="text-white text-lg font-bold mb-4 pb-3 border-b border-white/20">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png" class="inline-block w-6 h-6 mr-2" alt="Wishlist">
                        Wishlist
                    </h3>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/quick-claw.png" class="inline-block w-5 h-5 mr-1" alt="Spam">
                        Spam Focused
                    </h4>
                    <div class="space-y-2 mb-4">
                        ${lists.wishlist.spam.length > 0
                            ? lists.wishlist.spam.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No recommendations</div>'}
                    </div>
                    
                    <h4 class="text-white/80 text-sm font-semibold mb-2">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/focus-band.png" class="inline-block w-5 h-5 mr-1" alt="Damage">
                        Damage Focused
                    </h4>
                    <div class="space-y-2">
                        ${lists.wishlist.damage.length > 0
                            ? lists.wishlist.damage.map(p => this.renderPokemonListItem(p)).join('')
                            : '<div class="text-white/70 text-xs text-center py-4">No recommendations</div>'}
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
        if (pokemon.isShadow) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Rocket/ic_shadow.png" class="w-5 h-5" alt="Shadow" title="Shadow">');
        if (pokemon.isMega) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Menu%20Icons/tex_mega_evolve_icon.png" class="w-5 h-5" alt="Mega" title="Mega">');
        if (pokemon.requiresXL) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Today%20View/TodayView_Icon_CandyXL.png" class="w-5 h-5" alt="XL" title="XL Candy Required">');
        
        const displayName = pokemon.name + (pokemon.form ? ` (${pokemon.form})` : '') + (pokemon.megaForm ? ` ${pokemon.megaForm}` : '');

        // Create unique ID including IVs
        const entryId = `${pokemon.name}-${pokemon.form}-${pokemon.isShadow}-${pokemon.megaForm}-${pokemon.level}-${pokemon.ivs.attack}-${pokemon.ivs.defense}-${pokemon.ivs.stamina}`;

        return `
            <div 
                class="bg-white/10 hover:bg-white/20 rounded-lg p-3 cursor-pointer transition-colors flex items-center justify-between gap-2"
                data-action="open-wishlist-detail"
                data-entry-id="${entryId}"
            >
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
        if (pokemon.isShadow) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Rocket/ic_shadow.png" class="w-5 h-5" alt="Shadow" title="Shadow">');
        if (pokemon.level > 40) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Today%20View/TodayView_Icon_CandyXL.png" class="w-5 h-5" alt="XL" title="XL Candy Required">');
        
        const displayName = pokemon.nickname || (pokemon.name + (pokemon.form ? ` (${pokemon.form})` : ''));
        
        return `
            <div class="bg-white/10 hover:bg-white/1 rounded-lg p-3 cursor-pointer transition-colors">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-white text-sm font-medium">${displayName}</span>
                    <div class="flex gap-1 flex-shrink-0">
                        ${badges.join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render detail panel for wishlist Pokemon
     * @returns {string} HTML string
     */
    renderDetailPanel() {
        if (!this.detailPanelOpen || !this.detailPanelData) return '';
        
        const data = this.detailPanelData;
        
        return `
            <!-- Overlay -->
            <div class="fixed inset-0 bg-black/50 z-40 detail-panel-overlay" data-action="close-detail-panel"></div>
            
            <!-- Panel -->
            <div class="fixed right-0 top-0 h-full w-2/3 bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto detail-panel">
                <!-- Header -->
                <div class="sticky top-0 bg-gradient-to-r from-purple-900 to-indigo-900 p-6 flex items-center justify-between z-10">
                    <div class="flex items-center gap-4">
                        <h2 class="text-white text-2xl font-bold">
                            ${data.displayName}
                        </h2>
                        <div class="flex gap-2">
                            ${data.badges.join('')}
                        </div>
                    </div>
                    <button 
                        data-action="close-detail-panel"
                        class="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                    >
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
                
                <!-- Content -->
                <div class="p-6 space-y-6">
                    <!-- Stats Grid -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Level -->
                        <div class="bg-white/10 rounded-lg p-4">
                            <div class="text-white/60 text-sm mb-1">Level</div>
                            <div class="text-white text-2xl font-bold">${data.level}</div>
                        </div>
                        
                        <!-- CP -->
                        <div class="bg-white/10 rounded-lg p-4">
                            <div class="text-white/60 text-sm mb-1">CP</div>
                            <div class="text-white text-2xl font-bold">${data.cp || 'Calculating...'}</div>
                        </div>
                    </div>
                    
                    <!-- IVs -->
                    <div class="bg-white/10 rounded-lg p-4">
                        <div class="text-white/60 text-sm mb-3">IVs</div>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <div class="text-white/60 text-xs mb-1">Attack</div>
                                <div class="text-white text-xl font-bold">${data.ivs.attack}</div>
                            </div>
                            <div>
                                <div class="text-white/60 text-xs mb-1">Defense</div>
                                <div class="text-white text-xl font-bold">${data.ivs.defense}</div>
                            </div>
                            <div>
                                <div class="text-white/60 text-xs mb-1">Stamina</div>
                                <div class="text-white text-xl font-bold">${data.ivs.stamina}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Moveset -->
                    <div class="bg-white/10 rounded-lg p-4">
                        <div class="text-white/60 text-sm mb-3">Recommended Moveset</div>
                        
                        <!-- Fast Move -->
                        ${data.fastMoveDetails ? `
                            <div class="mb-4 pb-4 border-b border-white/20">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-white font-semibold">${data.fastMoveDetails.name}</div>
                                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Types/POKEMON_TYPE_${data.fastMoveDetails.type}.png" class="w-8 h-8 rounded-full" alt="${data.fastMoveDetails.type}">
                                </div>
                                <div class="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <div class="text-white/60 text-xs">EPT</div>
                                        <div class="text-white">${data.fastMoveDetails.ept.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="text-white/60 text-xs">DPT</div>
                                        <div class="text-white">${data.fastMoveDetails.dpt.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="text-white/60 text-xs">Duration</div>
                                        <div class="text-white">${data.fastMoveDetails.duration}s</div>
                                    </div>
                                </div>
                            </div>
                        ` : '<div class="text-white/60 text-sm">Loading move data...</div>'}
                        
                        <!-- Charge Move -->
                        ${data.chargeMoveDetails ? `
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-white font-semibold">${data.chargeMoveDetails.name}</div>
                                    <img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Types/POKEMON_TYPE_${data.chargeMoveDetails.type}.png" class="w-8 h-8 rounded-full" alt="${data.chargeMoveDetails.type}">
                                </div>
                                <div class="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <div class="text-white/60 text-xs">DPE</div>
                                        <div class="text-white">${data.chargeMoveDetails.dpe.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="text-white/60 text-xs">Energy</div>
                                        <div class="text-white">${data.chargeMoveDetails.energy}</div>
                                    </div>
                                    <div>
                                        <div class="text-white/60 text-xs">Damage</div>
                                        <div class="text-white">${data.chargeMoveDetails.damage}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Battle-only forms that should not appear in PvE wishlists
    BATTLE_ONLY_FORMS = [
        'Darmanitan (Zen)',
        'Darmanitan (Galarian Zen)',
        'Morpeko (Hangry)',
        'Wishiwashi (School)',
        'Minior (Blue)',
        'Meloetta (Pirouette)',
        'Palafin (Hero)',
    ];

    isBattleOnlyForm(pokemon) {
        const displayName = pokemon.name + (pokemon.form ? ` (${pokemon.form})` : '');
        return this.BATTLE_ONLY_FORMS.includes(displayName);
    }
    /**
     * Open detail panel for a wishlist Pokemon
     * @param {Object} pokemon - Pokemon data from wishlist
     */
    async openDetailPanel(pokemon) {
    // Get base Pokemon data
    const basePokemon = this.app.pokemon.find(p => 
        p.name === pokemon.name && 
        (p.form === pokemon.form || (!p.form && !pokemon.form))
    );
    
    if (!basePokemon) return;
    
    // Get stats (handle mega case)
    let stats;
    if (pokemon.isMega && basePokemon.megas) {
        const mega = basePokemon.megas.find(m => m.form === pokemon.megaForm);
        stats = mega ? mega.stats : basePokemon.stats;
    } else {
        stats = basePokemon.stats;
    }
    
    // Calculate CP - YOU FILL THIS IN
    const cp = this.calculateCP(stats, pokemon.ivs, pokemon.level);
    console.log('Calculated CP:', cp, 'Stats:', stats, 'IVs:', pokemon.ivs, 'Level:', pokemon.level);
    
    // Prepare display name
    const displayName = pokemon.name + 
        (pokemon.form ? ` (${pokemon.form})` : '') + 
        (pokemon.megaForm ? ` ${pokemon.megaForm}` : '');
    
    // Prepare badges
    const badges = [];
    if (pokemon.isShadow) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Rocket/ic_shadow.png" class="w-6 h-6" alt="Shadow">');
    if (pokemon.isMega) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Menu%20Icons/tex_mega_evolve_icon.png" class="w-6 h-6" alt="Mega">');
    if (pokemon.requiresXL) badges.push('<img src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Today%20View/TodayView_Icon_CandyXL.png" class="w-6 h-6" alt="XL">');
    
    this.detailPanelData = {
        displayName,
        badges,
        level: pokemon.level,
        cp,
        ivs: pokemon.ivs,
        moveset: pokemon.moveset,
        fastMoveDetails: null,
        chargeMoveDetails: null
    };
    
    this.detailPanelOpen = true;
    this.app.render();
    
    // Fetch move details asynchronously
    await this.fetchMoveDetails(pokemon.moveset);
    this.app.render();
}

    /**
     * Calculate CP for a Pokemon
     * @param {Object} baseStats - Base stats {attack, defense, hp}
     * @param {Object} ivs - IVs {attack, defense, stamina}
     * @param {number} level - Pokemon level
     * @returns {number} CP value
     */
    calculateCP(baseStats, ivs, level) {
        const cpmIndex = Math.floor((level - 1) * 2);
        const cpmArray = [0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159, 0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];
        const cpm = cpmArray[cpmIndex];
        
        if (!cpm) {
            console.error('CPM not found for level:', level);
            return 0;
        }

        const attack = (baseStats.attack + ivs.attack) * cpm;
        const defense = (baseStats.defense + ivs.defense) * cpm;
        const stamina = (baseStats.hp + ivs.stamina) * cpm;
        
        const cp = Math.floor(attack * Math.sqrt(defense) * Math.sqrt(stamina) / 10);
        
        return Math.max(10, cp);
    }

    /**
     * Fetch move details from database
     * @param {Object} moveset - Moveset with fast and charge moves
     */
    async fetchMoveDetails(moveset) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve) => {
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['moves'], 'readonly');
                const store = tx.objectStore('moves');
                
                // Determine mode based on current tab
                const mode = this.pveTab === 'raid' ? 'pve' : 'pvp';
                
                // Construct proper move IDs
                const fastMoveId = `${mode}-fast-${moveset.fast}`;
                const chargeMoveId = `${mode}-charge-${moveset.charge}`;
                
                const fastRequest = store.get(fastMoveId);
                const chargeRequest = store.get(chargeMoveId);
                
                fastRequest.onsuccess = () => {
                    const fastMove = fastRequest.result;
                    
                    if (fastMove) {
                        // Duration calculation
                        let duration;
                        let ept, dpt;
                        
                        if (mode === 'pve') {
                            duration = fastMove.durationMs / 1000;
                            // EPT/DPT = per 0.5s turn
                            ept = (fastMove.energy / fastMove.durationMs) * 500;
                            dpt = (fastMove.power / fastMove.durationMs) * 500;
                        } else {
                            // PvP uses turns directly
                            duration = fastMove.duration === 0 ? 0.5 : fastMove.duration * 0.5;
                            ept = fastMove.ept;
                            dpt = fastMove.dpt;
                        }
                        
                        this.detailPanelData.fastMoveDetails = {
                            name: fastMove.name,
                            type: fastMove.type,
                            ept: ept,
                            dpt: dpt,
                            duration: duration
                        };
                    }
                };
                
                chargeRequest.onsuccess = () => {
                    const chargeMove = chargeRequest.result;
                    
                    if (chargeMove) {
                        this.detailPanelData.chargeMoveDetails = {
                            name: chargeMove.name,
                            type: chargeMove.type,
                            dpe: chargeMove.dpe,
                            energy: chargeMove.energy,
                            damage: chargeMove.power
                        };
                    }
                    
                    resolve();
                };
            };
        });
    }

    /**
     * Format move name from SCREAMING_SNAKE_CASE to Title Case
     * @param {string} moveName - Move name in SCREAMING_SNAKE_CASE
     * @returns {string} Formatted name
     */
    formatMoveName(moveName) {
        return moveName
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Close detail panel
     */
    closeDetailPanel() {
        this.detailPanelOpen = false;
        this.detailPanelData = null;
        this.app.render();
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
        
        const filters = this.getRaidFilters();
        const candidates = [];
        
        for (const pokemon of this.app.pokemon) {
            if (this.isBattleOnlyForm(pokemon)) continue;
            if (!filters.special && pokemon.thirdMoveCost?.stardust === 100000) continue;
            
            // Regular form - L40 and L50
            if (pokemon.raidTDO && pokemon.raidTDO[defenderType]) {
                const l40Data = pokemon.raidTDO[defenderType].L40_15_0_15;
                const l50Data = pokemon.raidTDO[defenderType].L50_15_0_15;
                
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
                        ivs: { attack: 15, defense: 0, stamina: 15 },
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
                        ivs: { attack: 15, defense: 0, stamina: 15 },
                        dps: l50Data.dps,
                        tdo: l50Data.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data.moveset
                    });
                }
                
                const l40Data_perfect = pokemon.raidTDO[defenderType].L40_15_15_15;
                const l50Data_perfect = pokemon.raidTDO[defenderType].L50_15_15_15;
                
                if (l40Data_perfect) {
                    const damageScore = Math.pow(l40Data_perfect.dps, this.dmgDpsExponent) * Math.pow(l40Data_perfect.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l40Data_perfect.dps, this.surviveDpsExponent) * Math.pow(l40Data_perfect.tdo, this.surviveTdoExponent);
                    
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: false,
                        isMega: false,
                        megaForm: null,
                        requiresXL: false,
                        level: 40,
                        ivs: { attack: 15, defense: 15, stamina: 15 },
                        dps: l40Data_perfect.dps,
                        tdo: l40Data_perfect.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l40Data_perfect.moveset
                    });
                }

                if (l50Data_perfect && filters.xl) {
                    const damageScore = Math.pow(l50Data_perfect.dps, this.dmgDpsExponent) * Math.pow(l50Data_perfect.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l50Data_perfect.dps, this.surviveDpsExponent) * Math.pow(l50Data_perfect.tdo, this.surviveTdoExponent);
                    
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: false,
                        isMega: false,
                        megaForm: null,
                        requiresXL: true,
                        level: 50,
                        ivs: { attack: 15, defense: 15, stamina: 15 },
                        dps: l50Data_perfect.dps,
                        tdo: l50Data_perfect.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data_perfect.moveset
                    });
                }
            }
            
            // Shadow form - L40 and L50
            if (filters.shadow && pokemon.shadowRaidTDO && pokemon.shadowRaidTDO[defenderType]) {
                const l40Data = pokemon.shadowRaidTDO[defenderType].L40_15_0_15;
                const l50Data = pokemon.shadowRaidTDO[defenderType].L50_15_0_15;
                
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
                        ivs: { attack: 15, defense: 0, stamina: 15 },
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
                        ivs: { attack: 15, defense: 0, stamina: 15 },
                        dps: l50Data.dps,
                        tdo: l50Data.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data.moveset
                    });
                }
                
                // Now add 15/15/15 shadow variants
                const l40Data_perfect = pokemon.shadowRaidTDO[defenderType].L40_15_15_15;
                const l50Data_perfect = pokemon.shadowRaidTDO[defenderType].L50_15_15_15;
                
                if (l40Data_perfect) {
                    const damageScore = Math.pow(l40Data_perfect.dps, this.dmgDpsExponent) * Math.pow(l40Data_perfect.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l40Data_perfect.dps, this.surviveDpsExponent) * Math.pow(l40Data_perfect.tdo, this.surviveTdoExponent);
                    
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: true,
                        isMega: false,
                        megaForm: null,
                        requiresXL: false,
                        level: 40,
                        ivs: { attack: 15, defense: 15, stamina: 15 },
                        dps: l40Data_perfect.dps,
                        tdo: l40Data_perfect.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l40Data_perfect.moveset
                    });
                }

                if (l50Data_perfect && filters.xl) {
                    const damageScore = Math.pow(l50Data_perfect.dps, this.dmgDpsExponent) * Math.pow(l50Data_perfect.tdo, this.dmgTdoExponent);
                    const surviveScore = Math.pow(l50Data_perfect.dps, this.surviveDpsExponent) * Math.pow(l50Data_perfect.tdo, this.surviveTdoExponent);
                    
                    candidates.push({
                        name: pokemon.name,
                        form: pokemon.form,
                        isShadow: true,
                        isMega: false,
                        megaForm: null,
                        requiresXL: true,
                        level: 50,
                        ivs: { attack: 15, defense: 15, stamina: 15 },
                        dps: l50Data_perfect.dps,
                        tdo: l50Data_perfect.tdo,
                        damageScore: damageScore,
                        surviveScore: surviveScore,
                        moveset: l50Data_perfect.moveset
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
                                ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                ivs: { attack: 15, defense: 15, stamina: 15 },
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
            `${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}-${p.ivs.attack}-${p.ivs.defense}-${p.ivs.stamina}`
        ));
        const remainingForSurvivability = candidates.filter(p => 
            !damageIds.has(`${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}-${p.ivs.attack}-${p.ivs.defense}-${p.ivs.stamina}`)
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
     * Calculate Current Best and Potential Best lists from user Pokemon for Rocket battles
     * @param {Object} lineup - Lineup with slot1, slot2, slot3 arrays
     * @param {Object} filters - Filter settings
     */
    calculateUserPokemonRocketLists(lineup, filters) {
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
                    
                    // CURRENT BEST SPAM for this slot (NO FILTERS)
                    const currentSpamCandidates = [];

                    for (const userMon of userPokemon) {
                        if (!userMon.currentSpamTDO || userMon.currentSpamTDO.length === 0) continue;
                        
                        const spamMoveset = userMon.currentSpamTDO[0];
                        
                        let dpsSum = 0;
                        let tdoSum = 0;
                        
                        for (const defenderType of possibleTypes) {
                            const typeData = spamMoveset.tdoByType[defenderType];
                            if (typeData) {
                                dpsSum += typeData.dps;
                                tdoSum += typeData.tdo;
                            }
                        }
                        
                        if (tdoSum > 0) {
                            const compositeScore = spamMoveset.spamScore * 
                                Math.pow(dpsSum, this.dmgDpsExponent) * 
                                Math.pow(tdoSum, this.dmgTdoExponent);
                            
                            currentSpamCandidates.push({
                                userMonId: userMon.id,
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: spamMoveset.moveset,
                                spamScore: spamMoveset.spamScore,
                                dpsSum: dpsSum,
                                tdoSum: tdoSum,
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
                    
                    // CURRENT BEST DAMAGE for this slot (NO FILTERS)
                    const currentDamageCandidates = [];

                    for (const userMon of userPokemon) {
                        if (!userMon.currentRocketTDO) continue;
                        
                        let dpsSum = 0;
                        let tdoSum = 0;
                        let moveset = null;
                        
                        for (const defenderType of possibleTypes) {
                            const typeData = userMon.currentRocketTDO[defenderType];
                            if (typeData) {
                                dpsSum += typeData.dps;
                                tdoSum += typeData.tdo;
                                if (!moveset) moveset = typeData.moveset;
                            }
                        }
                        
                        if (tdoSum > 0) {
                            const compositeScore = 
                                Math.pow(dpsSum, this.dmgDpsExponent) * 
                                Math.pow(tdoSum, this.dmgTdoExponent);
                            
                            currentDamageCandidates.push({
                                userMonId: userMon.id,
                                name: userMon.name,
                                form: userMon.form,
                                nickname: userMon.nickname,
                                isShadow: userMon.shadow,
                                moveset: moveset,
                                dpsSum: dpsSum,
                                tdoSum: tdoSum,
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
                    
                    // Potential Best SPAM for this slot (APPLY FILTERS)
                    const toDoSpamCandidates = [];

                    for (const userMon of userPokemon) {
                        if (!userMon.assignedSpamTDO || userMon.assignedSpamTDO.length === 0) continue;
                        
                        // Find base Pokemon for filter checks
                        const basePokemon = this.app.pokemon.find(p => 
                            p.name === userMon.name && 
                            (p.form === userMon.form || (!p.form && !userMon.form))
                        );
                        
                        if (!basePokemon) continue;
                        
                        // Apply filters
                        if (!filters.shadow && userMon.shadow) continue;
                        if (!filters.special && basePokemon.thirdMoveCost?.stardust === 100000) continue;
                        
                        // Each assigned spam moveset is a separate entry
                        for (const spamMoveset of userMon.assignedSpamTDO) {
                            // If below L40, show both L40 and L50
                            if (userMon.level < 40) {
                                const l40Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L40');
                                
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
                                
                                if (filters.xl) {
                                    const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                                    
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
                            // If L40-49, ALWAYS show current level, optionally show L50
                            else if (userMon.level < 50) {
                                // Current level using currentSpamTDO - ALWAYS SHOWN
                                if (userMon.currentSpamTDO && userMon.currentSpamTDO.length > 0) {
                                    const currentMoveset = userMon.currentSpamTDO[0];
                                    
                                    let dpsSum = 0;
                                    let tdoSum = 0;
                                    
                                    for (const defenderType of possibleTypes) {
                                        const typeData = currentMoveset.tdoByType[defenderType];
                                        if (typeData) {
                                            dpsSum += typeData.dps;
                                            tdoSum += typeData.tdo;
                                        }
                                    }
                                    
                                    if (tdoSum > 0) {
                                        const compositeScore = currentMoveset.spamScore * 
                                            Math.pow(dpsSum, this.dmgDpsExponent) * 
                                            Math.pow(tdoSum, this.dmgTdoExponent);
                                        
                                        toDoSpamCandidates.push({
                                            userMonId: userMon.id + '-spam-current',
                                            name: userMon.name,
                                            form: userMon.form,
                                            nickname: userMon.nickname,
                                            isShadow: userMon.shadow,
                                            moveset: currentMoveset.moveset,
                                            spamScore: currentMoveset.spamScore,
                                            dpsSum: dpsSum,
                                            tdoSum: tdoSum,
                                            compositeScore: compositeScore,
                                            level: userMon.level,
                                            slot: slotNum
                                        });
                                    }
                                }
                                
                                // L50 version - only if XL filter enabled
                                if (filters.xl) {
                                    const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                                    
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
                            // If L50, ALWAYS show L50 version
                            else {
                                const l50Score = this.calculateSlotScore(spamMoveset.tdoByType, possibleTypes, 'L50');
                                
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
                    }
                    
                    toDoSpamCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (toDoSpamCandidates.length > 0) {
                        toDoSpam.push(toDoSpamCandidates[0]);
                    }

                    // Potential Best DAMAGE for this slot (APPLY FILTERS)
                    const toDoDamageCandidates = [];

                    for (const userMon of userPokemon) {
                        if (!userMon.assignedRocketTDO) continue;
                        
                        // Find base Pokemon for filter checks
                        const basePokemon = this.app.pokemon.find(p => 
                            p.name === userMon.name && 
                            (p.form === userMon.form || (!p.form && !userMon.form))
                        );
                        
                        if (!basePokemon) continue;
                        
                        // Apply filters
                        if (!filters.shadow && userMon.shadow) continue;
                        if (!filters.special && basePokemon.thirdMoveCost?.stardust === 100000) continue;
                        
                        // If below L40, show both L40 and L50
                        if (userMon.level < 40) {
                            const l40Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L40');
                            
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
                            
                            if (filters.xl) {
                                const l50Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L50');
                                
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
                        }
                        // If L40-49, ALWAYS show current level, optionally show L50
                        else if (userMon.level < 50) {
                            // Current level using currentRocketTDO - ALWAYS SHOWN
                            if (userMon.currentRocketTDO) {
                                let dpsSum = 0;
                                let tdoSum = 0;
                                let moveset = null;
                                
                                for (const defenderType of possibleTypes) {
                                    const typeData = userMon.currentRocketTDO[defenderType];
                                    if (typeData) {
                                        dpsSum += typeData.dps;
                                        tdoSum += typeData.tdo;
                                        if (!moveset) moveset = typeData.moveset;
                                    }
                                }
                                
                                if (tdoSum > 0) {
                                    const compositeScore = 
                                        Math.pow(dpsSum, this.dmgDpsExponent) * 
                                        Math.pow(tdoSum, this.dmgTdoExponent);
                                    
                                    toDoDamageCandidates.push({
                                        userMonId: userMon.id + '-damage-current',
                                        name: userMon.name,
                                        form: userMon.form,
                                        nickname: userMon.nickname,
                                        isShadow: userMon.shadow,
                                        moveset: moveset,
                                        dpsSum: dpsSum,
                                        tdoSum: tdoSum,
                                        compositeScore: compositeScore,
                                        level: userMon.level,
                                        slot: slotNum
                                    });
                                }
                            }
                            
                            // L50 version - only if XL filter enabled
                            if (filters.xl) {
                                const l50Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L50');
                                
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
                        }
                        // If L50, ALWAYS show L50 version
                        else {
                            const l50Score = this.calculateSlotScoreFromRocketTDO(userMon.assignedRocketTDO, possibleTypes, 'L50');
                            
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
                    }

                    toDoDamageCandidates.sort((a, b) => b.compositeScore - a.compositeScore);
                    if (toDoDamageCandidates.length > 0) {
                        toDoDamage.push(toDoDamageCandidates[0]);
                    }
                }
                
                // Update lists with new structure
                this.rocketLists.currentBest = {
                    spam: currentBestSpam,
                    damage: currentBestDamage
                };
                
                this.rocketLists.toDo = {
                    spam: toDoSpam,
                    damage: toDoDamage
                };
                
                this.app.render();
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
        console.log('calculateRocketWishlist called with:', this.rocketMember);
        
        if (!this.rocketMember) {
            this.rocketLists = { 
                wishlist: { spam: [], damage: [] },
                currentBest: { spam: [], damage: [] },
                toDo: { spam: [], damage: [] }
            };
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
                
                console.log('Rocket data lookup - memberType:', memberType, 'memberId:', memberId, 'gender:', this.rocketGender);
                
                let lineup = null;
                let lookupKey = memberId;
                const gender = this.rocketGender;
                
                if (memberType === 'leader') {
                    if (memberId === 'giovanni') {
                        lineup = rocketData.giovanni;
                    } else {
                        lineup = rocketData.leaders?.[memberId];
                    }
                    lookupKey = memberId;
                } else {
                    // Grunt - search for the memberId in the key
                    const allGrunts = {
                        ...rocketData.grunts?.male,
                        ...rocketData.grunts?.female
                    };

                    console.log('All grunt keys:', Object.keys(allGrunts));

                    // Find all grunts matching this type
                    const matchingKeys = Object.keys(allGrunts).filter(key => {
                    if (memberId === 'Typeless') {
                        // Match grunt keys without a type prefix
                        const hasNoType = !key.includes('-type');
                        const hasNoDecoy = !key.includes('Decoy');
                        const hasGrunt = key.includes('Grunt');
                        const result = hasNoType && hasNoDecoy && hasGrunt;
                        console.log('Checking typeless:', key, '= no-type:', hasNoType, 'no-decoy:', hasNoDecoy, 'has-grunt:', hasGrunt, 'result:', result);
                        return result;
                    } else if (memberId === 'Decoy') {
                        return key.includes('Decoy');
                    } else {
                        return key.includes(`${memberId}-type`);
                    }
                });
                    
                    console.log('Matching keys for', memberId, ':', matchingKeys);
                    
                    if (matchingKeys.length === 0) {
                        this.gruntHasBothGenders = false;
                        lineup = null;
                        console.log('No matching keys found!');
                    } else if (matchingKeys.length === 1) {
                        this.gruntHasBothGenders = false;
                        lineup = allGrunts[matchingKeys[0]];
                        lookupKey = matchingKeys[0];
                        console.log('Single match found:', lookupKey);
                    } else {
                        // Has both genders
                        this.gruntHasBothGenders = true;
                        const preferredKey = matchingKeys.find(k => k.includes(this.rocketGender === 'male' ? 'Male' : 'Female'));
                        lineup = allGrunts[preferredKey || matchingKeys[0]];
                        lookupKey = preferredKey || matchingKeys[0];
                        console.log('Multiple matches, using:', lookupKey);
                    }
                }
                
                console.log('Final lineup:', lineup);
                
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
            const possibleTypes = this.formatSlotTypes(lineup[slotKey]); 
            
            if (!possibleTypes || possibleTypes.length === 0) continue;
            
            // Get IDs of mons already chosen in previous slots (for exclusion)
            const usedSpamIds = spamWishlist.map(p => `${p.name}-${p.form}-${p.isShadow}-${p.level}`);
            const usedDamageIds = damageWishlist.map(p => `${p.name}-${p.form}-${p.isShadow}-${p.level}`);
            
            // SPAM WISHLIST for this slot
            const spamCandidates = [];
            
            for (const pokemon of this.app.pokemon) {
                if (this.isBattleOnlyForm(pokemon)) continue;
                if (!filters.special && pokemon.thirdMoveCost?.stardust === 100000) continue;
                
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
                                ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                    requiresXL: false,
                                    ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                    ivs: { attack: 15, defense: 15, stamina: 15 },
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
                if (!filters.special && pokemon.thirdMoveCost?.stardust === 100000) continue;
                
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
                            ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                requiresXL: false,
                                ivs: { attack: 15, defense: 15, stamina: 15 },
                                moveset: l40Score.moveset,
                                dpsSum: l40Score.dpsSum,
                                tdoSum: l40Score.tdoSum,
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
                            ivs: { attack: 15, defense: 15, stamina: 15 },
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
                                ivs: { attack: 15, defense: 15, stamina: 15 },
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
        
        // Store wishlist immediately with new structure
        this.rocketLists = { 
            wishlist: { 
                spam: spamWishlist, 
                damage: damageWishlist 
            },
            currentBest: { spam: [], damage: [] },
            toDo: { spam: [], damage: [] }
        };
        
        // Kick off async user Pokemon calculation
        this.calculateUserPokemonRocketLists(lineup, filters);
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
     * Calculate Current Best and Potential Best lists from user Pokemon for Raid battles
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
                    // Find base Pokemon data for filter checks (only for Potential Best)
                    const basePokemon = this.app.pokemon.find(p => 
                        p.name === userMon.name && 
                        (p.form === userMon.form || (!p.form && !userMon.form))
                    );
                    
                    if (!basePokemon) continue;
                    
                    // CURRENT BEST: Only use actual level (NO FILTERS)
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
                    
                    // Potential Best: Apply filters here
                    if (!filters.shadow && userMon.shadow) continue;
                    if (!filters.special && basePokemon.thirdMoveCost?.stardust === 100000) continue;
                    
                    // Potential Best: Add based on current level
                    if (userMon.assignedRaidTDO && userMon.assignedRaidTDO[defenderType]) {
                        // If below L40, show both L40 and L50
                        if (userMon.level < 40) {
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
                            
                            if (filters.xl) {
                                const l50Data = userMon.assignedRaidTDO[defenderType].L50;
                                
                                if (l50Data) {
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
                        // If L40-49, ALWAYS show current level, optionally show L50
                        else if (userMon.level < 50) {
                            // Current level using currentRaidTDO - ALWAYS SHOWN
                            const currentScore = this.calculateUserMonRaidScore(
                                userMon.currentRaidTDO,
                                defenderType
                            );
                            
                            if (currentScore) {
                                toDo.push({
                                    userMonId: userMon.id + '-current',
                                    name: userMon.name,
                                    form: userMon.form,
                                    nickname: userMon.nickname,
                                    isShadow: userMon.shadow,
                                    level: userMon.level,
                                    dps: currentScore.dps,
                                    tdo: currentScore.tdo,
                                    damageScore: currentScore.damageScore,
                                    surviveScore: currentScore.surviveScore,
                                    moveset: currentScore.moveset
                                });
                            }
                            
                            // L50 version - only if XL filter enabled
                            if (filters.xl) {
                                const l50Data = userMon.assignedRaidTDO[defenderType].L50;
                                
                                if (l50Data) {
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
                        // If L50, ALWAYS show L50 version
                        else {
                            const l50Data = userMon.assignedRaidTDO[defenderType].L50;
                            
                            if (l50Data) {
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
     * Get current filter states
     * @returns {Object} Filter states
     */
    getRaidFilters() {
        return this.pveFilters;
    }

    /**
     * Calculate heat map data for all type combos
     * @returns {Object} Heat map data with colors and values
     */
    calculateRaidHeatMap() {
        const POKEMON_TYPES = [
            'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
            'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
            'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'
        ];
        
        // Get current best list (sum of all 12 TDO)
        const currentBestTDOs = {};
        
        for (const type1 of POKEMON_TYPES) {
            for (const type2 of POKEMON_TYPES) {
                const index1 = POKEMON_TYPES.indexOf(type1);
                const index2 = POKEMON_TYPES.indexOf(type2);
                
                let defenderType;
                if (type1 === type2) {
                    defenderType = type1;
                } else if (index1 < index2) {
                    defenderType = type1 + '/' + type2;
                } else {
                    defenderType = type2 + '/' + type1;
                }
                
                // Sum TDO from current best survivability list for this type
                let totalTDO = 0;
                
                // Calculate current best for this specific type combo
                const dbRequest = indexedDB.open('PokemonGoDB');
                
                dbRequest.onsuccess = (event) => {
                    const db = event.target.result;
                    const tx = db.transaction(['userPokemon'], 'readonly');
                    const store = tx.objectStore('userPokemon');
                    const request = store.getAll();
                    
                    request.onsuccess = () => {
                        const userPokemon = request.result || [];
                        const candidates = [];
                        
                        for (const userMon of userPokemon) {
                            const score = this.calculateUserMonRaidScore(
                                userMon.currentRaidTDO,
                                defenderType
                            );
                            
                            if (score) {
                                candidates.push({
                                    tdo: score.tdo,
                                    surviveScore: score.surviveScore
                                });
                            }
                        }
                        
                        // Sort by survivability, take top 6
                        candidates.sort((a, b) => b.surviveScore - a.surviveScore);
                        const top6 = candidates.slice(0, 6);
                        
                        // Sum their TDO and double it (6 mon × 2 = 12)
                        totalTDO = top6.reduce((sum, mon) => sum + mon.tdo, 0) * 2;
                        
                        currentBestTDOs[defenderType] = totalTDO;
                    };
                };
            }
        }
        
        // Calculate min and max for scaling
        // Max: Best wishlist mon TDO × 12 (with all filters enabled)
        // Min: Worst current best survivability mon TDO × 12, or 0
        
        // ... rest of calculation
    }

    /**
     * Render heat map below raid lists
     * @returns {string} HTML string
     */
    renderRaidHeatMap() {
        const POKEMON_TYPES = [
            'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
            'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
            'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'
        ];
        
        const typeImages = {
            'NORMAL': 'POKEMON_TYPE_NORMAL.png',
            'FIGHTING': 'POKEMON_TYPE_FIGHTING.png',
            'FLYING': 'POKEMON_TYPE_FLYING.png',
            'POISON': 'POKEMON_TYPE_POISON.png',
            'GROUND': 'POKEMON_TYPE_GROUND.png',
            'ROCK': 'POKEMON_TYPE_ROCK.png',
            'BUG': 'POKEMON_TYPE_BUG.png',
            'GHOST': 'POKEMON_TYPE_GHOST.png',
            'STEEL': 'POKEMON_TYPE_STEEL.png',
            'FIRE': 'POKEMON_TYPE_FIRE.png',
            'WATER': 'POKEMON_TYPE_WATER.png',
            'GRASS': 'POKEMON_TYPE_GRASS.png',
            'ELECTRIC': 'POKEMON_TYPE_ELECTRIC.png',
            'PSYCHIC': 'POKEMON_TYPE_PSYCHIC.png',
            'ICE': 'POKEMON_TYPE_ICE.png',
            'DRAGON': 'POKEMON_TYPE_DRAGON.png',
            'DARK': 'POKEMON_TYPE_DARK.png',
            'FAIRY': 'POKEMON_TYPE_FAIRY.png'
        };
        
        return `
            <div class="bg-white/60 backdrop-blur-sm rounded-xl p-6 mt-6">
                <h3 class="text-white text-lg font-bold mb-4">Type Coverage Heat Map</h3>
                
                <div class="overflow-x-auto">
                    <div class="inline-block min-w-full">
                        <!-- Grid -->
                        <div class="grid" style="grid-template-columns: 40px repeat(18, 40px);">
                            <!-- Top-left corner (empty) -->
                            <div class="w-10 h-10"></div>
                            
                            <!-- Top row labels -->
                            ${POKEMON_TYPES.map(type => `
                                <div class="w-10 h-10 flex items-center justify-center">
                                    <img 
                                        src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Types/${typeImages[type]}"
                                        alt="${type}"
                                        class="w-8 h-8 rounded-full"
                                        title="${type.charAt(0) + type.slice(1).toLowerCase()}"
                                    />
                                </div>
                            `).join('')}
                            
                            <!-- Rows -->
                            ${POKEMON_TYPES.map((rowType, rowIndex) => `
                                <!-- Left label -->
                                <div class="w-10 h-10 flex items-center justify-center">
                                    <img 
                                        src="https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Images/Types/${typeImages[rowType]}"
                                        alt="${rowType}"
                                        class="w-8 h-8 rounded-full"
                                        title="${rowType.charAt(0) + rowType.slice(1).toLowerCase()}"
                                    />
                                </div>
                                
                                <!-- Cells -->
                                ${POKEMON_TYPES.map((colType, colIndex) => {
                                    const color = this.getHeatMapColor(rowType, colType);
                                    return `
                                        <button
                                            data-action="select-heatmap-type"
                                            data-type1="${rowType}"
                                            data-type2="${colType}"
                                            class="w-10 h-10 border border-white/20 transition-all hover:scale-110 hover:z-10 cursor-pointer"
                                            style="background-color: ${color};"
                                            title="${rowType} / ${colType}"
                                        ></button>
                                    `;
                                }).join('')}
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Legend -->
                <div class="mt-4 flex items-center justify-center gap-2">
                    <span class="text-white/60 text-sm">Weak</span>
                    <div class="flex gap-1">
                        <div class="w-8 h-4 rounded" style="background-color: #7DD3FC;"></div>
                        <div class="w-8 h-4 rounded" style="background-color: #22D3EE;"></div>
                        <div class="w-8 h-4 rounded" style="background-color: #10B981;"></div>
                        <div class="w-8 h-4 rounded" style="background-color: #EAB308;"></div>
                        <div class="w-8 h-4 rounded" style="background-color: #F97316;"></div>
                        <div class="w-8 h-4 rounded" style="background-color: #DC2626;"></div>
                    </div>
                    <span class="text-white/60 text-sm">Strong</span>
                </div>
            </div>
        `;
    }

    /**
     * Get heat map color for a type combo
     * @param {string} type1 - First type
     * @param {string} type2 - Second type
     * @returns {string} Hex color
     */
    getHeatMapColor(type1, type2) {
        // TODO: Calculate actual TDO and scale to color
        // For now, return placeholder
        const colors = [
            '#7DD3FC', // Light blue
            '#22D3EE', // Cyan
            '#10B981', // Green
            '#EAB308', // Yellow
            '#F97316', // Orange
            '#DC2626'  // Red
        ];
        
        // Placeholder: random color
        return colors[Math.floor(Math.random() * colors.length)];
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

        // Rocket member selection (leaders)
        document.querySelectorAll('[data-action="select-rocket-member"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.rocketMember = btn.dataset.member;
                if (this.rocketMember) {
                    this.calculateRocketWishlist();
                }
                this.app.render();
            });
        });

        // Grunt icon toggle (shows dropdown)
        document.querySelectorAll('[data-action="toggle-grunt-dropdown"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const gender = btn.dataset.gender;
                this.rocketGender = gender;
                // Set to generic grunt to show dropdown, but no specific type yet
                this.rocketMember = 'grunt:';
                this.app.render();
            });
        });

        // Grunt type selection from dropdown
        const gruntTypeSelect = document.querySelector('[data-action="select-grunt-type"]');
        if (gruntTypeSelect) {
            gruntTypeSelect.addEventListener('change', (e) => {
                this.rocketMember = e.target.value;
                if (this.rocketMember && this.rocketMember !== 'grunt:') {
                    this.calculateRocketWishlist();
                }
                this.app.render();
            });
        }

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

        // Wishlist detail panel
        document.querySelectorAll('[data-action="open-wishlist-detail"]').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const entryId = e.currentTarget.dataset.entryId;
                
                // Find the pokemon in the wishlist
                let pokemon = null;
                
                if (this.pveTab === 'raid') {
                    pokemon = [...this.raidLists.wishlist.damage, ...this.raidLists.wishlist.survivability]
                        .find(p => `${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}-${p.ivs.attack}-${p.ivs.defense}-${p.ivs.stamina}` === entryId);
                } else {
                    pokemon = [...this.rocketLists.wishlist.spam, ...this.rocketLists.wishlist.damage]
                        .find(p => `${p.name}-${p.form}-${p.isShadow}-${p.megaForm}-${p.level}-${p.ivs.attack}-${p.ivs.defense}-${p.ivs.stamina}` === entryId);
                }
                
                if (pokemon) {
                    this.openDetailPanel(pokemon);
                }
            });
        });

        // Close detail panel
        document.querySelectorAll('[data-action="close-detail-panel"]').forEach(elem => {
            elem.addEventListener('click', () => {
                this.closeDetailPanel();
            });
        });

        // Heat map cell selection
        document.querySelectorAll('[data-action="select-heatmap-type"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type1 = btn.dataset.type1;
                const type2 = btn.dataset.type2;
                
                this.raidDefenderType1 = type1;
                this.raidDefenderType2 = type2;
                this.calculateRaidWishlist();
                this.app.render();
            });
        });
    }
}