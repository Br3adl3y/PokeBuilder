// ====================================
// POKEMON SELECTION & NAVIGATION
// ====================================

function selectPokemon(pokemon) {
    const forms = this.getPokemonForms(pokemon.dexNumber);
    const baseForm = forms.find(f => !f.form || f.form === '');
    this.selectedPokemon = pokemon;
    this.selectedForm = baseForm || forms[0];
    this.expandedSections = {};
    this.moveMode = 'pvp';
    this.showTagInput = false;
    this.render();
}

function selectForm(formId) {
    this.selectedForm = this.pokemon.find(p => p.id === formId);
    this.expandedSections = {};
    this.render();
}

function navigatePokemon(direction) {
    const currentDex = (this.selectedForm || this.selectedPokemon).dexNumber;
    const newDex = currentDex + direction;
    const newPokemon = this.pokemon.find(p => p.dexNumber === newDex);
    if (newPokemon) {
        selectPokemon.call(this, newPokemon);
    }
}

function getPokemonForms(dexNumber) {
    return this.pokemon.filter(p => p.dexNumber === dexNumber);
}

// ====================================
// EVOLUTION CHAIN LOGIC
// ====================================

function getEvolutionChain(pokemon) {
    // Step 1: Find the base form (walk backwards)
    let base = pokemon;
    const visited = new Set();
    
    while (true) {
        const preEvo = this.pokemon.find(p => 
            p.evolutions && p.evolutions.some(evo => 
                evo.name === base.name && (evo.form || '') === (base.form || '')
            )
        );
        
        if (!preEvo || visited.has(preEvo.id)) break;
        visited.add(preEvo.id);
        base = preEvo;
    }
    
    // Step 2: Build FULL tree from base (recursively explore all branches)
    const buildFullTree = (current, depth = 0) => {
        if (depth > 5) return null; // Prevent infinite loops
        
        if (!current.evolutions || current.evolutions.length === 0) {
            // Leaf node - no evolutions
            return {
                pokemon: current,
                evolutions: []
            };
        }
        
        // Return current pokemon with all evolution branches explored
        return {
            pokemon: current,
            evolutions: current.evolutions.map(evo => {
                const evoPokemon = this.pokemon.find(p => 
                    p.name === evo.name && (p.form || '') === (evo.form || '')
                );
                
                if (!evoPokemon) return null;
                
                return {
                    candyCost: evo.candyCost,
                    evolveRequirement: evo.evolveRequirement,
                    branch: buildFullTree(evoPokemon, depth + 1)
                };
            }).filter(e => e !== null)
        };
    };
    
    return buildFullTree(base);
}

async function renderEvolutionChain(tree) {
    if (!tree) return '';
    
    const result = [];
    const visited = new Set();
    
    const addToChain = (node, candyCost = null, evolveRequirement = null) => {
        if (visited.has(node.pokemon.id)) return;
        visited.add(node.pokemon.id);
        
        result.push({
            pokemon: node.pokemon,
            candyCost: candyCost,
            evolveRequirement: evolveRequirement
        });
        
        if (node.evolutions && node.evolutions.length > 0) {
            node.evolutions.forEach(evo => {
                addToChain(evo.branch, evo.candyCost, evo.evolveRequirement);
            });
        }
    };
    
    addToChain(tree);
    
    // Fetch all sprite IDs
    const items = await Promise.all(result.map(async (item) => {
        const spriteId = await getShowdownSpriteId(item.pokemon);
        const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${spriteId}.gif`;
        
        return {
            ...item,
            sprite
        };
    }));
    
    return items.map((item) => {
        return `
            <div class="flex items-center gap-2 mb-3">
                <img src="${item.sprite}" class="pokemon-sprite h-16 cursor-pointer hover:scale-110 transition flex-shrink-0" style="image-rendering: pixelated;" data-pokemon-dex="${item.pokemon.dexNumber}">
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-gray-700 font-medium truncate">${item.pokemon.name}</div>
                    ${item.candyCost ? `<div class="text-xs text-gray-500">${item.candyCost} 🍬</div>` : ''}
                    ${item.evolveRequirement ? `<div class="text-xs text-gray-400 italic mt-1 truncate">${item.evolveRequirement}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ====================================
// POKEMON CARD RENDERING
// ====================================

function renderPokemonCard(forms) {
    const basePokemon = forms[0];
    const tags = this.userTags[basePokemon.id] || [];
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${basePokemon.dexNumber}.png`;
    
    return `
        <div class="rounded-2xl p-4 shadow-lg" data-pokemon-id="${basePokemon.id}">
            <div class="text-center">
                <img src="${spriteUrl}" alt="${basePokemon.name}" class="pokemon-sprite w-24 h-24 mx-auto mb-2">
                <div class="text-teal-600 text-xs font-medium">#${String(basePokemon.dexNumber).padStart(4, '0')}</div>
                <div class="flex items-center justify-center gap-1 mb-2">
                    <span class="text-gray-800 font-semibold text-sm">${basePokemon.name}</span>
                    ${basePokemon.types.map(type => 
                        `<span class="type-circle" style="background-color: ${TYPE_COLORS[type]}" title="${type}"></span>`
                    ).join('')}
                </div>
            </div>
            
            ${tags.length > 0 ? `
                <div class="flex gap-1 flex-wrap justify-center mt-2">
                    ${tags.map(tag => 
                        `<span class="text-xs px-2 py-1 rounded-full bg-purple-200 text-purple-800">${tag}</span>`
                    ).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// ====================================
// POKEMON DETAIL PAGE
// ====================================

async function renderPokemonDetail() {
    const p = this.selectedForm || this.selectedPokemon;
    const forms = this.getPokemonForms(p.dexNumber);
    const tags = this.userTags[p.id] || [];
    const spriteId = await getShowdownSpriteId(p);
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${spriteId}.gif`;                
    const chain = getEvolutionChain.call(this, p);
    const isSingleType = p.types.length === 1;
    const typeBgClass = `type-bg-${p.types[0].toLowerCase()}`;

    // Get all Pokemon in evolution chain for IV buttons (deduplicated)
    const getAllChainPokemon = (tree) => {
        if (!tree) return [];
        const result = [];
        const visited = new Set();
        
        const traverse = (node) => {
            if (visited.has(node.pokemon.id)) return;
            visited.add(node.pokemon.id);
            result.push(node.pokemon);
            
            if (node.evolutions && node.evolutions.length > 0) {
                node.evolutions.forEach(evo => traverse(evo.branch));
            }
        };
        
        traverse(tree);
        return result;
    };
    
    const chainPokemon = chain ? getAllChainPokemon(chain) : [];

    return `
        <div class="min-h-screen pokedex-bg p-4 py-8" data-detail-container>
            <div class="detail-container rounded-3xl mx-auto"
                
                <!-- ROW 1: 2/3 sprite + 1/3 evolution -->
                <div class="detail-row-1 mb-4">
                    
                    <!-- LEFT: Sprite (2/3 width) -->
                    <div class="sprite-container relative bg-white/30 rounded-xl flex items-center justify-center" style="height: clamp(250px, 50vw, 400px);">
                        <div class="${typeBgClass}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
                        <img src="${spriteUrl}" alt="${p.name}" class="w-1/2 h-1/2 object-contain mx-auto relative z-10">
                        
                        <!-- Name/Type overlaid at BOTTOM -->
                        <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-white/90 to-transparent z-10">
                            <div class="text-gray-500 text-xs mb-1">#${String(p.dexNumber).padStart(4, '0')}</div>
                            
                            <div class="flex items-end gap-2 flex-wrap">
                                <h1 class="text-2xl md:text-4xl font-bold text-gray-800 leading-none">${p.name.toUpperCase()}</h1>
                                <div class="flex gap-1 pb-1">
                                    ${p.types.map(type => 
                                        `<span class="type-badge px-2 md:px-4 py-1 md:py-2 rounded-full text-white font-semibold uppercase text-xs md:text-sm" style="background-color: ${TYPE_COLORS[type]}">${type}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <!-- Form Selector -->
                            ${forms.length > 1 ? `
                                <select data-action="change-form" class="mt-2 px-3 py-1 text-xs rounded-full bg-white border border-gray-300 shadow-sm w-fit">
                                    ${forms.map(f => `<option value="${f.id}" ${f.id === p.id ? 'selected' : ''}>${f.form || 'Base Form'}</option>`).join('')}
                                </select>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- RIGHT: Evolution (1/3 width) -->
                    <div class="evolution-container bg-white rounded-xl p-3 shadow flex flex-col" style="height: clamp(250px, 50vw, 400px);">
                        <div class="text-xs md:text-sm font-semibold text-gray-600 mb-2">Evolution</div>
                        <div class="evolution-scroll flex-1">
                            ${chain ? await renderEvolutionChain.call(this, chain) : '<div class="text-xs text-gray-400">No evolutions</div>'}
                        </div>
                    </div>
                </div>

                <!-- ROW 2: Base Stats (2/9) | Max CP (2/9) | Future data (2/9) | IV Buttons (3/9 = 1/3) -->
                <div class="detail-row-2 mb-4">
                    
                    <!-- Base Stats (2/9) -->
                    <div class="stats-container bg-white rounded-xl p-3 shadow">
                        <div class="text-xs md:text-sm font-semibold text-gray-600 mb-2">Base Stats</div>
                        <div class="space-y-1 text-xs md:text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-600">ATK</span>
                                <span class="text-red-500 font-bold">${p.stats.attack}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">DEF</span>
                                <span class="text-blue-500 font-bold">${p.stats.defense}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">HP</span>
                                <span class="text-green-500 font-bold">${p.stats.hp}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Max CP (2/9) -->
                    <div class="maxcp-container bg-white rounded-xl p-3 shadow">
                        <div class="text-xs md:text-sm font-semibold text-gray-600 mb-2">max cp</div>
                        <div class="text-xl md:text-2xl font-bold">${p.maxCP || 'TBD'}</div>
                        
                        ${p.thirdMoveCost ? `
                            <div class="mt-2">
                                <div class="text-xs text-gray-500 mb-1">2nd Charge Move</div>
                                <div class="text-xs md:text-sm">${p.thirdMoveCost.candy} 🍬 + ${(p.thirdMoveCost.stardust / 1000).toFixed(0)}k ⭐</div>
                            </div>
                        ` : ''}
                        
                        ${p.shadowInfo ? `
                            <div class="mt-2">
                                <div class="text-xs text-gray-500 mb-1">Purification</div>
                                <div class="text-xs md:text-sm">${p.shadowInfo.purificationCandy} 🍬 + ${(p.shadowInfo.purificationStardust / 1000).toFixed(0)}k ⭐</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Future data (2/9) -->
                    <div class="bg-white rounded-xl p-3 shadow flex items-center justify-center text-gray-400 text-xs md:text-sm border-2 border-dashed border-gray-300">
                        Future data
                    </div>
                    
                    <!-- IV Buttons (3/9 = 1/3) -->
                    <div class="iv-container bg-white rounded-xl p-2 md:p-3 shadow overflow-hidden flex flex-col">
                        <div class="iv-scroll flex-1 space-y-2">
                            ${chainPokemon.map(mon => `
                                <div class="iv-row">
                                    <span class="iv-name text-xs md:text-sm text-gray-700 font-medium truncate">${mon.name}</span>
                                    <div class="iv-buttons">
                                        <button class="iv-btn px-2 py-1 rounded-full bg-yellow-300 text-yellow-900 font-semibold hover:bg-yellow-400 transition text-xs" data-action="iv-spread" data-league="little" data-pokemon="${mon.id}"><span class="sm:inline hidden">Little</span><span class="sm:hidden">L</span></button>

                                        <button class="iv-btn px-2 py-1 rounded-full bg-cyan-400 text-cyan-900 font-semibold hover:bg-cyan-500 transition text-xs" data-action="iv-spread" data-league="great" data-pokemon="${mon.id}"><span class="sm:inline hidden">Great</span><span class="sm:hidden">G</span></button>

                                        <button class="iv-btn px-2 py-1 rounded-full bg-purple-500 text-white font-semibold hover:bg-purple-600 transition text-xs" data-action="iv-spread" data-league="ultra" data-pokemon="${mon.id}"><span class="sm:inline hidden">Ultra</span><span class="sm:hidden">U</span></button>                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Moves Section -->
                ${renderMovesSection.call(this, p)}

                <!-- Tags -->
                <div class="mt-6">
                    <div class="flex items-center gap-3 mb-2 flex-wrap">
                        ${tags.length > 0 ? tags.map(tag => 
                            `<span class="px-3 py-1 rounded-full bg-purple-500 text-white text-sm flex items-center gap-2">
                                ${tag}
                                <button data-action="remove-tag" data-tag="${tag}" class="hover:text-red-200">
                                    <i class="fa-solid fa-xmark text-xs"></i>
                                </button>
                            </span>`
                        ).join('') : ''}
                        
                        <button data-action="show-tag-input" class="text-purple-500 hover:text-purple-600">
                            <i class="fa-solid fa-tag text-xl"></i>
                        </button>
                    </div>
                    
                    ${this.showTagInput ? `
                        <div class="flex gap-2">
                            <input
                                type="text"
                                data-action="tag-input"
                                placeholder="Add a tag..."
                                class="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                data-action="add-tag"
                                class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                            >
                                Add
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Close FAB -->
            <button class="fab-button fab-center bg-gray-600 text-white" data-action="close-detail">
                <i class="fa-solid fa-xmark text-xl"></i>
            </button>
        </div>
    `;
}

// ====================================
// POKEMON EVENT LISTENERS
// ====================================

function attachPokemonEventListeners() {
    const closeBtn = document.querySelector('[data-action="close-detail"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            this.selectedPokemon = null;
            this.selectedForm = null;
            this.render();
        });
    }

    const changeFormSelect = document.querySelector('[data-action="change-form"]');
    if (changeFormSelect) {
        changeFormSelect.addEventListener('change', (e) => {
            selectForm.call(this, e.target.value);
        });
    }

    // Evolution sprites click
    document.querySelectorAll('[data-pokemon-dex]').forEach(sprite => {
        sprite.addEventListener('click', () => {
            const dexNumber = parseInt(sprite.dataset.pokemonDex);
            const pokemon = this.pokemon.find(p => p.dexNumber === dexNumber);
            if (pokemon) selectPokemon.call(this, pokemon);
        });
    });
}

// ====================================
// MOVE SELECTION & MANAGEMENT
// ====================================

function selectMove(move) {
    this.selectedMove = move;
    this.showTagInput = false;
    this.render();
}

function toggleMoveSection(section) {
    if (section === 'fast') {
        this.expandedSections.fast = !this.expandedSections.fast;
        this.expandedSections.charge = false;
    } else {
        this.expandedSections.charge = !this.expandedSections.charge;
        this.expandedSections.fast = false;
    }
    this.render();
}

function setMoveMode(mode) {
    this.moveMode = mode;
    this.render();
}

function getPokemonThatLearnMove(moveName, category) {
    return this.pokemon.filter(p => 
        p.moves[category].includes(moveName) ||
        p.moves[`${category}Elite`].includes(moveName)
    );
}

// ====================================
// MOVE LIST RENDERING (Pokedex View)
// ====================================

function renderMoveList(category) {
    const moves = this.getFilteredMoves(category);
    return moves.map(m => renderMoveListItem.call(this, m, this.expandedMoves[m.id])).join('');
}

function renderMoveListItem(move, isExpanded) {
    const tags = this.moveTags[move.id] || [];
    const stats = move.category === 'fast' 
        ? `DPT: ${formatNumber(move.dpt)} / EPT: ${formatNumber(move.ept)}`
        : `DPE: ${formatNumber(move.dpe)} / Energy: ${move.energy}`;

    return `
        <div class="move-list-item rounded-xl p-4 mb-3 shadow-md ${isExpanded ? 'expanded' : ''}" 
             data-move-id="${move.id}">
            <div class="flex items-center justify-between cursor-pointer" data-toggle-move="${move.id}">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800">${move.name}</div>
                    <div class="text-xs text-gray-600 mt-1">
                        <span class="type-badge" style="background-color: ${TYPE_COLORS[move.type]}">${move.type}</span>
                        <span class="ml-2">${stats}</span>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400"></i>
            </div>
            
            ${isExpanded ? `
                <div class="mt-3 pt-3 border-t border-gray-200 space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Power:</span>
                        <span class="font-medium">${move.power}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Energy:</span>
                        <span class="font-medium">${move.category === 'fast' ? '+' : ''}${move.energy}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Duration:</span>
                        <span class="font-medium">${move.duration}${this.moveMode === 'pve' ? 's' : 't'}</span>
                    </div>
                    ${move.buffs?.activationChance > 0 ? `
                        <div class="mt-2 pt-2 border-t border-gray-200">
                            <div class="font-medium mb-1">Buffs (${formatNumber(move.buffs.activationChance * 100)}%)</div>
                            ${move.buffs.attackerAttackPercent !== 0 ? `<div>Atk: ${move.buffs.attackerAttackPercent > 0 ? '+' : ''}${move.buffs.attackerAttackPercent}</div>` : ''}
                            ${move.buffs.attackerDefensePercent !== 0 ? `<div>Def: ${move.buffs.attackerDefensePercent > 0 ? '+' : ''}${move.buffs.attackerDefensePercent}</div>` : ''}
                        </div>
                    ` : ''}
                    
                    ${tags.length > 0 ? `
                        <div class="flex gap-1 flex-wrap mt-2">
                            ${tags.map(tag => 
                                `<span class="text-xs px-2 py-1 rounded-full bg-purple-200 text-purple-800">${tag}</span>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

// ====================================
// MOVE CARDS (Pokemon Detail Page)
// ====================================

function renderMovesSection(p) {
    const fastExpanded = this.expandedSections.fast;
    const chargeExpanded = this.expandedSections.charge;

    return `
        <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-gray-800 text-lg cursor-pointer" data-action="toggle-section" data-section="fast">Fast Moves</h3>
                <div class="flex items-center gap-2">
                    <div class="text-xs text-gray-600">${this.moveMode === 'pvp' ? 'PvP' : 'PvE'}</div>
                    <div class="ios-toggle ${this.moveMode === 'pvp' ? 'active' : ''}" data-action="toggle-mode"></div>
                </div>
            </div>
            <div class="horizontal-scroll flex gap-3 pb-2">
                ${[...p.moves.fast, ...p.moves.fastElite].map(moveName => {
                    const isElite = p.moves.fastElite.includes(moveName);
                    return renderMoveCard.call(this, moveName, 'fast', isElite, fastExpanded);
                }).join('')}
            </div>
        </div>

        <div class="mb-6">
            <h3 class="font-semibold text-gray-800 text-lg mb-3 cursor-pointer" data-action="toggle-section" data-section="charge">Charge Moves</h3>
            <div class="horizontal-scroll flex gap-3 pb-2">
                ${[...p.moves.charge, ...p.moves.chargeElite].map(moveName => {
                    const isElite = p.moves.chargeElite.includes(moveName);
                    return renderMoveCard.call(this, moveName, 'charge', isElite, chargeExpanded);
                }).join('')}
            </div>
        </div>
    `;
}

function renderMoveCard(moveName, category, isElite, isExpanded) {
    const moveData = this.getMoveDetails(moveName, category, this.moveMode);
    if (!moveData) return '';

    const eliteClass = isElite ? 'elite-move' : '';
    const borderColor = TYPE_COLORS[moveData.type];

    return `
        <div class="move-card ${eliteClass} rounded-xl p-3 shadow-md ${isExpanded ? 'expanded' : ''}" 
             style="border: 2px solid ${borderColor}"
             data-move-name="${moveName}"
             data-move-category="${category}">
            <div class="flex items-center justify-between mb-2">
                <span class="font-semibold text-gray-800 text-sm">${moveName}</span>
                ${isElite ? '<span class="text-xs bg-purple-600 text-white px-2 py-1 rounded font-bold">ELITE</span>' : ''}
            </div>
            
            <div class="text-xs mb-2">
                <span class="type-badge" style="background-color: ${TYPE_COLORS[moveData.type]}">${moveData.type}</span>
            </div>
            
            ${!isExpanded ? `
                <div class="text-xs space-y-1">
                    ${category === 'fast' ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">DPT / EPT:</span>
                            <span class="font-medium">${formatNumber(moveData.dpt)} / ${formatNumber(moveData.ept)}</span>
                        </div>
                    ` : `
                        <div class="flex justify-between">
                            <span class="text-gray-600">DPE:</span>
                            <span class="font-medium">${formatNumber(moveData.dpe)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Energy:</span>
                            <span class="font-medium">${moveData.energy}</span>
                        </div>
                    `}
                </div>
            ` : `
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Power:</span>
                        <span class="font-medium">${moveData.power}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Energy:</span>
                        <span class="font-medium">${category === 'fast' ? '+' : ''}${moveData.energy}</span>
                    </div>
                    ${this.moveMode === 'pve' || category === 'fast' ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">Duration:</span>
                            <span class="font-medium">${moveData.duration}${this.moveMode === 'pve' ? 's' : 't'}</span>
                        </div>
                    ` : ''}
                    ${moveData.dpt !== undefined ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">DPT:</span>
                            <span class="font-medium">${formatNumber(moveData.dpt)}</span>
                        </div>
                    ` : ''}
                    ${moveData.ept !== undefined ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">EPT:</span>
                            <span class="font-medium">${formatNumber(moveData.ept)}</span>
                        </div>
                    ` : ''}
                    ${moveData.dpe !== undefined ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">DPE:</span>
                            <span class="font-medium">${formatNumber(moveData.dpe)}</span>
                        </div>
                    ` : ''}
                    ${moveData.dps !== undefined ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">DPS:</span>
                            <span class="font-medium">${formatNumber(moveData.dps)}</span>
                        </div>
                    ` : ''}
                    ${moveData.eps !== undefined ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">EPS:</span>
                            <span class="font-medium">${formatNumber(moveData.eps)}</span>
                        </div>
                    ` : ''}
                    ${moveData.buffs?.activationChance > 0 ? `
                        <div class="mt-2 pt-2 border-t border-gray-300">
                            <div class="font-medium mb-1">Buffs (${formatNumber(moveData.buffs.activationChance * 100)}%)</div>
                            ${moveData.buffs.attackerAttackPercent !== 0 ? `<div>Atk: ${moveData.buffs.attackerAttackPercent > 0 ? '+' : ''}${moveData.buffs.attackerAttackPercent}</div>` : ''}
                            ${moveData.buffs.attackerDefensePercent !== 0 ? `<div>Def: ${moveData.buffs.attackerDefensePercent > 0 ? '+' : ''}${moveData.buffs.attackerDefensePercent}</div>` : ''}
                            ${moveData.buffs.targetAttackPercent !== 0 ? `<div>Opp Atk: ${moveData.buffs.targetAttackPercent > 0 ? '+' : ''}${moveData.buffs.targetAttackPercent}</div>` : ''}
                            ${moveData.buffs.targetDefensePercent !== 0 ? `<div>Opp Def: ${moveData.buffs.targetDefensePercent > 0 ? '+' : ''}${moveData.buffs.targetDefensePercent}</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            `}
        </div>
    `;
}

// ====================================
// MOVE DETAIL PAGE
// ====================================

function renderMoveDetail() {
    const m = this.selectedMove;
    const learners = getPokemonThatLearnMove.call(this, m.name, m.category);
    const tags = this.moveTags[m.id] || [];

    return `
        <div class="min-h-screen pokedex-bg p-4 py-8">
            <div class="rounded-3xl p-6 shadow-2xl max-w-4xl mx-auto">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-3xl font-bold text-gray-800">${m.name}</h2>
                        <div class="text-sm mt-1">
                            <span class="type-badge" style="background-color: ${TYPE_COLORS[m.type]}">${m.type}</span>
                            <span class="ml-2 text-gray-600">${m.category.toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    ${m.category === 'charge' ? `
                        <div class="bg-gray-50 rounded-xl p-3">
                            <div class="text-xs text-gray-600">DPE</div>
                            <div class="text-2xl font-bold text-gray-800">${formatNumber(m.dpe)}</div>
                        </div>
                        <div class="bg-gray-50 rounded-xl p-3">
                            <div class="text-xs text-gray-600">Energy</div>
                            <div class="text-2xl font-bold text-gray-800">${m.energy}</div>
                        </div>
                    ` : `
                        <div class="bg-gray-50 rounded-xl p-3">
                            <div class="text-xs text-gray-600">DPT</div>
                            <div class="text-2xl font-bold text-gray-800">${formatNumber(m.dpt)}</div>
                        </div>
                        <div class="bg-gray-50 rounded-xl p-3">
                            <div class="text-xs text-gray-600">EPT</div>
                            <div class="text-2xl font-bold text-gray-800">${formatNumber(m.ept)}</div>
                        </div>
                    `}
                    <div class="bg-gray-50 rounded-xl p-3">
                        <div class="text-xs text-gray-600">Power</div>
                        <div class="text-2xl font-bold text-gray-800">${m.power}</div>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3">
                        <div class="text-xs text-gray-600">Duration</div>
                        <div class="text-2xl font-bold text-gray-800">${m.duration}${this.moveMode === 'pve' ? 's' : 't'}</div>
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="font-semibold text-gray-800 text-lg mb-3">Pokémon that can learn this move</h3>
                    <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
                        ${learners.map(p => {
                            const isElite = p.moves[`${m.category}Elite`].includes(m.name);
                            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.dexNumber}.png`;
                            return `
                                <div class="rounded-xl p-2 text-center ${isElite ? 'elite-move' : ''}" data-pokemon-id="${p.id}">
                                    <img src="${spriteUrl}" class="pokemon-sprite w-16 h-16 mx-auto">
                                    <div class="text-xs font-medium mt-1">${p.name}</div>
                                    ${isElite ? '<div class="text-xs text-purple-600 font-bold">ELITE</div>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Tags -->
                <div class="mt-6">
                    <div class="flex items-center gap-3 mb-2">
                        ${tags.length > 0 ? tags.map(tag => 
                            `<span class="px-3 py-1 rounded-full bg-purple-500 text-white text-sm flex items-center gap-2">
                                ${tag}
                                <button data-action="remove-tag" data-tag="${tag}" data-is-move="true" class="hover:text-red-200">
                                    <i class="fa-solid fa-xmark text-xs"></i>
                                </button>
                            </span>`
                        ).join('') : ''}
                        
                        <button data-action="show-tag-input" class="text-purple-500 hover:text-purple-600">
                            <i class="fa-solid fa-tag text-xl"></i>
                        </button>
                    </div>
                    
                    ${this.showTagInput ? `
                        <div class="flex gap-2">
                            <input
                                type="text"
                                data-action="tag-input"
                                placeholder="Add a tag..."
                                class="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                data-action="add-tag"
                                data-is-move="true"
                                class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                            >
                                Add
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>

            <button class="fab-button fab-center bg-gray-600 text-white" data-action="close-move-detail">
                <i class="fa-solid fa-xmark text-xl"></i>
            </button>
        </div>
    `;
}

// ====================================
// MOVE EVENT LISTENERS
// ====================================

function attachMoveEventListeners() {
    const closeMoveBtn = document.querySelector('[data-action="close-move-detail"]');
    if (closeMoveBtn) {
        closeMoveBtn.addEventListener('click', () => {
            this.selectedMove = null;
            this.render();
        });
    }

    document.querySelectorAll('[data-action="toggle-section"]').forEach(btn => {
        btn.addEventListener('click', () => toggleMoveSection.call(this, btn.dataset.section));
    });

    const toggleMode = document.querySelector('[data-action="toggle-mode"]');
    if (toggleMode) {
        toggleMode.addEventListener('click', () => {
            this.moveMode = this.moveMode === 'pvp' ? 'pve' : 'pvp';
            this.render();
        });
    }

    // Move cards with long press
    document.querySelectorAll('.move-card').forEach(card => {
        card.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'move'), false);
        card.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'move'), false);
        
        card.addEventListener('mousedown', () => {
            this.longPressTimer = setTimeout(() => {
                const moveName = card.dataset.moveName;
                const category = card.dataset.moveCategory;
                const moveData = this.getMoveDetails(moveName, category, this.moveMode);
                if (moveData) selectMove.call(this, moveData);
            }, 500);
        });
        
        card.addEventListener('mouseup', () => clearTimeout(this.longPressTimer));
        card.addEventListener('mouseleave', () => clearTimeout(this.longPressTimer));
    });
}