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
            
            console.log('=== CALCULATE RANKINGS DEBUG ===');
            console.log('Total Pokemon in database:', allPokemon.length);
            console.log('Selected cups:', selectedCups.map(c => c.title));
            
            // Check if any Pokemon have 'little' league data
            const withLittleData = allPokemon.filter(p => p.little).length;
            console.log('Pokemon with little league data:', withLittleData);
            
            const scenarios = [
                'leads', 'leads-baited', 'switches', 'switches-baited', 
                'closers', 'attackers', 'attackers-baited', 'underdog'
            ];
            
            for (const cup of selectedCups) {
                console.log(`\n=== Processing ${cup.title} ===`);
                updateStatus(`⚔️ Simulating ${cup.title} (${cup.cpLimit || 'No Limit'} CP)...`);                

                // Convert cup to league config format
                const leagueConfig = {
                    name: cup.id.toLowerCase().replace(/_/g, '-'),
                    displayName: cup.title,
                    cpLimit: cup.cpLimit,
                    cpPrune: cup.cpLimit || 2500,
                    limitToFirstStage: cup.cpLimit === 500 && !cup.id.includes('JUNGLE'), // Enable for Little League, not Jungle
                    allowedTypes: cup.allowedTypes,
                    allowedPokemon: cup.allowedPokemon,
                    bannedPokemon: cup.bannedPokemon,
                    maxLevel: cup.maxLevel
                };
                
                const eligiblePokemon = getEligiblePokemon(allPokemon, leagueConfig, allMoves);
                console.log('eligiblePokemon result:', eligiblePokemon);
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
                
                // Clear memory after each league
                eligiblePokemon.length = 0;
                await new Promise(resolve => setTimeout(resolve, 100));
                
                updateStatus(`✅ ${cup.title} complete! (${rankings.length} Pokemon ranked)`);
            }
            
            updateStatus('✅ All battle simulations complete!');
        }

        function getEligiblePokemon(allPokemon, league, allMoves) {
            try {
                const eligible = [];
                
                // Map cup to league property on Pokemon object
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
                    // Check banned Pokemon
                    if (league.bannedPokemon && league.bannedPokemon.includes(p.name.toUpperCase())) {
                        continue;
                    }
                    
                    // Check type restrictions
                    if (league.allowedTypes && league.allowedTypes.length > 0) {
                        const hasAllowedType = p.types.some(t => league.allowedTypes.includes(t));
                        if (!hasAllowedType) continue;
                    }
                    
                    // Check Pokemon whitelist
                    if (league.allowedPokemon && league.allowedPokemon.length > 0) {
                        const isAllowed = league.allowedPokemon.some(allowed => 
                            allowed.id === p.name.toUpperCase() && 
                            (!allowed.form || allowed.form === p.form?.toUpperCase())
                        );
                        if (!isAllowed) continue;
                    }
                    
                    // Check if first stage evolution filter applies
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

        async function simulateLeague(eligiblePokemon, league, scenarios, typeChart, typeOrder, allMoves) {
            const results = new Map();
            
            for (const p of eligiblePokemon) {
                results.set(p.variantId, {
                    speciesId: p.id,
                    name: p.name,
                    form: p.form || null,
                    isShadow: p.isShadow,
                    bestScores: {},
                    bestMovesets: {},
                    moveTallies: {}
                });
            }
            
            const movesets = generateMovesets(eligiblePokemon, allMoves);
            
            // ⭐ DEBUG: Check Deino movesets
            const deinoMovesets = movesets.filter(m => m.pokemon.name === 'Deino');
            console.log('=== DEINO DEBUG ===');
            console.log('Total Deino movesets:', deinoMovesets.length);
            if (deinoMovesets.length > 0) {
                console.log('First Deino moveset:', {
                    name: deinoMovesets[0].pokemon.name,
                    leagueData: deinoMovesets[0].pokemon.leagueData,
                    fast: deinoMovesets[0].fast.name,
                    charged: deinoMovesets[0].charged.map(m => m.name)
                });
            }
            // ⭐ END DEBUG
            
            // Calculate total matchups correctly
            const symmetricScenarios = scenarios.filter(s => isScenarioSymmetric(s));
            const asymmetricScenarios = scenarios.filter(s => !isScenarioSymmetric(s));
            const n = movesets.length;
            
            const totalMatchups = (n * (n - 1) / 2) * symmetricScenarios.length + 
                                (n * (n - 1)) * asymmetricScenarios.length;
            
            let matchupsCompleted = 0;
            updateProgress(0, totalMatchups, `${league.name}: 0 / ${totalMatchups.toLocaleString()} matchups`);
            
            for (let i = 0; i < movesets.length; i++) {
                const moveset1 = movesets[i];
                const p1Data = results.get(moveset1.pokemon.variantId);
                
                for (let j = 0; j < movesets.length; j++) {
                    if (i === j) continue;
                    
                    const moveset2 = movesets[j];
                    const p2Data = results.get(moveset2.pokemon.variantId);
                    
                    for (const scenario of scenarios) {
                        const isSymmetric = isScenarioSymmetric(scenario);
                        
                        if (isSymmetric) {
                            if (i > j) continue;
                            
                            const rating = simulateBattle(moveset1, moveset2, scenario, league, typeChart, typeOrder);
                            
                            recordBestResult(p1Data, scenario, rating, moveset1);
                            recordBestResult(p2Data, scenario, 1000 - rating, moveset2);
                            
                            matchupsCompleted++;
                        } else {
                            const rating = simulateBattle(moveset1, moveset2, scenario, league, typeChart, typeOrder);
                            recordBestResult(p1Data, scenario, rating, moveset1);
                            
                            matchupsCompleted++;
                        }
                        
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
            
            // ⭐ DEBUG: Check Deino results before aggregation
            const deinoResults = results.get('Deino-base');
            console.log('Deino final results:', {
                name: deinoResults?.name,
                bestScores: deinoResults?.bestScores,
                moveTalliesCount: Object.keys(deinoResults?.moveTallies || {}).length
            });
            // ⭐ END DEBUG
            
            const rankings = aggregateResults(results, eligiblePokemon, league);
            
            // ⭐ DEBUG: Comprehensive ranking analysis
            console.log('=== RANKING DEBUG ===');
            console.log('Total Pokemon ranked:', rankings.length);
            
            // Top 10
            console.log('Top 10:', rankings.slice(0, 10).map(r => ({
                name: r.name,
                form: r.form,
                shadow: r.isShadow,
                rawScore: r.rawScore.toFixed(2),
                displayRank: r.displayRank.toFixed(2)
            })));
            
            // Score distribution
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
            
            // Check for suspicious scores (too high or too low)
            const suspiciouslyHigh = rankings.filter(r => r.rawScore > 950);
            const suspiciouslyLow = rankings.filter(r => r.rawScore < 400);
            console.log('Suspiciously high scores (>950):', suspiciouslyHigh.length);
            if (suspiciouslyHigh.length > 0 && suspiciouslyHigh.length < 20) {
                console.log('High scorers:', suspiciouslyHigh.map(r => ({
                    name: r.name,
                    rawScore: r.rawScore.toFixed(2),
                    scenarios: r.scenarioScores
                })));
            }
            console.log('Suspiciously low scores (<400):', suspiciouslyLow.length);
            
            // Deino specific
            const deinoRank = rankings.findIndex(r => r.name === 'Deino' && !r.isShadow);
            if (deinoRank !== -1) {
                const deino = rankings[deinoRank];
                console.log('Deino details:', {
                    rank: deinoRank + 1,
                    displayRank: deino.displayRank.toFixed(2),
                    rawScore: deino.rawScore.toFixed(2),
                    scenarioScores: deino.scenarioScores
                });
                
                // Pokemon right above and below Deino
                console.log('Pokemon ranked around Deino:');
                for (let i = Math.max(0, deinoRank - 2); i <= Math.min(rankings.length - 1, deinoRank + 2); i++) {
                    console.log(`  #${i+1}: ${rankings[i].name} - raw: ${rankings[i].rawScore.toFixed(2)}, display: ${rankings[i].displayRank.toFixed(2)}`);
                }
            }
            
            // Ducklett specific
            const ducklettRank = rankings.findIndex(r => r.name === 'Ducklett' && !r.isShadow);
            if (ducklettRank !== -1) {
                const ducklett = rankings[ducklettRank];
                console.log('Ducklett details:', {
                    rank: ducklettRank + 1,
                    displayRank: ducklett.displayRank.toFixed(2),
                    rawScore: ducklett.rawScore.toFixed(2),
                    scenarioScores: ducklett.scenarioScores
                });
            }
            // ⭐ END DEBUG
            
            results.clear();
            movesets.length = 0;
            
            return rankings;
        }
        
        function recordBestResult(pokemonData, scenario, rating, moveset) {
            // Track best score for this scenario
            if (!pokemonData.bestScores[scenario] || rating > pokemonData.bestScores[scenario]) {
                pokemonData.bestScores[scenario] = rating;
                pokemonData.bestMovesets[scenario] = {
                    fast: moveset.fast.rawId,
                    charged: moveset.charged.map(m => m.rawId)
                };
            }
            
            // Tally moves if this was a winning matchup
            if (rating > 500) {
                const movesetKey = getMovesetKey(moveset);
                if (!pokemonData.moveTallies[movesetKey]) {
                    pokemonData.moveTallies[movesetKey] = {
                        fast: moveset.fast.rawId,
                        charged: moveset.charged.map(m => m.rawId),
                        wins: 0
                    };
                }
                pokemonData.moveTallies[movesetKey].wins++;
            }
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

        function calculateTotalBattles(movesets, scenarios) {
            // Not used anymore, but keeping for compatibility
            return 0;
        }

        function isScenarioSymmetric(scenario) {
            return scenario === 'leads' || scenario === 'closers';
        }

        function calculateTotalBattles(movesets, scenarios) {
            const n = movesets.length;
            const symmetricScenarios = scenarios.filter(s => isScenarioSymmetric(s)).length;
            const asymmetricScenarios = scenarios.length - symmetricScenarios;
            
            const symmetricBattles = (n * (n - 1)) / 2 * symmetricScenarios;
            const asymmetricBattles = n * (n - 1) * asymmetricScenarios;
            
            return symmetricBattles + asymmetricBattles;
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
            
            // Use the leagueData we attached in getEligiblePokemon
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

        function aggregateResults(results, eligiblePokemon, league) {
            console.log('=== AGGREGATION DEBUG ===');
            console.log('Total results to aggregate:', results.size);
            
            // Sample a few random Pokemon to check their data
            const sampleNames = ['Deino', 'Ducklett', 'Cottonee', 'Wynaut'];
            for (const name of sampleNames) {
                const pokemonResult = Array.from(results.values()).find(r => r.name === name && !r.isShadow);
                if (pokemonResult) {
                    console.log(`${name} pre-aggregation:`, {
                        bestScoresCount: Object.keys(pokemonResult.bestScores).length,
                        moveTalliesCount: Object.keys(pokemonResult.moveTallies).length,
                        sampleScore: pokemonResult.bestScores['leads']
                    });
                }
            }
                
                const rankings = [];            
            for (const [variantId, data] of results.entries()) {
                // Find the moveset with most wins
                let bestMoveset = null;
                let maxWins = 0;
                
                for (const [movesetKey, tallyData] of Object.entries(data.moveTallies)) {
                    if (tallyData.wins > maxWins) {
                        maxWins = tallyData.wins;
                        bestMoveset = {
                            fast: tallyData.fast,
                            charged: tallyData.charged
                        };
                    }
                }
                
                // If no winning matchups, use the moveset from best scenario
                if (!bestMoveset) {
                    const bestScenario = Object.keys(data.bestScores)[0];
                    if (bestScenario && data.bestMovesets[bestScenario]) {
                        bestMoveset = data.bestMovesets[bestScenario];
                    }
                }
                
                // Calculate geometric mean of scenario scores
                const scenarioScores = data.bestScores;
                const scores = Object.values(scenarioScores);
                
                if (scores.length === 0) continue;
                
                const geometricMean = Math.pow(
                    scores.reduce((a, b) => a * b, 1),
                    1 / scores.length
                );
                
                // Find primary role (best scenario)
                let bestRole = '';
                let bestScoreValue = 0;
                for (const [scenario, score] of Object.entries(scenarioScores)) {
                    if (score > bestScoreValue) {
                        bestScoreValue = score;
                        bestRole = scenario;
                    }
                }
                
                // Calculate move usage
                const moveUsage = {};
                for (const tallyData of Object.values(data.moveTallies)) {
                    moveUsage[tallyData.fast] = (moveUsage[tallyData.fast] || 0) + tallyData.wins;
                    for (const chargedId of tallyData.charged) {
                        moveUsage[chargedId] = (moveUsage[chargedId] || 0) + tallyData.wins;
                    }
                }
                
                if (bestMoveset) {
                    rankings.push({
                        speciesId: data.speciesId,
                        name: data.name,
                        form: data.form,
                        isShadow: data.isShadow,
                        recommendedMoveset: bestMoveset,
                        role: bestRole,
                        rawScore: geometricMean,
                        displayRank: 0,
                        scenarioScores: scenarioScores,
                        moveUsage: moveUsage
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
            
            rankings.sort((a, b) => b.displayRank - a.displayRank);
            
            return rankings;
        }

        async function runBattleSimulations() {
            const btn = document.getElementById('sim-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Simulating...';
            
            try {
                // Get selected cups
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
                    // Fixed parameter order: allPokemon, allMoves, selectedCups, typeChart, typeOrder
                    await calculateRankings(
                        allPokemon, 
                        allMoves, 
                        selectedCups,
                        damageMatrixData.matrix,      // This is typeChart
                        damageMatrixData.defenderTypes // This is typeOrder
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