// ====================================
// catchReport.js - CATCH REPORT MODULE
// ====================================

class CatchReport {
    constructor(app) {
        this.app = app;
        this.viabilityThreshold = 75; // IV efficiency threshold for PvP viability
        this.currentPokemon = null;
        
        // Standard leagues configuration
        this.standardLeagues = [
            { name: 'Little League', cpLimit: 500, property: 'little' },
            { name: 'Great League', cpLimit: 1500, property: 'great' },
            { name: 'Ultra League', cpLimit: 2500, property: 'ultra' },
            { name: 'Master League', cpLimit: null, property: 'master' }
        ];
    }

    // ====================================
    // MAIN ENTRY POINT
    // ====================================
    
    async analyzeSinglePokemon(pokemonId) {
        try {
            const userPokemon = await this.loadUserPokemon(pokemonId);
            if (!userPokemon) {
                this.showError('Pokemon not found in database');
                return;
            }
            
            this.currentPokemon = userPokemon;
            
            // Show loading modal
            this.showAnalyzingModal();
            
            // Run only size check first
            const sizeCheck = await this.checkSize(userPokemon);
            
            // Hide loading modal
            this.hideAnalyzingModal();
            
            // Show report immediately with loading state for PvP
            const analysisResults = {
                sizeCheck: sizeCheck,
                pvpRoles: null, // Will be populated async
                pveRoles: null
            };
            
            this.showReport(userPokemon, analysisResults);
            
            // Now run PvP simulations in background
            this.runPvPSimulations(userPokemon);
            
        } catch (error) {
            console.error('Error analyzing Pokemon:', error);
            this.hideAnalyzingModal();
            this.showError('Failed to analyze Pokemon: ' + error.message);
        }
    }

    async runPvPSimulations(userPokemon) {
        try {
            const pvpRoles = await this.checkPvP(userPokemon);
            
            // Update the report with results
            this.updatePvPSection(pvpRoles);
            
        } catch (error) {
            console.error('Error running PvP simulations:', error);
            this.showPvPError();
        }
    }

    updatePvPSection(pvpRoles) {
        const pvpSection = document.querySelector('[data-pvp-section]');
        if (!pvpSection) return;
        
        // Replace the loading state with actual results
        pvpSection.outerHTML = this.renderPvPSection(pvpRoles);
        
        // Re-attach listeners for the new PvP role elements
        this.attachPvPRoleListeners(pvpRoles);
    }

    showPvPError() {
        const pvpSection = document.querySelector('[data-pvp-section]');
        if (!pvpSection) return;
        
        pvpSection.innerHTML = `
            <h2 class="text-xl font-bold mb-4">PvP</h2>
            <div class="text-center py-8">
                <i class="fa-solid fa-exclamation-circle text-red-500 text-4xl mb-3"></i>
                <p class="text-gray-600">Failed to run simulations</p>
            </div>
        `;
    }

    attachPvPRoleListeners(pvpRoles) {
        const modal = document.querySelector('[data-modal="catch-report"]');
        if (!modal) return;
        
        modal.querySelectorAll('[data-pvp-role]').forEach(roleEl => {
            roleEl.addEventListener('click', () => {
                // Toggle selection
                modal.querySelectorAll('[data-pvp-role]').forEach(el => {
                    el.classList.remove('border-blue-500', 'bg-blue-50');
                });
                roleEl.classList.add('border-blue-500', 'bg-blue-50');
                
                const roleIndex = parseInt(roleEl.dataset.pvpRole);
                this.selectedPvPRole = pvpRoles[roleIndex];
            });
        });
    }

    // ====================================
    // SIZE CHECK
    // ====================================
    
    async checkSize(userPokemon) {
        // Only check if XXL or XXS is flagged and we have measurements
        if ((!userPokemon.xxl && !userPokemon.xxs) || !userPokemon.weight || !userPokemon.height) {
            return null;
        }
        
        // Get Pokemon data for std dev
        const pokemonData = await this.getPokemonData(userPokemon.name, userPokemon.form);
        if (!pokemonData || !pokemonData.weightStdDev || !pokemonData.heightStdDev) {
            return null;
        }
        
        // Calculate z-scores
        const weightZScore = (userPokemon.weight - pokemonData.pokedexWeightKg) / pokemonData.weightStdDev;
        const heightZScore = (userPokemon.height - pokemonData.pokedexHeightM) / pokemonData.heightStdDev;
        
        // Calculate combined z-score (product of absolutes, then restore sign)
        const combinedZScore = Math.abs(weightZScore * heightZScore) * (userPokemon.xxs ? -1 : 1);
        
        // Get evolution family
        const evolutionFamily = await this.getEvolutionFamily(pokemonData);
        
        // Get all user Pokemon in this family
        const userCollection = await this.getAllUserPokemon();
        const familyPokemon = userCollection.filter(p => 
            evolutionFamily.some(fam => fam.name === p.name && (fam.form || null) === (p.form || null))
        );
        
        // Determine which role to check based on XXL/XXS flag
        const checkLargest = userPokemon.xxl;
        const checkSmallest = userPokemon.xxs;
        
        let isLargest = false;
        let isSmallest = false;
        let previousLargest = null;
        let previousSmallest = null;
        
        // Compare z-scores only for the relevant role
        for (const familyMon of familyPokemon) {
            if (familyMon.id === userPokemon.id) continue;
            if (!familyMon.weight || !familyMon.height) continue;
            
            const famWeightZ = (familyMon.weight - pokemonData.pokedexWeightKg) / pokemonData.weightStdDev;
            const famHeightZ = (familyMon.height - pokemonData.pokedexHeightM) / pokemonData.heightStdDev;
            const famCombinedZ = Math.abs(famWeightZ * famHeightZ) * (familyMon.xxs ? -1 : 1);
            
            if (checkLargest && famCombinedZ > combinedZScore) {
                isLargest = false;
            }
            if (checkSmallest && famCombinedZ < combinedZScore) {
                isSmallest = false;
            }
            
            // Track who had the role before
            if (familyMon.roles && familyMon.roles.includes('Largest of Family')) {
                previousLargest = familyMon;
            }
            if (familyMon.roles && familyMon.roles.includes('Smallest of Family')) {
                previousSmallest = familyMon;
            }
        }
        
        // Set the appropriate flag based on what we're checking
        if (checkLargest) {
            isLargest = true; // Assume true unless proven false above
        }
        if (checkSmallest) {
            isSmallest = true; // Assume true unless proven false above
        }
        
        if (isLargest || isSmallest) {
            return {
                isLargest,
                isSmallest,
                combinedZScore,
                previousLargest,
                previousSmallest,
                recommendation: 'KEEP'
            };
        }
        
        return null;
    }

    // ====================================
    // PVP CHECK
    // ====================================
    
    async checkPvP(userPokemon) {
        const pvpRoles = [];
        
        console.log('🔍 Starting PvP check for:', userPokemon.name);
        
        // Load required data
        const [pokemonData, allMoves, typeData] = await Promise.all([
            this.getPokemonData(userPokemon.name, userPokemon.form),
            this.loadAllMoves(),
            this.loadTypeChart()
        ]);
        
        if (!pokemonData) {
            console.error('❌ No Pokemon data found');
            return pvpRoles;
        }
        
        // Get evolution chain (forward only)
        const evolutionChain = await this.getEvolutionChain(pokemonData);

        // Only keep the current Pokemon and its forward evolutions
        const caughtIndex = evolutionChain.findIndex(e => e.name === userPokemon.name && (e.form || null) === (userPokemon.form || null));
        const forwardChain = caughtIndex >= 0 ? evolutionChain.slice(caughtIndex) : evolutionChain;

        // Check each evolution
        for (const evolution of forwardChain) {
            this.updateAnalyzingStatus(`Analyzing ${evolution.name}...`);
            
            // Check each league
            for (const league of this.standardLeagues) {
                const leagueData = evolution[league.property];
                
                if (!leagueData) {
                    console.log(`  📍 ${league.name}: No league data`);
                    continue;
                }
                
                // Special handling for Little League (500 CP)
                if (league.cpLimit === 500) {
                    const allPokemon = await this.getAllPokemonData();
                    
                    // Check if this is a first-stage that can evolve
                    const hasEvolutions = evolution.evolutions && evolution.evolutions.length > 0;
                    const isFirstStage = !allPokemon.some(other => 
                        other.evolutions && other.evolutions.some(evo => 
                            evo.name === evolution.name && (evo.form === evolution.form || (!evo.form && !evolution.form))
                        )
                    );
                    
                    const isEligibleForLittle = hasEvolutions && isFirstStage;
                    
                    // Simulate Little League if eligible (first-stage that can evolve)
                    if (isEligibleForLittle) {
                        const maxCPWithIVs = this.calculateCP(evolution.stats, userPokemon.ivs, 50);
                        
                        if (userPokemon.cp < league.cpLimit && maxCPWithIVs >= league.cpLimit - 100) {
                            const ivEfficiency = await this.calculateIVEfficiency(userPokemon.ivs, leagueData, evolution.stats, league);
                            
                            this.updateAnalyzingStatus(`Simulating ${evolution.name} in ${league.name}...`);
                            
                            const adjustedLevel = await this.findOptimalLevel(
                                evolution,
                                userPokemon.ivs,
                                league,
                                leagueData.level
                            );
                            
                            const [regularResults, antiMetaResults] = await Promise.all([
                                this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, league, allMoves, typeData, false),
                                this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, league, allMoves, typeData, true)
                            ]);
                            
                            if (regularResults) {
                                const leagueId = this.getLeagueId(league.name);
                                const rankings = await this.loadRankings(leagueId);
                                const beatsExisting = await this.checkIfBeatsExisting(evolution.name, evolution.form, league.name, regularResults.rawScore);
                                
                                let speciesBestRank = null;
                                let speciesBestAntiMetaRank = null;
                                if (rankings && rankings.rankings) {
                                    const speciesRankings = rankings.rankings.filter(r => 
                                        r.name === evolution.name && (r.form || null) === (evolution.form || null)
                                    );
                                    if (speciesRankings.length > 0) {
                                        speciesBestRank = Math.max(...speciesRankings.map(r => r.displayRank));
                                    }
                                }
                                
                                const antiMetaRankings = await this.loadRankings(`antimeta-${leagueId}`);
                                if (antiMetaRankings && antiMetaRankings.rankings) {
                                    const speciesAntiMeta = antiMetaRankings.rankings.filter(r => 
                                        r.name === evolution.name && (r.form || null) === (evolution.form || null)
                                    );
                                    if (speciesAntiMeta.length > 0) {
                                        speciesBestAntiMetaRank = Math.max(...speciesAntiMeta.map(r => r.displayRank));
                                    }
                                }
                                
                                pvpRoles.push({
                                    evolution: evolution.name,
                                    form: evolution.form || null,
                                    league: league.name,
                                    ivEfficiency: Math.round(ivEfficiency * 10) / 10,
                                    level: adjustedLevel,
                                    cp: this.calculateCP(evolution.stats, userPokemon.ivs, adjustedLevel),
                                    rating: regularResults.rawScore,
                                    displayRank: regularResults.displayRank,
                                    speciesBestRank: speciesBestRank,
                                    speciesBestAntiMetaRank: speciesBestAntiMetaRank,
                                    antiMetaRating: antiMetaResults ? antiMetaResults.rawScore : null,
                                    antiMetaDisplayRank: antiMetaResults ? antiMetaResults.displayRank : null,
                                    recommendedMoveset: regularResults.recommendedMoveset,
                                    scenarioScores: regularResults.scenarioScores,
                                    bestMatchups: regularResults.bestMatchups,
                                    worstMatchups: regularResults.worstMatchups,
                                    beatsExisting: beatsExisting,
                                    needsXL: adjustedLevel > 40
                                });
                            }
                        }
                    }
                    
                    // Simulate Little Jungle (all Pokemon eligible)
                    const maxCPWithIVs = this.calculateCP(evolution.stats, userPokemon.ivs, 50);
                    
                    if (userPokemon.cp < league.cpLimit && maxCPWithIVs >= league.cpLimit - 100) {
                        const ivEfficiency = await this.calculateIVEfficiency(userPokemon.ivs, leagueData, evolution.stats, league);
                        
                        const littleJungleLeague = { name: 'Little Jungle', cpLimit: 500, property: 'little' };
                        
                        this.updateAnalyzingStatus(`Simulating ${evolution.name} in Little Jungle...`);
                        
                        const adjustedLevel = await this.findOptimalLevel(
                            evolution,
                            userPokemon.ivs,
                            littleJungleLeague,
                            leagueData.level
                        );
                        
                        const [regularResults, antiMetaResults] = await Promise.all([
                            this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, littleJungleLeague, allMoves, typeData, false),
                            this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, littleJungleLeague, allMoves, typeData, true)
                        ]);
                        
                        if (regularResults) {
                            const leagueId = 'combat-league-vs-seeker-great-little-jungle';
                            const rankings = await this.loadRankings(leagueId);
                            const beatsExisting = await this.checkIfBeatsExisting(evolution.name, evolution.form, 'Little Jungle', regularResults.rawScore);
                            
                            let speciesBestRank = null;
                            let speciesBestAntiMetaRank = null;
                            if (rankings && rankings.rankings) {
                                const speciesRankings = rankings.rankings.filter(r => 
                                    r.name === evolution.name && (r.form || null) === (evolution.form || null)
                                );
                                if (speciesRankings.length > 0) {
                                    speciesBestRank = Math.max(...speciesRankings.map(r => r.displayRank));
                                }
                            }
                            
                            const antiMetaRankings = await this.loadRankings(`antimeta-${leagueId}`);
                            if (antiMetaRankings && antiMetaRankings.rankings) {
                                const speciesAntiMeta = antiMetaRankings.rankings.filter(r => 
                                    r.name === evolution.name && (r.form || null) === (evolution.form || null)
                                );
                                if (speciesAntiMeta.length > 0) {
                                    speciesBestAntiMetaRank = Math.max(...speciesAntiMeta.map(r => r.displayRank));
                                }
                            }
                            
                            pvpRoles.push({
                                evolution: evolution.name,
                                form: evolution.form || null,
                                league: 'Little Jungle',
                                ivEfficiency: Math.round(ivEfficiency * 10) / 10,
                                level: adjustedLevel,
                                cp: this.calculateCP(evolution.stats, userPokemon.ivs, adjustedLevel),
                                rating: regularResults.rawScore,
                                displayRank: regularResults.displayRank,
                                speciesBestRank: speciesBestRank,
                                speciesBestAntiMetaRank: speciesBestAntiMetaRank,
                                antiMetaRating: antiMetaResults ? antiMetaResults.rawScore : null,
                                antiMetaDisplayRank: antiMetaResults ? antiMetaResults.displayRank : null,
                                recommendedMoveset: regularResults.recommendedMoveset,
                                scenarioScores: regularResults.scenarioScores,
                                bestMatchups: regularResults.bestMatchups,
                                worstMatchups: regularResults.worstMatchups,
                                beatsExisting: beatsExisting,
                                needsXL: adjustedLevel > 40
                            });
                        }
                    }
                    
                    continue; // Skip to next league after handling Little
                }
                
                // Calculate max CP this Pokemon can reach with its IVs
                const maxCPWithIVs = this.calculateCP(evolution.stats, userPokemon.ivs, 50);
                
                // Check eligibility for this league
                if (league.cpLimit) {
                    // Current CP must be under the limit
                    if (userPokemon.cp >= league.cpLimit) {
                        continue;
                    }
                    
                    // Max CP with IVs must be within 100 of the limit
                    if (maxCPWithIVs < league.cpLimit - 100) {
                        continue;
                    }
                } else {
                    // Master League - only eligible if can reach Ultra League
                    if (maxCPWithIVs < 2400) {
                        continue;
                    }
                }
                
                // Calculate IV efficiency
                const ivEfficiency = await this.calculateIVEfficiency(userPokemon.ivs, leagueData, evolution.stats, league);
                
                // Always add role, regardless of threshold
                this.updateAnalyzingStatus(`Simulating ${evolution.name} in ${league.name}...`);
                
                // Adjust level to stay under CP limit
                const adjustedLevel = await this.findOptimalLevel(
                    evolution,
                    userPokemon.ivs,
                    league,
                    leagueData.level
                );
                
                
                // Simulate battles
                const [regularResults, antiMetaResults] = await Promise.all([
                    this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, league, allMoves, typeData, false),
                    this.simulatePokemon(evolution, userPokemon.ivs, adjustedLevel, league, allMoves, typeData, true)
                ]);
                console.log(`    ⚔️  Simulation results:`, {
                    regular: regularResults ? regularResults.rawScore.toFixed(1) : 'null',
                    antiMeta: antiMetaResults ? antiMetaResults.rawScore.toFixed(1) : 'null'
                });
                
                if (regularResults) {
                    // Load rankings for species best comparison
                    const leagueId = this.getLeagueId(league.name);
                    const rankings = await this.loadRankings(leagueId);

                    // Check if this beats existing Pokemon with same role
                    const beatsExisting = await this.checkIfBeatsExisting(
                        evolution.name,
                        evolution.form,
                        league.name,
                        regularResults.rawScore
                    );
                    
                    // Find the best displayRank for this species in the rankings
                    let speciesBestRank = null;
                    let speciesBestAntiMetaRank = null;
                    if (rankings && rankings.rankings) {
                        const speciesRankings = rankings.rankings.filter(r => 
                            r.name === evolution.name && 
                            (r.form || null) === (evolution.form || null)
                        );
                        if (speciesRankings.length > 0) {
                            speciesBestRank = Math.max(...speciesRankings.map(r => r.displayRank));
                        }
                    }

                    // Load anti-meta rankings for species best
                    const antiMetaRankings = await this.loadRankings(`antimeta-${leagueId}`);
                    if (antiMetaRankings && antiMetaRankings.rankings) {
                        const speciesAntiMeta = antiMetaRankings.rankings.filter(r => 
                            r.name === evolution.name && 
                            (r.form || null) === (evolution.form || null)
                        );
                        if (speciesAntiMeta.length > 0) {
                            speciesBestAntiMetaRank = Math.max(...speciesAntiMeta.map(r => r.displayRank));
                        }
                    }

                    pvpRoles.push({
                        evolution: evolution.name,
                        form: evolution.form || null,
                        league: league.name,
                        ivEfficiency: Math.round(ivEfficiency * 10) / 10,
                        level: adjustedLevel,
                        cp: this.calculateCP(evolution.stats, userPokemon.ivs, adjustedLevel),
                        rating: regularResults.rawScore,
                        displayRank: regularResults.displayRank,
                        speciesBestRank: speciesBestRank,
                        speciesBestAntiMetaRank: speciesBestAntiMetaRank,
                        antiMetaRating: antiMetaResults ? antiMetaResults.rawScore : null,
                        antiMetaDisplayRank: antiMetaResults ? antiMetaResults.displayRank : null,
                        recommendedMoveset: regularResults.recommendedMoveset,
                        scenarioScores: regularResults.scenarioScores,
                        bestMatchups: regularResults.bestMatchups,
                        worstMatchups: regularResults.worstMatchups,
                        beatsExisting: beatsExisting,
                        needsXL: adjustedLevel > 40
                    });
                    
                } else {
                    console.log(`    ❌ No simulation results`);
                }
            }
        }
        
        // Sort by rating descending
        pvpRoles.sort((a, b) => b.rating - a.rating);
        console.log('Finished all loops. Final pvpRoles length:', pvpRoles.length);
        console.log('Final pvpRoles:', pvpRoles);
        return pvpRoles;
    }

    async findOptimalLevel(pokemon, ivs, league, startLevel) {
        if (!league.cpLimit) {
            // Master League - use level 50
            return 50;
        }
        
        const cpm = this.app.screenshotProcessor.cpm;
        let level = startLevel;
        
        // Check if we're already over at the starting level
        let cp = this.calculateCPAtLevel(pokemon.stats, ivs, level, cpm);
        
        if (cp > league.cpLimit) {
            // Need to go down
            while (level > 1 && cp > league.cpLimit) {
                level -= 0.5;
                cp = this.calculateCPAtLevel(pokemon.stats, ivs, level, cpm);
            }
        } else {
            // Try to go up
            while (level < 50) {
                const nextLevel = level + 0.5;
                const nextCP = this.calculateCPAtLevel(pokemon.stats, ivs, nextLevel, cpm);
                if (nextCP > league.cpLimit) break;
                level = nextLevel;
                cp = nextCP;
            }
        }
        
        return level;
    }

    calculateCPAtLevel(stats, ivs, level, cpm) {
        const levelIndex = Math.round((level - 1) * 2);
        const cpmValue = cpm[levelIndex];
        
        return Math.max(10, Math.floor(
            (stats.attack + ivs.atk) * 
            Math.sqrt(stats.defense + ivs.def) * 
            Math.sqrt(stats.hp + ivs.sta) *
            cpmValue * cpmValue / 10
        ));
    }

    async calculateIVEfficiency(userIVs, leagueData, baseStats, league) {
        // Master League is simple - just sum of IVs
        if (!league.cpLimit) {
            const ivSum = userIVs.atk + userIVs.def + userIVs.sta;
            return (ivSum / 45) * 100;
        }
        
        const cpm = this.app.screenshotProcessor.cpm;
        
        // Find the optimal level for the USER'S IVs under the league cap
        const userOptimalLevel = await this.findOptimalLevel(
            { stats: baseStats },
            userIVs,
            league,
            50 // Start from level 50 and work down
        );
        
        // Calculate stat product with user's IVs at THEIR optimal level
        const userLevelIndex = Math.round((userOptimalLevel - 1) * 2);
        const userCpmValue = cpm[userLevelIndex];
        const userAttack = (baseStats.attack + userIVs.atk) * userCpmValue;
        const userDefense = (baseStats.defense + userIVs.def) * userCpmValue;
        const userStamina = Math.floor((baseStats.hp + userIVs.sta) * userCpmValue);
        const userSP = userAttack * userDefense * userStamina;
        
        // Use pre-calculated max/min SP from league data
        const maxSP = leagueData.maxSP;
        const minSP = leagueData.minSP;
        
        // Normalize to 0-100 scale
        if (maxSP === minSP) {
            return 100;
        }
        
        return ((userSP - minSP) / (maxSP - minSP)) * 100;
    }

    async simulatePokemon(pokemon, ivs, level, league, allMoves, typeData, isAntiMeta) {
        try {
            // Load rankings first (used for both opponents and caught Pokemon moveset)
        const leagueId = this.getLeagueId(league.name);
        const mainRankings = await this.loadRankings(leagueId); // Always load main rankings
        
        let opponents;

        if (isAntiMeta) {
            // Anti-meta: use top 50 from MAIN rankings
            if (!mainRankings || !mainRankings.rankings || mainRankings.rankings.length === 0) {
                console.warn(`No rankings found for ${leagueId}`);
                return null;
            }
            
            opponents = mainRankings.rankings.slice(0, 50);
        } else {
            // Regular: use all Pokemon with league data
            const allPokemon = await this.getAllPokemonData();
            opponents = allPokemon.filter(p => p[league.property] && p[league.property].level);
        }
        
        let opponentPokemon;

        if (isAntiMeta) {
            opponentPokemon = await Promise.all(
                opponents.map(async (ranking) => {
                    const pokData = await this.getPokemonData(ranking.name, ranking.form);
                    if (!pokData) return null;
                    return {
                        ...pokData,
                        isShadow: ranking.isShadow,
                        ranking: ranking
                    };
                })
            );
        } else {
            opponentPokemon = opponents.map(p => {
                const ranking = mainRankings?.rankings?.find(r => 
                    r.speciesId === p.id && 
                    (r.form || null) === (p.form || null) &&
                    r.isShadow === false
                );
                
                return ranking ? {
                    ...p,
                    ranking: ranking
                } : null;
            });
        }

        const validOpponents = opponentPokemon.filter(p => p !== null);
        
        // Find caught Pokemon's recommended moveset
        const caughtRanking = mainRankings?.rankings?.find(r =>
                r.name === pokemon.name && 
                (r.form || null) === (pokemon.form || null) &&
                r.isShadow === (pokemon.isShadow || false)
            );

            if (!caughtRanking) {
                console.warn(`No ranking found for ${pokemon.name} in ${leagueId}`);
                return null;
            }

            const pokemonWithRanking = {
                ...pokemon,
                ranking: caughtRanking
            };

            const caughtForSim = this.buildPokemonForSim(pokemonWithRanking, ivs, level, allMoves);
            if (!caughtForSim) return null;
            
            // Run battles
            const scenarios = [
                'leads', 'leads-baited', 'switches', 'switches-baited',
                'closers', 'attackers', 'attackers-baited', 'underdog'
            ];
            
            const results = {
                scenarioRatings: {},
                allMatchups: []
            };
            
            for (const opponent of validOpponents) {
                const opponentForSim = this.buildPokemonForSim(
                    opponent,
                    opponent[league.property].iv,
                    opponent[league.property].level,
                    allMoves
                );
                
                if (!opponentForSim) continue;
                
                for (const scenario of scenarios) {
                    const rating = this.simulateBattle(
                        caughtForSim,
                        opponentForSim,
                        scenario,
                        typeData.matrix,
                        typeData.defenderTypes
                    );
                    
                    if (!results.scenarioRatings[scenario]) {
                        results.scenarioRatings[scenario] = [];
                    }
                    results.scenarioRatings[scenario].push(rating);
                    
                    results.allMatchups.push({
                        opponent: opponent.name,
                        opponentForm: opponent.form || null,
                        opponentShadow: opponent.isShadow,
                        rating: rating,
                        scenario: scenario,
                        opponentMoveset: opponent.ranking.recommendedMoveset
                    });
                }
            }
            
            // Calculate scenario averages
            const scenarioScores = {};
            for (const [scenario, ratings] of Object.entries(results.scenarioRatings)) {
                scenarioScores[scenario] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            }
            
            // Calculate geometric mean
            const scores = Object.values(scenarioScores);
            const rawScore = Math.pow(
                scores.reduce((a, b) => a * b, 1),
                1 / scores.length
            );
            
            // Load rankings to calculate where this Pokemon would rank
            const rankingId = isAntiMeta ? `antimeta-${leagueId}` : leagueId;
            const rankings = await this.loadRankings(rankingId);

            let displayRank = null;
            if (rankings && rankings.rankings && rankings.rankings.length > 0) {
                // Find where this score would fit
                const betterCount = rankings.rankings.filter(r => r.rawScore > rawScore).length;
                const totalCount = rankings.rankings.length;
                
                // Calculate normalized rank (0-100 scale like in the rankings)
                displayRank = Math.round(((totalCount - betterCount) / totalCount) * 100 * 10) / 10;
            }

            console.log(`    ⚔️  Simulation results:`, {
                rawScore: rawScore,
                scenarioScores: scenarioScores,
                matchupsCount: results.allMatchups.length
            });

            // Sort matchups and get top/bottom 10
            const sortedMatchups = results.allMatchups.sort((a, b) => b.rating - a.rating);
            
            return {
                rawScore: rawScore,
                scenarioScores: scenarioScores,
                recommendedMoveset: caughtForSim.recommendedMoveset,
                bestMatchups: sortedMatchups.slice(0, 10),
                worstMatchups: sortedMatchups.slice(-10).reverse(),
                displayRank: displayRank
            };
            
        } catch (error) {
            console.error('Error simulating Pokemon:', error);
            return null;
        }
    }

    buildPokemonForSim(pokemon, ivs, level, allMoves) {
        const cpm = this.app.screenshotProcessor.cpm;
        const levelIndex = Math.round((level - 1) * 2);
        const cpmValue = cpm[levelIndex];
        
        const pvpMoves = allMoves.filter(m => m.mode === 'pvp');
        
        // Always use ranking's recommended moveset if available
        if (pokemon.ranking && pokemon.ranking.recommendedMoveset) {
            const fastMove = pvpMoves.find(m => 
                m.rawId === pokemon.ranking.recommendedMoveset.fast && m.category === 'fast'
            );
            const charged = pokemon.ranking.recommendedMoveset.charged.map(id =>
                pvpMoves.find(m => m.rawId === id && m.category === 'charge')
            ).filter(m => m);
            
            if (!fastMove || charged.length === 0) return null;
            
            return {
                name: pokemon.name,
                types: pokemon.types,
                stats: pokemon.stats,
                ivs: { atk: ivs.atk, def: ivs.def, sta: ivs.sta, cpm: cpmValue },
                fastMove: fastMove,
                chargedMoves: charged,
                isShadow: pokemon.isShadow || false,
                recommendedMoveset: pokemon.ranking.recommendedMoveset
            };
        }
        
        return null; // No ranking = can't simulate
    }

    simulateBattle(pokemon1, pokemon2, scenario, typeChart, typeOrder) {
        const shields = this.getShieldsForScenario(scenario);
        
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

    getShieldsForScenario(scenario) {
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

    async checkIfBeatsExisting(evolutionName, evolutionForm, leagueName, newRating) {
        const userCollection = await this.getAllUserPokemon();
        
        const existingWithRole = userCollection.filter(p => 
            p.roles && p.roles.some(role => 
                role.league === leagueName && 
                role.evolution === evolutionName &&
                (role.form || null) === (evolutionForm || null)
            )
        );
        
        const beaten = [];
        for (const existing of existingWithRole) {
            const role = existing.roles.find(r => 
                r.league === leagueName && 
                r.evolution === evolutionName
            );
            
            if (role && newRating > role.rating) {
                beaten.push({
                    pokemonId: existing.id,
                    nickname: existing.nickname || existing.name,
                    oldRating: role.rating,
                    difference: newRating - role.rating
                });
            }
        }
        
        return beaten.length > 0 ? beaten : null;
    }

    getLeagueId(leagueName) {
        const map = {
            'Little League': 'combat-league-vs-seeker-great-little',
            'Great League': 'combat-league-vs-seeker-great',
            'Ultra League': 'combat-league-vs-seeker-ultra',
            'Master League': 'combat-league-vs-seeker-master'
        };
        return map[leagueName] || 'combat-league-vs-seeker-great';
    }

    // ====================================
    // UI DISPLAY
    // ====================================
    
    showAnalyzingModal() {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="analyzing">
                <div class="bg-white rounded-2xl p-8 text-center max-w-md w-full">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p class="text-gray-700 font-semibold text-lg" data-status-text>Analyzing Pokémon...</p>
                    <p class="text-gray-500 text-sm mt-2">This may take a moment</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    updateAnalyzingStatus(message) {
        const statusText = document.querySelector('[data-modal="analyzing"] [data-status-text]');
        if (statusText) {
            statusText.textContent = message;
        }
    }

    hideAnalyzingModal() {
        const modal = document.querySelector('[data-modal="analyzing"]');
        if (modal) modal.remove();
    }

    showReport(userPokemon, analysisResults) {
        const reportHtml = `
            <div class="fixed inset-0 bg-gray-100 z-50 overflow-y-auto" data-modal="catch-report">
                <!-- Header -->
                <div class="bg-white shadow-md p-4 sticky top-0 z-10">
                    <div class="max-w-4xl mx-auto flex items-center gap-4">
                        ${userPokemon.spriteThumb ? `<img src="${URL.createObjectURL(userPokemon.spriteThumb)}" class="w-20 h-20 object-contain">` : ''}
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold">${userPokemon.name}${userPokemon.form ? ` (${userPokemon.form})` : ''}</h1>
                            <p class="text-gray-600">CP ${userPokemon.cp} • Level ${userPokemon.level || '?'} • ${userPokemon.ivs.atk}/${userPokemon.ivs.def}/${userPokemon.ivs.sta}</p>
                        </div>
                        <button class="text-2xl text-gray-500 hover:text-gray-700" data-action="close">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="max-w-4xl mx-auto p-4 space-y-4 pb-32">
                    ${this.renderSizeSection(analysisResults.sizeCheck)}
                    ${this.renderPvPSection(analysisResults.pvpRoles)}
                    ${this.renderPvESection(analysisResults.pveRoles)}
                </div>
                
                <!-- Decision Buttons -->
                <div class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
                    <div class="max-w-4xl mx-auto grid grid-cols-2 gap-4">
                        <button class="bg-red-500 text-white rounded-xl py-4 hover:bg-red-600 transition font-semibold text-lg" data-action="toss">
                            <i class="fa-solid fa-trash mr-2"></i>Toss
                        </button>
                        <button class="bg-green-500 text-white rounded-xl py-4 hover:bg-green-600 transition font-semibold text-lg" data-action="keep">
                            <i class="fa-solid fa-check mr-2"></i>Keep
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', reportHtml);
        this.attachReportListeners(userPokemon, analysisResults);
    }

    renderSizeSection(sizeCheck) {
        if (!sizeCheck) {
            return ''; // Return empty string to hide section completely
        }
        
        // Calculate percentile from z-score
        const percentile = this.zScoreToPercentile(sizeCheck.combinedZScore);
        const isLarger = sizeCheck.isLargest;
        const speciesName = this.currentPokemon.name;
        
        return `
            <div class="bg-white rounded-xl p-4 shadow border-l-4 border-green-500">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-bold text-lg">Size Check - Keep</h3>
                        <p class="text-gray-700">
                            ${isLarger ? 'Largest' : 'Smallest'} of its family, ${isLarger ? 'larger' : 'smaller'} than ${percentile}% of all ${speciesName}
                        </p>
                    </div>
                    <i class="fa-solid fa-check-circle text-green-500 text-3xl"></i>
                </div>
            </div>
        `;
    }

    zScoreToPercentile(zScore) {
        // Use cumulative distribution function for standard normal distribution
        const percentile = 50 * (1 + this.erf(zScore / Math.sqrt(2)));
        return percentile.toFixed(1);
    }

    erf(x) {
        // Abramowitz and Stegun approximation of error function
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return sign * y;
    }

    renderPvPSection(pvpRoles) {
        // If null (not yet loaded), show loading state
        if (pvpRoles === null) {
            return `
                <div class="bg-white rounded-xl p-6 shadow" data-pvp-section>
                    <h2 class="text-xl font-bold mb-4">PvP</h2>
                    <div class="text-center py-8">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p class="text-gray-600">Running simulations...</p>
                    </div>
                </div>
            `;
        }
        
        if (!pvpRoles || pvpRoles.length === 0) {
            return `
                <div class="bg-white rounded-xl p-6 shadow">
                    <h2 class="text-xl font-bold mb-2">PvP</h2>
                    <p class="text-gray-500">No PvP roles analyzed yet</p>
                </div>
            `;
        }
        
        const viableRoles = pvpRoles.filter(r => r.ivEfficiency >= this.viabilityThreshold);
        const belowThreshold = pvpRoles.filter(r => r.ivEfficiency < this.viabilityThreshold);
        
        return `
            <div class="bg-white rounded-xl p-6 shadow">
                <h2 class="text-xl font-bold mb-4">PvP</h2>
                
                ${viableRoles.length > 0 ? `
                    <div class="mb-4">
                        <h3 class="font-semibold text-green-600 mb-2">Viable Leagues (${viableRoles.length})</h3>
                        <div class="space-y-3">
                            ${viableRoles.map((role, index) => `
                                <div class="border-2 rounded-lg p-4 hover:border-blue-500 cursor-pointer transition" data-pvp-role="${pvpRoles.indexOf(role)}">
                                    <div class="flex justify-between items-start mb-2">
                                        <div>
                                            <p class="font-bold text-lg">
                                                ${role.evolution}${role.form ? ` (${role.form})` : ''} - ${role.league}
                                            </p>
                                           <p class="text-sm text-gray-600">
                                                Level ${role.level} • CP ${role.cp} • IV Efficiency: ${role.ivEfficiency}%
                                            </p>
                                            <p class="text-sm text-gray-600">
                                                Rank: ${role.displayRank !== null ? role.displayRank : 'Unranked'} • Anti-Meta: ${role.antiMetaDisplayRank !== null ? role.antiMetaDisplayRank : 'N/A'}
                                            </p>
                                            ${role.speciesBestRank ? `
                                                <p class="text-sm text-gray-600">
                                                    Species Best Rank: ${Math.round(role.speciesBestRank * 10) / 10} • Anti-Meta: ${role.speciesBestAntiMetaRank ? Math.round(role.speciesBestAntiMetaRank * 10) / 10 : 'N/A'}
                                                </p>
                                            ` : ''}
                                        </div>
                                        <div class="flex flex-col items-end gap-1">
                                            ${role.needsXL ? '<span class="bg-purple-500 text-white px-3 py-1 rounded-full text-sm">XL</span>' : ''}
                                            ${role.beatsExisting ? '<span class="bg-green-500 text-white px-3 py-1 rounded-full text-sm">Upgrade!</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-700">
                                        <p class="font-semibold">Recommended Moveset:</p>
                                        <p>${this.getMoveName(role.recommendedMoveset.fast)} / ${role.recommendedMoveset.charged.map(id => this.getMoveName(id)).join(' + ')}</p>
                                    </div>
                                    ${role.beatsExisting ? `
                                        <div class="mt-2 pt-2 border-t text-sm">
                                            <p class="font-semibold text-green-600">Beats existing:</p>
                                            ${role.beatsExisting.map(beat => `
                                                <p class="text-gray-600">• ${beat.nickname} (${beat.oldRating.toFixed(1)} → ${(beat.oldRating + beat.difference).toFixed(1)})</p>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <p class="text-gray-500 mb-4">No viable leagues found (threshold: ${this.viabilityThreshold}% IV efficiency)</p>
                `}
                
                ${belowThreshold.length > 0 ? `
                    <div class="border-t pt-4 mt-4">
                        <h3 class="font-semibold text-orange-600 mb-2">Below Threshold (${belowThreshold.length})</h3>
                        <div class="space-y-2">
                            ${belowThreshold.map(role => `
                                <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <div class="flex justify-between items-center">
                                        <div>
                                            <p class="font-semibold text-sm">
                                                ${role.evolution}${role.form ? ` (${role.form})` : ''} - ${role.league}
                                            </p>
                                            <p class="text-xs text-gray-600">
                                                IV Efficiency: ${role.ivEfficiency}% • Rating: ${role.rating.toFixed(1)}
                                            </p>
                                        </div>
                                        <span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">
                                            Below ${this.viabilityThreshold}%
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderPvESection(pveRoles) {
        return `
            <div class="bg-white rounded-xl p-6 shadow">
                <h2 class="text-xl font-bold mb-4">PvE</h2>
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-gray-50 rounded-lg text-center">
                        <p class="font-semibold mb-2">Gym/Raid</p>
                        <p class="text-xs text-gray-500">Coming Soon</p>
                    </div>
                    <div class="p-4 bg-gray-50 rounded-lg text-center">
                    <p class="font-semibold mb-2">Team Rocket</p>
                    <p class="text-xs text-gray-500">Coming Soon</p>
                    </div>
                    </div>
                    </div>
                    `;
        }

    getMoveName(rawId) {
        // Simple conversion - could be improved with move lookup
        return rawId.replace(/_/g, ' ').replace(' FAST', '').toLowerCase()
            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    attachReportListeners(userPokemon, analysisResults) {
        const modal = document.querySelector('[data-modal="catch-report"]');
        
        modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            if (confirm('Exit without making a decision? You can process this Pokémon later.')) {
                modal.remove();
            }
        });
        
        modal.querySelector('[data-action="toss"]').addEventListener('click', () => {
            this.handleToss(userPokemon);
        });
        
        modal.querySelector('[data-action="keep"]').addEventListener('click', () => {
            this.handleKeep(userPokemon, analysisResults);
        });
        
        // PvP role selection
        modal.querySelectorAll('[data-pvp-role]').forEach(roleEl => {
            roleEl.addEventListener('click', () => {
                // Toggle selection
                modal.querySelectorAll('[data-pvp-role]').forEach(el => {
                    el.classList.remove('border-blue-500', 'bg-blue-50');
                });
                roleEl.classList.add('border-blue-500', 'bg-blue-50');
                
                const roleIndex = parseInt(roleEl.dataset.pvpRole);
                this.selectedPvPRole = analysisResults.pvpRoles[roleIndex];
            });
        });
    }

    async handleToss(userPokemon) {
        if (!confirm('Delete this Pokémon permanently?')) return;
        
        try {
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            await new Promise((resolve, reject) => {
                dbRequest.onsuccess = () => {
                    const db = dbRequest.result;
                    const tx = db.transaction(['userPokemon'], 'readwrite');
                    const store = tx.objectStore('userPokemon');
                    
                    store.delete(userPokemon.id);
                    
                    tx.oncomplete = () => {
                        document.querySelector('[data-modal="catch-report"]')?.remove();
                        
                        // Check if there are more screenshots to process
                        if (this.app.screenshotProcessor.batchImages.length > 0) {
                            this.app.screenshotProcessor.currentBatchIndex++;
                            this.app.screenshotProcessor.processBatch();
                        } else {
                            // Show batch complete modal ONLY when truly done
                            this.showBatchCompleteModal();
                        }
                        resolve();
                    };
                    
                    tx.onerror = () => reject(tx.error);
                };
                
                dbRequest.onerror = () => reject(dbRequest.error);
            });
        } catch (error) {
            console.error('Error deleting Pokemon:', error);
            this.showError('Failed to delete Pokémon');
        }
    }

    async handleKeep(userPokemon, analysisResults) {
        try {
            // Build roles array
            const roles = [];
            
            // Add size role if applicable
            if (analysisResults.sizeCheck) {
                if (analysisResults.sizeCheck.isLargest) {
                    roles.push('Largest of Family');
                }
                if (analysisResults.sizeCheck.isSmallest) {
                    roles.push('Smallest of Family');
                }
                
                // Remove role from previous holder
                if (analysisResults.sizeCheck.previousLargest) {
                    await this.removeRoleFromPokemon(analysisResults.sizeCheck.previousLargest.id, 'Largest of Family');
                }
                if (analysisResults.sizeCheck.previousSmallest) {
                    await this.removeRoleFromPokemon(analysisResults.sizeCheck.previousSmallest.id, 'Smallest of Family');
                }
            }
            
            // Add selected PvP role if any
            if (this.selectedPvPRole) {
                roles.push({
                    type: 'pvp',
                    league: this.selectedPvPRole.league,
                    evolution: this.selectedPvPRole.evolution,
                    form: this.selectedPvPRole.form,
                    rating: this.selectedPvPRole.rating,
                    antiMetaRating: this.selectedPvPRole.antiMetaRating,
                    ivEfficiency: this.selectedPvPRole.ivEfficiency
                });
                
                // Set assigned evolution and moveset
                userPokemon.assignedEvolution = this.selectedPvPRole.evolution;
                userPokemon.assignedMoveset = {
                    fast: this.getMoveName(this.selectedPvPRole.recommendedMoveset.fast),
                    charge1: this.getMoveName(this.selectedPvPRole.recommendedMoveset.charged[0]),
                    charge2: this.selectedPvPRole.recommendedMoveset.charged[1] ? 
                        this.getMoveName(this.selectedPvPRole.recommendedMoveset.charged[1]) : null
                };
            }
            
            // Update Pokemon
            userPokemon.roles = roles;
            userPokemon.inQueue = false;
            
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            await new Promise((resolve, reject) => {
                dbRequest.onsuccess = () => {
                    const db = dbRequest.result;
                    const tx = db.transaction(['userPokemon'], 'readwrite');
                    const store = tx.objectStore('userPokemon');
                    
                    store.put(userPokemon);
                    
                    tx.oncomplete = () => {
                        document.querySelector('[data-modal="catch-report"]')?.remove();
                        
                        // Check if there are more screenshots to process
                        if (this.app.screenshotProcessor.batchImages.length > 0) {
                            this.app.screenshotProcessor.currentBatchIndex++;
                            this.app.screenshotProcessor.processBatch();
                        } else {
                            // Show batch complete modal ONLY when truly done
                            this.showBatchCompleteModal();
                        }
                        resolve();
                    };
                    
                    tx.onerror = () => reject(tx.error);
                };
                
                dbRequest.onerror = () => reject(dbRequest.error);
            });
        } catch (error) {
            console.error('Error keeping Pokemon:', error);
            this.showError('Failed to save Pokémon');
        }
    }

    showBatchCompleteModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center space-y-6">
                <div class="text-green-500">
                    <i class="fa-solid fa-circle-check text-6xl mb-4"></i>
                    <h2 class="text-3xl font-bold text-gray-800">Batch Complete!</h2>
                </div>
                
                <p class="text-gray-600">
                    All Pokémon have been processed and analyzed
                </p>
                
                <button class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition font-semibold" data-action="close">
                    <i class="fa-solid fa-home mr-2"></i>Return to Collection
                </button>
            </div>
        `;
        
        modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            modal.remove();
            this.app.render();
        });
        
        document.body.appendChild(modal);
    }

    async removeRoleFromPokemon(pokemonId, role) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                const getRequest = store.get(pokemonId);
                
                getRequest.onsuccess = () => {
                    const pokemon = getRequest.result;
                    if (pokemon && pokemon.roles) {
                        pokemon.roles = pokemon.roles.filter(r => r !== role);
                        store.put(pokemon);
                    }
                };
                
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    // ====================================
    // DATABASE HELPERS
    // ====================================

    async loadUserPokemon(pokemonId) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['userPokemon'], 'readonly');
                const store = tx.objectStore('userPokemon');
                
                const request = store.get(pokemonId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async getAllUserPokemon() {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['userPokemon'], 'readonly');
                const store = tx.objectStore('userPokemon');
                
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async getPokemonData(name, form) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['pokemon'], 'readonly');
                const store = tx.objectStore('pokemon');
                
                const id = form ? `${name}-${form}` : `${name}-base`;
                const request = store.get(id);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async loadAllMoves() {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['moves'], 'readonly');
                const store = tx.objectStore('moves');
                
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async loadTypeChart() {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['typeEffectiveness'], 'readonly');
                const store = tx.objectStore('typeEffectiveness');
                
                const request = store.get('damageMatrix');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async loadRankings(leagueId) {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['rankings'], 'readonly');
                const store = tx.objectStore('rankings');
                
                const request = store.get(leagueId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    async getEvolutionFamily(pokemon) {
        const family = [{ name: pokemon.name, form: pokemon.form || null }];
        
        // Get all Pokemon to search through
        const allPokemon = await this.getAllPokemonData();
        
        // Helper to add evolutions recursively
        const addEvolutions = async (currentPokemon) => {
            if (!currentPokemon.evolutions || currentPokemon.evolutions.length === 0) return;
            
            for (const evo of currentPokemon.evolutions) {
                const evoData = allPokemon.find(p => 
                    p.name === evo.name && (p.form || null) === (evo.form || null)
                );
                
                if (evoData && !family.some(f => f.name === evo.name && f.form === (evo.form || null))) {
                    family.push({ name: evo.name, form: evo.form || null });
                    await addEvolutions(evoData);
                }
            }
        };
        
        // Helper to find pre-evolutions
        const findPreEvolutions = (targetPokemon) => {
            for (const p of allPokemon) {
                if (p.evolutions && p.evolutions.some(e => 
                    e.name === targetPokemon.name && (e.form || null) === (targetPokemon.form || null)
                )) {
                    if (!family.some(f => f.name === p.name && f.form === (p.form || null))) {
                        family.push({ name: p.name, form: p.form || null });
                        findPreEvolutions(p);
                    }
                }
            }
        };
        
        // Build family both directions
        findPreEvolutions(pokemon);
        await addEvolutions(pokemon);
        
        return family;
    }

    async getEvolutionChain(pokemon) {
        const chain = [pokemon];
        
        if (!pokemon.evolutions || pokemon.evolutions.length === 0) {
            return chain;
        }
        
        // Recursively add all evolutions
        const addEvolutions = async (currentPokemon) => {
            if (!currentPokemon.evolutions) return;
            
            for (const evo of currentPokemon.evolutions) {
                const evoData = await this.getPokemonData(evo.name, evo.form);
                if (evoData) {
                    chain.push(evoData);
                    await addEvolutions(evoData);
                }
            }
        };
        
        await addEvolutions(pokemon);
        
        return chain;
    }

    async getAllPokemonData() {
        const dbRequest = indexedDB.open('PokemonGoDB');
        
        return new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
                const db = dbRequest.result;
                const tx = db.transaction(['pokemon'], 'readonly');
                const store = tx.objectStore('pokemon');
                
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            };
            
            dbRequest.onerror = () => reject(dbRequest.error);
        });
    }

    calculateCP(stats, ivs, level) {
        const cpm = this.app.screenshotProcessor.cpm;
        return this.calculateCPAtLevel(stats, ivs, level, cpm);
    }

    showError(message) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-6 text-center">
                <i class="fa-solid fa-exclamation-circle text-red-500 text-5xl mb-3"></i>
                <h2 class="text-xl font-bold mb-2">Error</h2>
                <p class="text-gray-600">${message}</p>
                <button class="mt-4 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300" onclick="this.closest('div').parentElement.remove()">
                    Close
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
}
// ====================================
// BATTLE SIMULATOR CLASS
// ====================================
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
            this.fastMoveCountdown[0] = this.p1.fastMove.duration + 1;
        }
        
        if (this.fastMoveCountdown[1] <= 0) {
            this.useFastMove(1);
            this.fastMoveCountdown[1] = this.p2.fastMove.duration + 1;
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
        
        const koMoves = attacker.chargedMoves.filter(move => {
            if (currentEnergy < move.energy) return false;
            const damage = this.calculateDamage(attacker, defender, move, attackerIndex, defenderIndex);
            return damage >= defenderHP;
        });
        
        if (koMoves.length > 0) {
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
            return { move, dpe, effectiveness, canAfford: currentEnergy >= move.energy };
        });
        
        moveScores.sort((a, b) => b.dpe - a.dpe);
        
        const bestMove = moveScores[0];
        const bestAffordable = moveScores.find(ms => currentEnergy >= ms.move.energy);
        
        if (!bestAffordable) return null;
        
        if (bestMove.canAfford) {
            return bestMove.move;
        }

        return null;
    }

    checkUrgency(attackerIndex, defenderIndex) {
        const opponent = defenderIndex === 0 ? this.p1 : this.p2;
        const myHP = this.hp[attackerIndex];
        
        for (const move of opponent.chargedMoves) {
            const potentialDamage = this.calculateDamage(
                opponent,
                attackerIndex === 0 ? this.p1 : this.p2,
                move,
                defenderIndex,
                attackerIndex
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
        const cpmValue = ivs.cpm;
        return (stats.attack + ivs.atk) * cpmValue;
    }

    calculateDefense(stats, ivs) {
        const cpmValue = ivs.cpm;
        return (stats.defense + ivs.def) * cpmValue;
    }

    calculateHP(stats, ivs) {
        const cpmValue = ivs.cpm;
        const hp = Math.max(10, Math.floor((stats.hp + ivs.sta) * cpmValue));
        
        if (!window.debuggedHP && isNaN(hp)) {
            console.log('NaN HP:', {
                stats_hp: stats.hp,
                ivs_sta: ivs.sta,
                ivs: ivs,
                cpmValue: cpmValue
            });
            window.debuggedHP = true;
        }
        
        return hp;
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