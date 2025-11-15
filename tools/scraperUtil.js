// ============================================================
// BATTLE SIMULATOR
// ============================================================

class BattleSimulator {
    constructor(pokemon1, pokemon2, shields1, shields2, scenario, typeChart, typeOrder) {
        this.p1 = pokemon1;
        this.p2 = pokemon2;
        this.shields = [shields1, shields2];
        this.energy = [0, 0];
        this.hp = [
            this.calculateHP(pokemon1.stats, pokemon1.ivs),
            this.calculateHP(pokemon2.stats, pokemon2.ivs)
        ];
        this.maxHP = [...this.hp];
        this.attackStage = [0, 0];
        this.defenseStage = [0, 0];
        this.turn = 0;
        this.fastMoveCountdown = [0, 0];
        this.scenario = scenario;
        this.typeChart = typeChart;
        this.typeOrder = typeOrder;
    }

    simulate() {
        this.applyScenarioConditions();
        
        while (this.hp[0] > 0 && this.hp[1] > 0) {
            this.processTurn();
            this.turn++;
            if (this.turn > 600) break;
        }
        
        return this.calculateBattleRating();
    }

    applyScenarioConditions() {
        const baseScenario = this.scenario.replace('-baited', '');
        
        if (baseScenario === 'switches' || baseScenario === 'underdog') {
            this.energy[1] = this.p2.fastMove.energy * 6;
        }
    }
    
    isP1Baited() {
        return this.scenario.includes('-baited');
    }

    processTurn() {
        this.fastMoveCountdown[0]--;
        this.fastMoveCountdown[1]--;
        
        if (this.fastMoveCountdown[0] <= 0) {
            this.useFastMove(0);
            this.fastMoveCountdown[0] = this.p1.fastMove.duration;
        }
        
        if (this.fastMoveCountdown[1] <= 0) {
            this.useFastMove(1);
            this.fastMoveCountdown[1] = this.p2.fastMove.duration;
        }
        
        this.checkChargedMoves();
    }

    useFastMove(attackerIndex) {
        const attacker = attackerIndex === 0 ? this.p1 : this.p2;
        const defenderIndex = 1 - attackerIndex;
        const defender = attackerIndex === 0 ? this.p2 : this.p1;
        
        const move = attacker.fastMove;
        const damage = this.calculateDamage(attacker, defender, move, attackerIndex, defenderIndex);
        
        this.hp[defenderIndex] -= damage;
        this.hp[defenderIndex] = Math.max(0, this.hp[defenderIndex]);
        
        this.energy[attackerIndex] += move.energy;
        this.energy[attackerIndex] = Math.min(100, this.energy[attackerIndex]);
    }

    checkChargedMoves() {
        const p1Ready = this.canUseChargedMove(0);
        const p2Ready = this.canUseChargedMove(1);
        
        if (p1Ready && p2Ready) {
            const p1Attack = this.getEffectiveAttack(0);
            const p2Attack = this.getEffectiveAttack(1);
            
            if (p1Attack >= p2Attack) {
                this.useChargedMove(0);
                if (this.hp[1] > 0) this.useChargedMove(1);
            } else {
                this.useChargedMove(1);
                if (this.hp[0] > 0) this.useChargedMove(0);
            }
        } else if (p1Ready) {
            this.useChargedMove(0);
        } else if (p2Ready) {
            this.useChargedMove(1);
        }
    }

    canUseChargedMove(playerIndex) {
        const pokemon = playerIndex === 0 ? this.p1 : this.p2;
        if (pokemon.chargedMoves.length === 0) return false;
        
        const cheapestMove = pokemon.chargedMoves.reduce((min, move) => 
            move.energy < min.energy ? move : min
        );
        
        return this.energy[playerIndex] >= cheapestMove.energy;
    }

    useChargedMove(attackerIndex) {
        const attacker = attackerIndex === 0 ? this.p1 : this.p2;
        const defenderIndex = 1 - attackerIndex;
        const defender = attackerIndex === 0 ? this.p2 : this.p1;
        
        const move = this.selectChargedMove(attackerIndex, defenderIndex);
        if (!move) return;
        
        this.energy[attackerIndex] -= move.energy;
        this.energy[attackerIndex] = Math.max(0, this.energy[attackerIndex]);
        
        let damage = this.calculateDamage(attacker, defender, move, attackerIndex, defenderIndex);
        
        const shouldShield = this.shouldUseShield(defenderIndex, move);
        
        if (shouldShield) {
            this.shields[defenderIndex]--;
            damage = 1;
        }
        
        this.hp[defenderIndex] -= damage;
        this.hp[defenderIndex] = Math.max(0, this.hp[defenderIndex]);
    }

    selectChargedMove(attackerIndex, defenderIndex) {
        const attacker = attackerIndex === 0 ? this.p1 : this.p2;
        const defender = defenderIndex === 0 ? this.p1 : this.p2;
        
        if (attacker.chargedMoves.length === 0) return null;
        
        const currentEnergy = this.energy[attackerIndex];
        const defenderHasShields = this.shields[defenderIndex] > 0;
        const defenderHP = this.hp[defenderIndex];
        
        // Check if we can KO with any move (throw cheapest KO move)
        const koMoves = attacker.chargedMoves.filter(move => {
            if (currentEnergy < move.energy) return false;
            const damage = this.calculateDamage(attacker, defender, move, attackerIndex, defenderIndex);
            return damage >= defenderHP;
        });
        
        if (koMoves.length > 0) {
            // Return cheapest KO move to conserve energy
            return koMoves.reduce((cheapest, move) => 
                move.energy < cheapest.energy ? move : cheapest
            );
        }
        const urgencyMode = this.checkUrgency(attackerIndex, defenderIndex);
        
        if (urgencyMode) {
            const affordable = attacker.chargedMoves
                .filter(m => currentEnergy >= m.energy)
                .sort((a, b) => a.energy - b.energy);
            return affordable.length > 0 ? affordable[0] : null;
        }
        
        const useShieldAwareDPE = !(attackerIndex === 0 && this.isP1Baited());
        
        const moveScores = attacker.chargedMoves.map(move => {
            const effectiveness = this.getTypeEffectiveness(move.type, defender.types);
            let damage = move.power * effectiveness;
            
            if (attacker.types.includes(move.type)) {
                damage *= 1.2;
            }
            
            if (useShieldAwareDPE && defenderHasShields) {
                damage = Math.min(damage, 1);
            }
            
            const dpe = damage / move.energy;
            return { move, dpe, effectiveness };
        });
        
        moveScores.sort((a, b) => b.dpe - a.dpe);
        
        const bestMove = moveScores[0];
        const bestAffordable = moveScores.find(ms => currentEnergy >= ms.move.energy);
        
        if (!bestAffordable) return null;
        
        if (currentEnergy >= bestMove.move.energy) {
            return bestMove.move;
        }
        
        
        
        return bestAffordable.move;
    }
    
    checkUrgency(attackerIndex, defenderIndex) {
        const opponent = defenderIndex === 0 ? this.p1 : this.p2;
        const myHP = this.hp[attackerIndex];
        
        for (const move of opponent.chargedMoves) {
            const potentialDamage = this.calculateDamage(
                opponent,                                  // opponent pokemon
                attackerIndex === 0 ? this.p1 : this.p2,  // my pokemon
                move,                                      // opponent's move
                defenderIndex,    // ← opponent is attacking, so use defenderIndex
                attackerIndex     // ← I am defending, so use attackerIndex
            );
            
            if (potentialDamage >= myHP) {
                return true;
            }
        }
        return false;
    }

    shouldUseShield(defenderIndex, move) {
        if (this.shields[defenderIndex] === 0) return false;
        return true;
    }

    calculateDamage(attacker, defender, move, attackerIndex, defenderIndex) {
        const attackStat = this.getEffectiveAttack(attackerIndex);
        const defenseStat = this.getEffectiveDefense(defenderIndex);
        const effectiveness = this.getTypeEffectiveness(move.type, defender.types);
        const stabMultiplier = attacker.types.includes(move.type) ? 1.2 : 1.0;
        
        const baseDamage = 0.5 * move.power * (attackStat / defenseStat) * effectiveness * stabMultiplier;
        const damage = Math.max(1, Math.floor(baseDamage));
        
        return damage;
    }

    getEffectiveAttack(playerIndex) {
        const pokemon = playerIndex === 0 ? this.p1 : this.p2;
        const baseAttack = this.calculateAttack(pokemon.stats, pokemon.ivs);
        const shadowMultiplier = pokemon.isShadow ? 1.2 : 1.0;
        const stageMultiplier = this.getStageMultiplier(this.attackStage[playerIndex]);
        
        return baseAttack * shadowMultiplier * stageMultiplier;
    }

    getEffectiveDefense(playerIndex) {
        const pokemon = playerIndex === 0 ? this.p1 : this.p2;
        const baseDefense = this.calculateDefense(pokemon.stats, pokemon.ivs);
        const shadowMultiplier = pokemon.isShadow ? 0.833 : 1.0;
        const stageMultiplier = this.getStageMultiplier(this.defenseStage[playerIndex]);
        
        return baseDefense * shadowMultiplier * stageMultiplier;
    }

    getStageMultiplier(stage) {
        const multipliers = {
            '-4': 0.5, '-3': 0.5714, '-2': 0.6667, '-1': 0.8,
            '0': 1.0,
            '1': 1.25, '2': 1.5, '3': 1.75, '4': 2.0
        };
        return multipliers[stage.toString()] || 1.0;
    }

    calculateAttack(stats, ivs) {
        const cpmValue = ivs.cpm || 0.84030001;
        return (stats.attack + ivs.atk) * cpmValue;
    }

    calculateDefense(stats, ivs) {
        const cpmValue = ivs.cpm || 0.84030001;
        return (stats.defense + ivs.def) * cpmValue;
    }

    calculateHP(stats, ivs) {
        const cpmValue = ivs.cpm || 0.84030001;
        return Math.max(10, Math.floor((stats.hp + ivs.sta) * cpmValue));
    }

    getTypeEffectiveness(attackType, defenderTypes) {
        if (!this.typeChart || !this.typeOrder) return 1.0;
        
        const types = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
        
        if (types.length === 2) {
            const sortedTypes = types.sort((a, b) => 
                this.typeOrder.indexOf(a) - this.typeOrder.indexOf(b)
            );
            const combinedType = sortedTypes.join('/');
            
            const attackIdx = this.typeOrder.indexOf(attackType);
            const defenseIdx = this.typeOrder.indexOf(combinedType);
            
            if (attackIdx !== -1 && defenseIdx !== -1 && this.typeChart[attackIdx]) {
                return this.typeChart[attackIdx][defenseIdx] || 1.0;
            }
        }
        
        if (types.length === 1) {
            const attackIdx = this.typeOrder.indexOf(attackType);
            const defenseIdx = this.typeOrder.indexOf(types[0]);
            
            if (attackIdx !== -1 && defenseIdx !== -1 && this.typeChart[attackIdx]) {
                return this.typeChart[attackIdx][defenseIdx] || 1.0;
            }
        }
        
        return 1.0;
    }

    calculateBattleRating() {
        if (this.hp[0] <= 0 && this.hp[1] <= 0) return 500;
        
        const p1RemainingPercent = Math.max(0, this.hp[0]) / this.maxHP[0];
        const p2RemainingPercent = Math.max(0, this.hp[1]) / this.maxHP[1];
        const differential = p1RemainingPercent - p2RemainingPercent;
        const rating = 500 + (differential * 500);
        
        return Math.max(0, Math.min(1000, rating));
    }
}

// ============================================================
// RANKING CALCULATOR
// ============================================================

async function calculateRankings(allPokemon, allMoves, selectedCups, typeChart, typeOrder) {
    updateStatus('⚔️ Starting battle simulations...');
    
    const scenarios = [
        'leads', 'leads-baited', 'switches', 'switches-baited', 
        'closers', 'attackers', 'attackers-baited', 'underdog'
    ];
    
    for (const cup of selectedCups) {
        console.log(`\n=== Processing ${cup.title} ===`);
        updateStatus(`⚔️ Simulating ${cup.title} (${cup.cpLimit || 'No Limit'} CP)...`);                

        const leagueConfig = {
            name: cup.id.toLowerCase().replace(/_/g, '-'),
            displayName: cup.title,
            cpLimit: cup.cpLimit,
            cpPrune: cup.cpLimit || 2500,
            limitToFirstStage: cup.cpLimit === 500 && !cup.id.includes('JUNGLE'),
            allowedTypes: cup.allowedTypes,
            allowedPokemon: cup.allowedPokemon,
            bannedPokemon: cup.bannedPokemon,
            maxLevel: cup.maxLevel
        };
        
        const eligiblePokemon = getEligiblePokemon(allPokemon, leagueConfig, allMoves);
        if (eligiblePokemon.length === 0) {
            updateStatus(`⚠️ No eligible Pokemon for ${cup.title}`);
            continue;
        }
        
        const rankings = await simulateLeague(
            eligiblePokemon, 
            leagueConfig, 
            scenarios, 
            typeChart, 
            typeOrder,
            allMoves
        );
        
        await saveToDatabase('rankings', [{
            id: `${leagueConfig.name}-${new Date().toISOString().split('T')[0]}`,
            league: leagueConfig.name,
            cupTitle: cup.title,
            cpLimit: cup.cpLimit,
            calculatedAt: new Date().toISOString(),
            rankings: rankings
        }]);
        
        updateStatus(`✅ ${cup.title} complete! (${rankings.length} Pokemon ranked)`);
        
        // Run anti-meta pass
        updateStatus(`🎯 Running anti-meta analysis for ${cup.title}...`);
        const antimetaRankings = await simulateAntimeta(
            eligiblePokemon,
            rankings,
            leagueConfig,
            scenarios,
            typeChart,
            typeOrder,
            allMoves
        );
        
        await saveToDatabase('rankings', [{
            id: `antimeta-${leagueConfig.name}-${new Date().toISOString().split('T')[0]}`,
            league: `antimeta-${leagueConfig.name}`,
            cupTitle: `Anti-Meta ${cup.title}`,
            cpLimit: cup.cpLimit,
            calculatedAt: new Date().toISOString(),
            rankings: antimetaRankings
        }]);
        
        updateStatus(`✅ Anti-meta ${cup.title} complete! (${antimetaRankings.length} Pokemon ranked)`);
        
        eligiblePokemon.length = 0;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    updateStatus('✅ All battle simulations complete!');
}

function getEligiblePokemon(allPokemon, league, allMoves) {
    try {
        const eligible = [];
        
        let leagueProperty;
        if (league.cpLimit === 500) {
            leagueProperty = 'little';
        } else if (league.cpLimit === 1500) {
            leagueProperty = 'great';
        } else if (league.cpLimit === 2500) {
            leagueProperty = 'ultra';
        } else {
            leagueProperty = 'master';
        }
        
        for (const p of allPokemon) {
            if (league.bannedPokemon && league.bannedPokemon.includes(p.name.toUpperCase())) {
                continue;
            }
            
            if (league.allowedTypes && league.allowedTypes.length > 0) {
                const hasAllowedType = p.types.some(t => league.allowedTypes.includes(t));
                if (!hasAllowedType) continue;
            }
            
            if (league.allowedPokemon && league.allowedPokemon.length > 0) {
                const isAllowed = league.allowedPokemon.some(allowed => 
                    allowed.id === p.name.toUpperCase() && 
                    (!allowed.form || allowed.form === p.form?.toUpperCase())
                );
                if (!isAllowed) continue;
            }
            
            if (league.limitToFirstStage) {
                if (!p.evolutions || p.evolutions.length === 0) continue;
                
                const isFirstStage = !allPokemon.some(other => 
                    other.evolutions && other.evolutions.some(evo => 
                        evo.name === p.name && (evo.form === p.form || (!evo.form && !p.form))
                    )
                );
                
                if (!isFirstStage) continue;
            }
            
            const leagueData = p[leagueProperty];
            if (!leagueData) continue;
            
            if (leagueProperty === 'master') {
                const cp = calculateCP(p.stats, { atk: 15, def: 15, sta: 15 }, cpm[99]);
                
                if (cp < league.cpPrune - 100) continue;
                
                const variants = [
                    { 
                        ...p, 
                        isShadow: false, 
                        variantId: `${p.id}`,
                        leagueData: leagueData
                    }
                ];
                if (p.shadowInfo) {
                    variants.push({ 
                        ...p, 
                        isShadow: true, 
                        variantId: `${p.id}-shadow`,
                        leagueData: leagueData
                    });
                }
                eligible.push(...variants);
            } else {
                const ivs = leagueData.iv;
                const cp = leagueData.cp || calculateCP(p.stats, ivs, cpm[Math.round((leagueData.level - 1) * 2)]);
                
                if (ivs.atk === 15 && ivs.def === 15 && ivs.sta === 15 && cp < league.cpLimit - 100) {
                    continue;
                }
                
                const variants = [
                    { 
                        ...p, 
                        isShadow: false, 
                        variantId: `${p.id}`,
                        leagueData: leagueData
                    }
                ];
                if (p.shadowInfo) {
                    variants.push({ 
                        ...p, 
                        isShadow: true, 
                        variantId: `${p.id}-shadow`,
                        leagueData: leagueData
                    });
                }
                eligible.push(...variants);
            }
        }
        
        return eligible;
    } catch (error) {
        console.error('Error in getEligiblePokemon:', error);
        return [];
    }
}

function calculateCP(stats, ivs, cpmValue) {
    return Math.max(10, Math.floor(
        (stats.attack + ivs.atk) * 
        Math.sqrt(stats.defense + ivs.def) * 
        Math.sqrt(stats.hp + ivs.sta) * 
        cpmValue * cpmValue / 10
    ));
}

async function simulateAntimeta(eligiblePokemon, mainRankings, league, scenarios, typeChart, typeOrder, allMoves) {
    // Get top 50 from main rankings
    const top50 = mainRankings.slice(0, 50);
    
    // Initialize results storage
    const results = new Map();
    for (const p of eligiblePokemon) {
        results.set(p.variantId, {
            speciesId: p.id,
            name: p.name,
            form: p.form || null,
            isShadow: p.isShadow,
            scenarioRatings: {},
            moveTallies: {}
        });
    }
    
    // Generate all movesets for P1 (all eligible Pokemon)
    const movesets = generateMovesets(eligiblePokemon, allMoves);
    const movesetsByPokemon = new Map();
    for (const moveset of movesets) {
        const variantId = moveset.pokemon.variantId;
        if (!movesetsByPokemon.has(variantId)) {
            movesetsByPokemon.set(variantId, []);
        }
        movesetsByPokemon.get(variantId).push(moveset);
    }
    
    // Build fixed movesets for top 50 (P2)
    const top50Movesets = new Map();
    const pvpMoves = allMoves.filter(m => m.mode === 'pvp');
    
    for (const ranked of top50) {
        const pokemon = eligiblePokemon.find(p => 
            p.id === ranked.speciesId && 
            p.isShadow === ranked.isShadow &&
            (p.form || null) === ranked.form
        );
        
        if (!pokemon) continue;
        
        const fastMove = pvpMoves.find(m => 
            m.rawId === ranked.recommendedMoveset.fast && m.category === 'fast'
        );
        const chargedMoves = ranked.recommendedMoveset.charged.map(id =>
            pvpMoves.find(m => m.rawId === id && m.category === 'charge')
        ).filter(m => m);
        
        if (fastMove && chargedMoves.length > 0) {
            top50Movesets.set(pokemon.variantId, {
                pokemon: pokemon,
                fast: fastMove,
                charged: chargedMoves
            });
        }
    }
    
    // Calculate total matchups (all P1 vs top 50 P2, all scenarios, all asymmetric)
    const n = eligiblePokemon.length;
    const top50Count = top50Movesets.size;
    const totalMatchups = n * top50Count * scenarios.length;
    
    let matchupsCompleted = 0;
    updateProgress(0, totalMatchups, `Anti-meta ${league.name}: 0 / ${totalMatchups.toLocaleString()} matchups`);
    
    // Cache for baited scenarios
    const movesetCache = new Map();
    
    // LOOP: Step through all eligible Pokemon (P1)
    for (let i = 0; i < eligiblePokemon.length; i++) {
        const pokemon1 = eligiblePokemon[i];
        const p1Movesets = movesetsByPokemon.get(pokemon1.variantId);
        const p1Data = results.get(pokemon1.variantId);
        
        // LOOP: Step through top 50 (P2)
        for (const [p2VariantId, p2Moveset] of top50Movesets) {
            const pokemon2 = p2Moveset.pokemon;
            
            // LOOP: Step through each scenario
            for (const scenario of scenarios) {
                const isBaited = scenario.includes('-baited');
                const baseScenario = scenario.replace('-baited', '');
                
                let bestP1Moveset, finalP1Rating;
                
                // If baited, use cached moveset from non-baited scenario
                if (isBaited) {
                    const cacheKey = `${pokemon1.variantId}-${p2VariantId}-${baseScenario}`;
                    const cached = movesetCache.get(cacheKey);
                    
                    if (cached) {
                        bestP1Moveset = cached.p1Moveset;
                        finalP1Rating = simulateBattle(bestP1Moveset, p2Moveset, scenario, league, typeChart, typeOrder);
                    } else {
                        continue;
                    }
                } else {
                    // Find P1's best moveset against this top 50 opponent
                    let bestP1Rating = -Infinity;
                    const p1Tallies = new Map();
                    
                    for (const ms1 of p1Movesets) {
                        const rating = simulateBattle(ms1, p2Moveset, scenario, league, typeChart, typeOrder);
                        
                        if (rating > bestP1Rating) {
                            bestP1Rating = rating;
                            bestP1Moveset = ms1;
                        }
                        
                        // Tally moves for winners
                        if (rating > 500) {
                            const key = getMovesetKey(ms1);
                            p1Tallies.set(key, (p1Tallies.get(key) || 0) + 1);
                        }
                    }
                    
                    // Store tallies
                    for (const [key, wins] of p1Tallies) {
                        if (!p1Data.moveTallies[key]) {
                            p1Data.moveTallies[key] = { moveset: bestP1Moveset, wins: 0 };
                        }
                        p1Data.moveTallies[key].wins += wins;
                    }
                    
                    finalP1Rating = bestP1Rating;
                    
                    // Cache for baited variant
                    const cacheKey = `${pokemon1.variantId}-${p2VariantId}-${scenario}`;
                    movesetCache.set(cacheKey, { p1Moveset: bestP1Moveset });
                }
                
                // Store rating for P1
                if (!p1Data.scenarioRatings[scenario]) {
                    p1Data.scenarioRatings[scenario] = [];
                }
                p1Data.scenarioRatings[scenario].push(finalP1Rating);
                
                matchupsCompleted++;
                
                if (matchupsCompleted % 100 === 0) {
                    updateProgress(matchupsCompleted, totalMatchups, 
                        `Anti-meta ${league.name}: ${matchupsCompleted.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
    }
    
    updateProgress(totalMatchups, totalMatchups, 
        `Anti-meta ${league.name}: ${totalMatchups.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups - Aggregating...`);
    
    // Aggregate final rankings
    const rankings = aggregateResults(results, eligiblePokemon);
    
    // Clear memory
    results.clear();
    movesets.length = 0;
    movesetCache.clear();
    
    return rankings;
}

async function simulateLeague(eligiblePokemon, league, scenarios, typeChart, typeOrder, allMoves) {
    // Initialize results storage for each Pokemon
    const results = new Map();
    for (const p of eligiblePokemon) {
        results.set(p.variantId, {
            speciesId: p.id,
            name: p.name,
            form: p.form || null,
            isShadow: p.isShadow,
            scenarioRatings: {}, // Stores all matchup ratings per scenario
            moveTallies: {} // Tracks wins per moveset
        });
    }
    
    // Generate all movesets upfront
    const movesets = generateMovesets(eligiblePokemon, allMoves);
    const movesetsByPokemon = new Map();
    for (const moveset of movesets) {
        const variantId = moveset.pokemon.variantId;
        if (!movesetsByPokemon.has(variantId)) {
            movesetsByPokemon.set(variantId, []);
        }
        movesetsByPokemon.get(variantId).push(moveset);
    }
    
    // Calculate total matchups for progress tracking
    const n = eligiblePokemon.length;
    const symmetricCount = scenarios.filter(s => isScenarioSymmetric(s)).length;
    const asymmetricCount = scenarios.length - symmetricCount;
    const totalMatchups = (n * (n - 1) / 2) * symmetricCount + (n * (n - 1)) * asymmetricCount;
    
    let matchupsCompleted = 0;
    updateProgress(0, totalMatchups, `${league.name}: 0 / ${totalMatchups.toLocaleString()} matchups`);
    
    // Cache for baited scenarios
    const movesetCache = new Map(); // Key: "p1VarId-p2VarId-baseScenario"
    
    // LOOP 2: Step through all eligible Pokemon (P1)
    for (let i = 0; i < eligiblePokemon.length; i++) {
        const pokemon1 = eligiblePokemon[i];
        const p1Movesets = movesetsByPokemon.get(pokemon1.variantId);
        const p1Data = results.get(pokemon1.variantId);
        
        // LOOP 3: Step through all eligible Pokemon (P2)
        for (let j = 0; j < eligiblePokemon.length; j++) {
            if (i === j) continue; // Skip self-matchups
            
            const pokemon2 = eligiblePokemon[j];
            const p2Movesets = movesetsByPokemon.get(pokemon2.variantId);
            const p2Data = results.get(pokemon2.variantId);
            
            // LOOP 4: Step through each scenario
            for (const scenario of scenarios) {
                const isSymmetric = isScenarioSymmetric(scenario);
                const isBaited = scenario.includes('-baited');
                const baseScenario = scenario.replace('-baited', '');
                
                // For symmetric scenarios, skip if P2 index < P1 index to avoid duplicates
                if (isSymmetric && j < i) continue;
                
                let bestP1Moveset, bestP2Moveset, finalP1Rating;
                
                // If baited, use cached movesets from non-baited scenario
                if (isBaited) {
                    const cacheKey = `${pokemon1.variantId}-${pokemon2.variantId}-${baseScenario}`;
                    const cached = movesetCache.get(cacheKey);
                    
                    if (cached) {
                        bestP1Moveset = cached.p1Moveset;
                        bestP2Moveset = cached.p2Moveset;
                        
                        // Simulate with baited scenario
                        finalP1Rating = simulateBattle(bestP1Moveset, bestP2Moveset, scenario, league, typeChart, typeOrder);
                    } else {
                        // Fallback if cache miss (shouldn't happen if scenarios ordered correctly)
                        continue;
                    }
                } else {
                    // LOOP 5 & 6: Find best movesets independently
                    let bestP1Rating = -Infinity;
                    let bestP2Rating = -Infinity;
                    
                    // Track tallies for recommended moveset
                    const p1Tallies = new Map();
                    const p2Tallies = new Map();
                    
                    for (const ms1 of p1Movesets) {
                        for (const ms2 of p2Movesets) {
                            const rating = simulateBattle(ms1, ms2, scenario, league, typeChart, typeOrder);
                            
                            // Track P1's best moveset
                            if (rating > bestP1Rating) {
                                bestP1Rating = rating;
                                bestP1Moveset = ms1;
                            }
                            
                            // Track P2's best moveset
                            const p2Rating = 1000 - rating;
                            if (p2Rating > bestP2Rating) {
                                bestP2Rating = p2Rating;
                                bestP2Moveset = ms2;
                            }
                            
                            // Tally moves for winners
                            if (rating > 500) {
                                const key = getMovesetKey(ms1);
                                p1Tallies.set(key, (p1Tallies.get(key) || 0) + 1);
                            }
                            if (p2Rating > 500) {
                                const key = getMovesetKey(ms2);
                                p2Tallies.set(key, (p2Tallies.get(key) || 0) + 1);
                            }
                        }
                    }
                    
                    // Store tallies
                    for (const [key, wins] of p1Tallies) {
                        if (!p1Data.moveTallies[key]) {
                            p1Data.moveTallies[key] = { moveset: bestP1Moveset, wins: 0 };
                        }
                        p1Data.moveTallies[key].wins += wins;
                    }
                    
                    if (isSymmetric) {
                        for (const [key, wins] of p2Tallies) {
                            if (!p2Data.moveTallies[key]) {
                                p2Data.moveTallies[key] = { moveset: bestP2Moveset, wins: 0 };
                            }
                            p2Data.moveTallies[key].wins += wins;
                        }
                    }
                    
                    // Now simulate best vs best
                    finalP1Rating = simulateBattle(bestP1Moveset, bestP2Moveset, scenario, league, typeChart, typeOrder);
                    
                    // Cache for baited variant
                    const cacheKey = `${pokemon1.variantId}-${pokemon2.variantId}-${scenario}`;
                    movesetCache.set(cacheKey, {
                        p1Moveset: bestP1Moveset,
                        p2Moveset: bestP2Moveset
                    });
                }
                
                // Store final rating for P1
                if (!p1Data.scenarioRatings[scenario]) {
                    p1Data.scenarioRatings[scenario] = [];
                }
                p1Data.scenarioRatings[scenario].push(finalP1Rating);
                
                // For symmetric scenarios, store P2's rating
                if (isSymmetric) {
                    const finalP2Rating = 1000 - finalP1Rating;
                    if (!p2Data.scenarioRatings[scenario]) {
                        p2Data.scenarioRatings[scenario] = [];
                    }
                    p2Data.scenarioRatings[scenario].push(finalP2Rating);
                }
                
                matchupsCompleted++;
                
                if (matchupsCompleted % 100 === 0) {
                    updateProgress(matchupsCompleted, totalMatchups, 
                        `${league.name}: ${matchupsCompleted.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups`);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        }
    }
    
    updateProgress(totalMatchups, totalMatchups, 
        `${league.name}: ${totalMatchups.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups - Aggregating...`);
    
    // Aggregate final rankings
    const rankings = aggregateResults(results, eligiblePokemon);
    
    // Clear memory
    results.clear();
    movesets.length = 0;
    movesetCache.clear();
    
    return rankings;
}

function generateMovesets(eligiblePokemon, allMoves) {
    const movesets = [];
    const pvpMoves = allMoves.filter(m => m.mode === 'pvp');
    
    for (const p of eligiblePokemon) {
        const fastMoves = p.moves.fast.map(name => 
            pvpMoves.find(m => m.name === name && m.category === 'fast')
        ).filter(m => m);
        
        const chargedMoves = [...p.moves.charge, ...p.moves.chargeElite].map(name =>
            pvpMoves.find(m => m.name === name && m.category === 'charge')
        ).filter(m => m);
        
        for (const fast of fastMoves) {
            if (chargedMoves.length >= 2) {
                for (let i = 0; i < chargedMoves.length; i++) {
                    for (let j = i + 1; j < chargedMoves.length; j++) {
                        movesets.push({
                            pokemon: p,
                            fast: fast,
                            charged: [chargedMoves[i], chargedMoves[j]]
                        });
                    }
                }
            } else if (chargedMoves.length === 1) {
                movesets.push({
                    pokemon: p,
                    fast: fast,
                    charged: [chargedMoves[0]]
                });
            }
        }
    }
    
    return movesets;
}

function getMovesetKey(moveset) {
    return `${moveset.fast.rawId}|${moveset.charged.map(m => m.rawId).sort().join('|')}`;
}

function isScenarioSymmetric(scenario) {
    return scenario === 'leads' || scenario === 'leads-baited' || 
            scenario === 'closers';
}

function simulateBattle(moveset1, moveset2, scenario, league, typeChart, typeOrder) {
    const shields = getShieldsForScenario(scenario);
    
    const pokemon1 = buildPokemonForSim(moveset1, league); 
    const pokemon2 = buildPokemonForSim(moveset2, league);
    
    const sim = new BattleSimulator(
        pokemon1,
        pokemon2,
        shields.p1,
        shields.p2,
        scenario,
        typeChart,
        typeOrder
    );
    
    return sim.simulate();
}

function getShieldsForScenario(scenario) {
    const base = scenario.replace('-baited', '');
    
    switch (base) {
        case 'leads':
        case 'switches':
            return { p1: 2, p2: 2 };
        case 'closers':
        case 'underdog':
            return { p1: 0, p2: 0 };
        case 'attackers':
            return { p1: 0, p2: 2 };
        default:
            return { p1: 2, p2: 2 };
    }
}

function buildPokemonForSim(moveset, league) {
    const p = moveset.pokemon;
    
    const leagueData = p.leagueData || { iv: { atk: 15, def: 15, sta: 15 }, level: 50 };
    
    const levelIndex = Math.round((leagueData.level - 1) * 2);
    const cpmValue = cpm[levelIndex];
    
    return {
        name: p.name,
        types: p.types,
        stats: p.stats,
        ivs: { ...leagueData.iv, cpm: cpmValue },
        fastMove: moveset.fast,
        chargedMoves: moveset.charged,
        isShadow: p.isShadow
    };
}

function aggregateResults(results, eligiblePokemon) {
    const rankings = [];
    
    for (const [variantId, data] of results.entries()) {
        // Calculate average rating per scenario
        const scenarioAverages = {};
        for (const [scenario, ratings] of Object.entries(data.scenarioRatings)) {
            if (ratings.length > 0) {
                scenarioAverages[scenario] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            }
        }
        
        const scores = Object.values(scenarioAverages);
        if (scores.length === 0) continue;
        
        // Calculate geometric mean of scenario averages
        const geometricMean = Math.pow(
            scores.reduce((a, b) => a * b, 1),
            1 / scores.length
        );
        
        // Find best role (highest average scenario)
        let bestRole = '';
        let bestScoreValue = 0;
        for (const [scenario, score] of Object.entries(scenarioAverages)) {
            if (score > bestScoreValue) {
                bestScoreValue = score;
                bestRole = scenario;
            }
        }
        
        // Find most-winning moveset for recommendation
        let recommendedMoveset = null;
        let maxWins = 0;
        for (const [key, tallyData] of Object.entries(data.moveTallies)) {
            if (tallyData.wins > maxWins) {
                maxWins = tallyData.wins;
                const moveset = tallyData.moveset;
                recommendedMoveset = {
                    fast: moveset.fast.rawId,
                    charged: moveset.charged.map(m => m.rawId)
                };
            }
        }
        
        if (recommendedMoveset) {
            rankings.push({
                speciesId: data.speciesId,
                name: data.name,
                form: data.form,
                isShadow: data.isShadow,
                recommendedMoveset: recommendedMoveset,
                role: bestRole,
                rawScore: geometricMean,
                displayRank: 0,
                scenarioScores: scenarioAverages
            });
        }
    }
    
    // Normalize scores to 0-100
    if (rankings.length > 0) {
        const maxScore = Math.max(...rankings.map(r => r.rawScore));
        const minScore = Math.min(...rankings.map(r => r.rawScore));
        const scoreRange = maxScore - minScore;
        
        for (const ranking of rankings) {
            ranking.displayRank = scoreRange > 0 ? 
                ((ranking.rawScore - minScore) / scoreRange) * 100 : 
                50;
        }
    }
    
    // Sort by display rank descending
    rankings.sort((a, b) => b.displayRank - a.displayRank);
    
    // Debug logging
    console.log('=== RANKING DEBUG ===');
    console.log('Total Pokemon ranked:', rankings.length);
    
    const rawScores = rankings.map(r => r.rawScore);
    const maxRaw = Math.max(...rawScores);
    const minRaw = Math.min(...rawScores);
    const avgRaw = rawScores.reduce((a,b) => a+b, 0) / rawScores.length;
    
    console.log('Raw score stats:', {
        max: maxRaw.toFixed(2),
        min: minRaw.toFixed(2),
        avg: avgRaw.toFixed(2),
        range: (maxRaw - minRaw).toFixed(2)
    });
    
    console.log('Top 10:', rankings.slice(0, 10).map(r => ({
        name: r.name,
        rawScore: r.rawScore.toFixed(2),
        displayRank: r.displayRank.toFixed(2)
    })));
    
    return rankings;
}

async function runBattleSimulations() {
    const btn = document.getElementById('sim-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Simulating...';
    
    try {
        const checkboxes = document.querySelectorAll('#league-checkboxes input[type="checkbox"]:checked');
        const selectedCupIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedCupIds.length === 0) {
            updateStatus('⚠️ Please select at least one league to simulate.');
            return;
        }
        
        const allCups = await loadFromDatabase('cups');
        const selectedCups = allCups.filter(c => selectedCupIds.includes(c.id));
        
        updateStatus(`⏳ Running battle simulations for ${selectedCups.length} leagues...`);
        
        const allPokemon = await loadFromDatabase('pokemon');
        const allMoves = await loadFromDatabase('moves');
        const typeEffData = await loadFromDatabase('typeEffectiveness');
        const damageMatrixData = typeEffData.find(d => d.id === 'damageMatrix');
        
        if (damageMatrixData) {
            await calculateRankings(
                allPokemon, 
                allMoves, 
                selectedCups,
                damageMatrixData.matrix,
                damageMatrixData.defenderTypes
            );
        }
        
        document.getElementById('progress-container').style.display = 'none';
        updateStatus(`✅ Battle simulations complete for ${selectedCups.length} leagues!`);
        
    } catch (error) {
        updateStatus(`❌ Simulation Error: ${error.message}`);
        console.error('Simulation error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = '⚔️ Run Battle Simulations';
    }
}