// ====================================
// catchReport.js - CATCH REPORT MODULE
// ====================================

class CatchReport {
    constructor(app) {
        this.app = app;
        this.currentQueue = [];
        this.currentMon = null;
        this.cpm = [0.094, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159, 0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];
        this.viabilityThreshold = 75; // Default threshold
    }

    // ====================================
    // QUEUE MANAGEMENT
    // ====================================
    
    async startQueue() {
        try {
            // Open the database
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            const db = await new Promise((resolve, reject) => {
                dbRequest.onsuccess = () => resolve(dbRequest.result);
                dbRequest.onerror = () => reject(dbRequest.error);
            });
            
            const tx = db.transaction(['userPokemon'], 'readonly');
            const store = tx.objectStore('userPokemon');
            
            const allPokemon = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            this.currentQueue = allPokemon.filter(mon => mon.inQueue);
            
            console.log('Queue loaded:', this.currentQueue.length, 'Pokemon');
            
            if (this.currentQueue.length > 0) {
                this.showNextInQueue();
            } else {
                this.showEmptyQueueMessage();
            }
        } catch (error) {
            console.error('Error loading queue:', error);
            this.showError('Failed to load Pokemon queue: ' + error.message);
        }
    }
    
    showNextInQueue() {
        if (this.currentQueue.length === 0) {
            this.showQueueCompleteModal();
            return;
        }
        
        this.currentMon = this.currentQueue.shift();
        this.showReport(this.currentMon);
    }
    
    showEmptyQueueMessage() {
        const message = document.createElement('div');
        message.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        message.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center">
                <p class="text-xl text-gray-600">No Pokémon in queue</p>
                <button class="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg" onclick="this.closest('div').remove()">
                    OK
                </button>
            </div>
        `;
        document.body.appendChild(message);
    }
    
    showQueueCompleteModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.setAttribute('data-modal', 'queue-complete');
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center space-y-4">
                <div class="text-green-500">
                    <i class="fa-solid fa-check-circle text-6xl mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800">Queue Complete!</h2>
                </div>
                <p class="text-gray-600">All Pokémon have been analyzed</p>
                <button class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition" data-action="close-queue-modal">
                    Done
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listener
        modal.querySelector('[data-action="close-queue-modal"]').addEventListener('click', () => {
            modal.remove();
            // Re-render the collection
            this.app.render();
        });
    }

    // ====================================
    // MAIN REPORT DISPLAY
    // ====================================
    
    async showReport(userMon) {
        // Get Pokemon data from database
        const pokemon = await this.getPokemonData(userMon.name, userMon.form);
        if (!pokemon) {
            this.showError('Pokémon not found in database');
            return;
        }
        
        // Calculate roles
        const pvpRoles = await this.calculatePvPRoles(userMon, pokemon);
        
        // Build UI
        const reportHtml = `
            <div class="fixed inset-0 bg-gray-100 z-50 overflow-y-auto" data-modal="catch-report">
                <!-- Header with sprite and basic info -->
                <div class="bg-white shadow-md p-4 sticky top-0 z-10">
                    <div class="max-w-4xl mx-auto flex items-center gap-4">
                        ${userMon.screenshot ? `<img src="${userMon.screenshot}" class="w-20 h-20 object-contain">` : ''}
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold">${userMon.name}${userMon.form ? ` (${userMon.form})` : ''}</h1>
                            <p class="text-gray-600">CP ${userMon.cp} • Level ${userMon.level || '?'} • ${userMon.ivs.attack}/${userMon.ivs.defense}/${userMon.ivs.stamina}</p>
                        </div>
                        <button class="text-2xl text-gray-500 hover:text-gray-700" data-action="close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="max-w-4xl mx-auto p-4 space-y-4">
                    <!-- Row 1: Stats & Cost to Level -->
                    <div class="bg-white rounded-xl p-6 shadow">
                        <h2 class="text-xl font-bold mb-4">Stats & Power Up Costs</h2>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-600">Weak To:</p>
                                <p class="font-semibold">${this.getWeakTo(pokemon)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Can Threaten:</p>
                                <p class="font-semibold">${this.getCanThreaten(pokemon)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Max CP (Level 40):</p>
                                <p class="font-semibold">${this.calculateMaxCP(pokemon, userMon.ivs, 40)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600">Max CP (Level 50):</p>
                                <p class="font-semibold">${this.calculateMaxCP(pokemon, userMon.ivs, 50)}</p>
                            </div>
                        </div>
                        <div class="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p class="text-sm text-gray-600 mb-2">Cost to Level Widget (Coming Soon)</p>
                            <p class="text-xs text-gray-500">Will show power-up costs to any level or selected league CP cap</p>
                        </div>
                    </div>
                    
                    <!-- Row 2: Moves -->
                    <div class="bg-white rounded-xl p-6 shadow">
                        <h2 class="text-xl font-bold mb-4">Moves</h2>
                        <div class="space-y-3">
                            <div>
                                <p class="text-sm text-gray-600 mb-1">Fast Move:</p>
                                <p class="font-semibold">${userMon.currentMoveset?.fast || 'Unknown'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 mb-1">Charge Moves:</p>
                                <p class="font-semibold">
                                    ${userMon.currentMoveset?.charge1 || 'Unknown'}
                                    ${userMon.currentMoveset?.charge2 ? ` • ${userMon.currentMoveset.charge2}` : ''}
                                </p>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">Move stats and selection coming soon</p>
                        </div>
                    </div>
                    
                    <!-- Row 3: PvP Roles -->
                    <div class="bg-white rounded-xl p-6 shadow">
                        <h2 class="text-xl font-bold mb-4">PvP Roles</h2>
                        ${pvpRoles.length > 0 ? this.renderPvPRoles(pvpRoles) : '<p class="text-gray-500">No viable PvP roles found (threshold: ${this.viabilityThreshold}%)</p>'}
                    </div>
                    
                    <!-- Row 4: PvE Roles -->
                    <div class="bg-white rounded-xl p-6 shadow">
                        <h2 class="text-xl font-bold mb-4">PvE Roles</h2>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="p-4 bg-gray-50 rounded-lg text-center">
                                <p class="font-semibold mb-2">Gym/Raid</p>
                                <p class="text-xs text-gray-500">Coming Soon</p>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg text-center">
                                <p class="font-semibold mb-2">Rocket Grunts</p>
                                <p class="text-xs text-gray-500">Coming Soon</p>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg text-center">
                                <p class="font-semibold mb-2">Rocket Leaders</p>
                                <p class="text-xs text-gray-500">Coming Soon</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Decision Buttons -->
                    <div class="grid grid-cols-3 gap-4 sticky bottom-0 bg-gray-100 py-4">
                        <button class="bg-red-500 text-white rounded-xl py-4 hover:bg-red-600 transition font-semibold" data-action="toss">
                            <i class="fa-solid fa-trash mr-2"></i>Toss
                        </button>
                        <button class="bg-yellow-500 text-white rounded-xl py-4 hover:bg-yellow-600 transition font-semibold" data-action="skip">
                            <i class="fa-solid fa-forward mr-2"></i>Skip
                        </button>
                        <button class="bg-green-500 text-white rounded-xl py-4 hover:bg-green-600 transition font-semibold" data-action="keep">
                            <i class="fa-solid fa-check mr-2"></i>Keep
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', reportHtml);
        this.attachEventListeners();
    }
    
    renderPvPRoles(roles) {
        return `
            <div class="space-y-3">
                ${roles.map(role => `
                    <div class="p-4 border-2 rounded-lg hover:border-blue-500 cursor-pointer transition" data-role="${role.id}">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-bold text-lg">${role.formName}${role.form ? ` (${role.form})` : ''} - ${role.leagueName}</p>
                                <p class="text-sm text-gray-600">IV Efficiency: ${role.ivEfficiency}%</p>
                            </div>
                            ${role.requiresXL ? '<span class="bg-purple-500 text-white px-3 py-1 rounded-full text-sm">XL</span>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ====================================
    // CALCULATION FUNCTIONS
    // ====================================
    
    async getPokemonData(name, form) {
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['pokemon'], 'readonly');
                const store = tx.objectStore('pokemon');
                
                const id = form ? `${name}-${form}` : `${name}-base`;
                
                console.log('Looking for Pokemon with ID:', id);  // ADD THIS
                
                const request = store.get(id);
                request.onsuccess = () => {
                    console.log('Found Pokemon:', request.result);  // ADD THIS
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }
    
    async calculatePvPRoles(userMon, pokemon) {
        const roles = [];
        const leagues = [
            { name: 'Little League', cpLimit: 500, prop: 'little' },
            { name: 'Great League', cpLimit: 1500, prop: 'great' },
            { name: 'Ultra League', cpLimit: 2500, prop: 'ultra' }
        ];
        
        for (const league of leagues) {
            if (!pokemon[league.prop]) continue;
            
            const optimal = pokemon[league.prop];
            const ivEfficiency = this.calculateIVEfficiency(userMon, optimal);
            
            if (ivEfficiency >= this.viabilityThreshold) {
                roles.push({
                    id: `${pokemon.name}-${league.prop}`,
                    formName: pokemon.name,
                    form: pokemon.form,
                    leagueName: league.name,
                    ivEfficiency: ivEfficiency,
                    requiresXL: optimal.level > 40
                });
            }
        }
        
        // Sort by IV efficiency descending
        roles.sort((a, b) => b.ivEfficiency - a.ivEfficiency);
        
        return roles;
    }
    
    calculateIVEfficiency(userMon, optimal) {
        // Calculate stat product for user's IVs
        const userSP = this.getStatProduct(userMon.ivs, userMon.level || optimal.level);
        const optimalSP = optimal.maxSP;
        
        return Math.round((userSP / optimalSP) * 100 * 10) / 10;
    }
    
    getStatProduct(ivs, level) {
        // Placeholder - needs base stats
        return 1000000; // Temporary
    }
    
    calculateMaxCP(pokemon, ivs, level) {
        const cpmIndex = Math.round((level - 1) * 2);
        const cpmValue = this.cpm[cpmIndex];
        
        // FIX: Use pokemon.stats instead of direct properties
        const totalAtk = pokemon.stats.attack + ivs.attack;
        const totalDef = pokemon.stats.defense + ivs.defense;
        const totalSta = pokemon.stats.hp + ivs.stamina;  // Note: hp not stamina
        
        return Math.max(10, Math.floor(
            totalAtk * Math.sqrt(totalDef) * Math.sqrt(totalSta) * cpmValue * cpmValue / 10
        ));
    }
    
    getWeakTo(pokemon) {
        // Placeholder - needs type chart
        return pokemon.types?.join(', ') || 'Unknown';
    }
    
    getCanThreaten(pokemon) {
        // Placeholder - needs move analysis
        return 'Coming Soon';
    }

    // ====================================
    // EVENT HANDLERS
    // ====================================
    
    attachEventListeners() {
        const modal = document.querySelector('[data-modal="catch-report"]');
        
        modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            if (confirm('Exit catch report? Pokémon will remain in queue.')) {
                modal.remove();
            }
        });
        
        modal.querySelector('[data-action="toss"]').addEventListener('click', () => {
            this.handleToss();
        });
        
        modal.querySelector('[data-action="skip"]').addEventListener('click', () => {
            this.handleSkip();
        });
        
        modal.querySelector('[data-action="keep"]').addEventListener('click', () => {
            this.handleKeep();
        });
    }
    
    async handleToss() {
        if (!confirm('Delete this Pokémon permanently?')) return;
        
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                const request = store.delete(this.currentMon.id);
                
                tx.oncomplete = () => {
                    document.querySelectorAll('[data-modal="catch-report"]').forEach(m => m.remove());
                    this.showNextInQueue();
                    resolve();
                };
                
                tx.onerror = () => reject(tx.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    
    async handleSkip() {
        // Add back to end of queue
        this.currentQueue.push(this.currentMon);
        
        document.querySelector('[data-modal="catch-report"]').remove();
        this.showNextInQueue();
    }
    
    async handleKeep() {
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                this.currentMon.inQueue = false;
                
                const request = store.put(this.currentMon);
                
                tx.oncomplete = () => {
                    document.querySelectorAll('[data-modal="catch-report"]').forEach(m => m.remove());
                    this.showNextInQueue();
                    resolve();
                };
                
                tx.onerror = () => reject(tx.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }
    
    showError(message) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-6 text-center">
                <i class="fa-solid fa-exclamation-circle text-red-500 text-5xl mb-3"></i>
                <h2 class="text-xl font-bold mb-2">Error</h2>
                <p class="text-gray-600">${message}</p>
                <button class="mt-4 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300" onclick="this.closest('div').remove()">
                    Close
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}