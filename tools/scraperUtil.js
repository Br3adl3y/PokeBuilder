const GAME_MASTER_URL = 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json';
        const DB_NAME = 'PokemonGoDB';
        const DB_VERSION = 2;
        let db = null;
        let spreadsheetData = null;

        // ============================================================
        // TYPE EFFECTIVENESS CALCULATOR
        // ============================================================

        const TYPES = [
            'NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE',
            'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG',
            'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'
        ];

        const BASE_CHART = {
            'NORMAL': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.625, 0.390625, 1, 1, 0.625, 1],
            'FIRE': [1, 0.625, 0.625, 1.6, 1, 1.6, 1, 1, 1, 1, 1, 1.6, 0.625, 1, 0.625, 1, 1.6, 1],
            'WATER': [1, 1.6, 0.625, 0.625, 1, 1, 1, 1, 1.6, 1, 1, 1, 1.6, 1, 0.625, 1, 1, 1],
            'GRASS': [1, 0.625, 1.6, 0.625, 1, 1, 1, 0.625, 1.6, 0.625, 1, 0.625, 1.6, 1, 0.625, 1, 0.625, 1],
            'ELECTRIC': [1, 1, 1.6, 0.625, 0.625, 1, 1, 1, 0.390625, 1.6, 1, 1, 1, 1, 0.625, 1, 1, 1],
            'ICE': [1, 0.625, 0.625, 1.6, 1, 0.625, 1, 1, 1.6, 1.6, 1, 1, 1, 1, 1.6, 1, 0.625, 1],
            'FIGHTING': [1.6, 1, 1, 1, 1, 1.6, 1, 0.625, 1, 0.625, 0.625, 0.625, 1.6, 0.390625, 1, 1.6, 1.6, 0.625],
            'POISON': [1, 1, 1, 1.6, 1, 1, 1, 0.625, 0.625, 1, 1, 1, 0.625, 0.625, 1, 1, 0.390625, 1.6],
            'GROUND': [1, 1.6, 1, 0.625, 1.6, 1, 1, 1.6, 1, 0.390625, 1, 0.625, 1.6, 1, 1, 1, 1.6, 1],
            'FLYING': [1, 1, 1, 1.6, 0.625, 1, 1.6, 1, 1, 1, 1, 1.6, 0.625, 1, 1, 1, 0.625, 1],
            'PSYCHIC': [1, 1, 1, 1, 1, 1, 1.6, 1.6, 1, 1, 0.625, 1, 1, 1, 1, 0.390625, 0.625, 1],
            'BUG': [1, 0.625, 1, 1.6, 1, 1, 0.625, 0.625, 1, 0.625, 1.6, 1, 1, 0.625, 1, 1.6, 0.625, 0.625],
            'ROCK': [1, 1.6, 1, 1, 1, 1.6, 0.625, 1, 0.625, 1.6, 1, 1.6, 1, 1, 1, 1, 0.625, 1],
            'GHOST': [0.390625, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6, 1, 1, 1.6, 1, 0.625, 1, 1],
            'DRAGON': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6, 1, 0.625, 0.390625],
            'DARK': [1, 1, 1, 1, 1, 1, 0.625, 1, 1, 1, 1.6, 1, 1, 1.6, 1, 0.625, 1, 0.625],
            'STEEL': [1, 0.625, 0.625, 1, 0.625, 1.6, 1, 1, 1, 1, 1, 1, 1.6, 1, 1, 1, 0.625, 1.6],
            'FAIRY': [1, 0.625, 1, 1, 1, 1, 1.6, 0.625, 1, 1, 1, 1, 1, 1, 1.6, 1.6, 0.625, 1]
        };

        function generateDualTypes() {
            const dualTypes = [];
            for (let i = 0; i < TYPES.length; i++) {
                for (let j = i + 1; j < TYPES.length; j++) {
                    dualTypes.push(`${TYPES[i]}/${TYPES[j]}`);
                }
            }
            return dualTypes;
        }

        function buildExpandedMatrix() {
            const dualTypes = generateDualTypes();
            const allTypes = [...TYPES, ...dualTypes];
            const matrix = [];
            
            for (let attackerIdx = 0; attackerIdx < TYPES.length; attackerIdx++) {
                const row = [];
                const attacker = TYPES[attackerIdx];
                
                for (let defenderIdx = 0; defenderIdx < TYPES.length; defenderIdx++) {
                    row.push(BASE_CHART[attacker][defenderIdx]);
                }
                
                for (const dualDefender of dualTypes) {
                    const [defType1, defType2] = dualDefender.split('/');
                    const defType1Idx = TYPES.indexOf(defType1);
                    const defType2Idx = TYPES.indexOf(defType2);
                    const mult = BASE_CHART[attacker][defType1Idx] * BASE_CHART[attacker][defType2Idx];
                    row.push(mult);
                }
                
                matrix.push(row);
            }
            
            return { matrix, allDefenders: allTypes };
        }

        function calculateDualPageRank(matrix, iterations = 30, dampingFactor = 0.85) {
            const n = matrix.length;
            let offensiveScores = new Array(n).fill(1 / n);
            let defensiveScores = new Array(n).fill(1 / n);
            const teleportProb = (1 - dampingFactor) / n;
            
            for (let iter = 0; iter < iterations; iter++) {
                const newOffensiveScores = new Array(n).fill(0);
                const newDefensiveScores = new Array(n).fill(0);
                
                for (let attackerIdx = 0; attackerIdx < n; attackerIdx++) {
                    for (let defenderIdx = 0; defenderIdx < n; defenderIdx++) {
                        const damage = matrix[attackerIdx][defenderIdx];
                        if (damage > 1.0) {
                            newOffensiveScores[attackerIdx] += (damage - 1.0) * defensiveScores[defenderIdx];
                        }
                    }
                }
                
                for (let defenderIdx = 0; defenderIdx < n; defenderIdx++) {
                    for (let attackerIdx = 0; attackerIdx < n; attackerIdx++) {
                        const damage = matrix[attackerIdx][defenderIdx];
                        
                        if (damage <= 0.4) {
                            newDefensiveScores[defenderIdx] += 2.0 * offensiveScores[attackerIdx];
                        } else if (damage < 0.7) {
                            newDefensiveScores[defenderIdx] += 1.0 * offensiveScores[attackerIdx];
                        } else if (damage >= 0.9 && damage <= 1.1) {
                            newDefensiveScores[defenderIdx] += 0.3 * offensiveScores[attackerIdx];
                        } else if (damage > 1.5) {
                            newDefensiveScores[defenderIdx] -= 0.5 * (damage - 1.0) * offensiveScores[attackerIdx];
                        }
                    }
                }
                
                for (let i = 0; i < n; i++) {
                    newDefensiveScores[i] = Math.max(0, newDefensiveScores[i]);
                }
                
                const offensiveSum = newOffensiveScores.reduce((a, b) => a + b, 0);
                const defensiveSum = newDefensiveScores.reduce((a, b) => a + b, 0);
                
                if (offensiveSum === 0 || defensiveSum === 0) break;
                
                offensiveScores = newOffensiveScores.map(s => dampingFactor * (s / offensiveSum) + teleportProb);
                defensiveScores = newDefensiveScores.map(s => dampingFactor * (s / defensiveSum) + teleportProb);
            }
            
            return { offensive: offensiveScores, defensive: defensiveScores };
        }

        function calculateOffensivePageRank(matrix, iterations = 30, dampingFactor = 0.85) {
            const n = matrix.length;
            let offensiveScores = new Array(n).fill(1 / n);
            let defensiveScores = new Array(n).fill(1 / n);
            const teleportProb = (1 - dampingFactor) / n;
            
            for (let iter = 0; iter < iterations; iter++) {
                const newOffensiveScores = new Array(n).fill(0);
                const newDefensiveScores = new Array(n).fill(0);
                
                for (let attackerIdx = 0; attackerIdx < n; attackerIdx++) {
                    for (let defenderIdx = 0; defenderIdx < n; defenderIdx++) {
                        const damage = matrix[attackerIdx][defenderIdx];
                        if (damage > 1.0) {
                            newOffensiveScores[attackerIdx] += (damage - 1.0) * defensiveScores[defenderIdx];
                        }
                        if (damage >= 0.9 && damage <= 1.1) {
                            newOffensiveScores[attackerIdx] += 0.2 * defensiveScores[defenderIdx];
                        }
                    }
                }
                
                for (let defenderIdx = 0; defenderIdx < n; defenderIdx++) {
                    for (let attackerIdx = 0; attackerIdx < n; attackerIdx++) {
                        const damage = matrix[attackerIdx][defenderIdx];
                        if (damage <= 0.4) {
                            newDefensiveScores[defenderIdx] += 2.0 * offensiveScores[attackerIdx];
                        } else if (damage < 0.7) {
                            newDefensiveScores[defenderIdx] += 1.0 * offensiveScores[attackerIdx];
                        } else if (damage >= 0.9 && damage <= 1.1) {
                            newDefensiveScores[defenderIdx] += 0.3 * offensiveScores[attackerIdx];
                        } else if (damage > 1.5) {
                            newDefensiveScores[defenderIdx] -= 0.5 * (damage - 1.0) * offensiveScores[attackerIdx];
                        }
                    }
                }
                
                for (let i = 0; i < n; i++) {
                    newDefensiveScores[i] = Math.max(0, newDefensiveScores[i]);
                }
                
                const offensiveSum = newOffensiveScores.reduce((a, b) => a + b, 0);
                const defensiveSum = newDefensiveScores.reduce((a, b) => a + b, 0);
                
                if (offensiveSum === 0 || defensiveSum === 0) break;
                
                offensiveScores = newOffensiveScores.map(s => dampingFactor * (s / offensiveSum) + teleportProb);
                defensiveScores = newDefensiveScores.map(s => dampingFactor * (s / defensiveSum) + teleportProb);
            }
            
            return offensiveScores;
        }

        async function calculateTypeEffectiveness() {
            updateStatus('⏳ Calculating type effectiveness rankings...');
            
            const { matrix, allDefenders } = buildExpandedMatrix();
            
            updateStatus('⏳ Running defensive PageRank (171 types)...');
            const dualScores = calculateDualPageRank(matrix, 30, 0.85);
            const maxDefScore = Math.max(...dualScores.defensive);
            const defensiveRankings = allDefenders.map((type, idx) => ({
                type: type,
                score: (dualScores.defensive[idx] / maxDefScore) * 100,
                offensiveScore: dualScores.offensive[idx],
                isDual: type.includes('/')
            })).sort((a, b) => b.score - a.score);
            
            updateStatus('⏳ Running offensive PageRank (18 types)...');
            const monoMatrix = [];
            for (let i = 0; i < TYPES.length; i++) {
                const row = [];
                for (let j = 0; j < TYPES.length; j++) {
                    row.push(BASE_CHART[TYPES[i]][j]);
                }
                monoMatrix.push(row);
            }
            
            const offScores = calculateOffensivePageRank(monoMatrix, 30, 0.85);
            const maxOffScore = Math.max(...offScores);
            const offensiveRankings = TYPES.map((type, idx) => ({
                type: type,
                score: (offScores[idx] / maxOffScore) * 100
            })).sort((a, b) => b.score - a.score);
            
            updateStatus('⏳ Saving type effectiveness data...');
            await saveToDatabase('typeEffectiveness', [
                {
                    id: 'defensiveRankings',
                    data: defensiveRankings,
                    calculatedAt: new Date().toISOString(),
                    description: 'Defensive type rankings (171 types) using dual PageRank'
                },
                {
                    id: 'offensiveRankings',
                    data: offensiveRankings,
                    calculatedAt: new Date().toISOString(),
                    description: 'Offensive type rankings (18 mono types) using dual PageRank'
                },
                {
                    id: 'damageMatrix',
                    matrix: matrix.slice(0, 18),
                    attackerTypes: TYPES,  
                    defenderTypes: allDefenders,  
                    calculatedAt: new Date().toISOString(),
                    description: '18×171 damage matrix (mono attackers vs all defender types)'
                }
            ]);
            
            updateStatus('✅ Type effectiveness calculations complete!');
        }

        const cpm = [0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159, 0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];

        function calculate(baseatk, basedef, basesta, floor, minLvl, maxLvl, invalid, league) {
            const ranks = {};
            const minIV = floor / 1;

            let minLvlIndex = Math.max(0, (minLvl - 1) * 2);
            let maxLvlIndex = Math.max(0, (maxLvl - 1) * 2);

            for (let atk = minIV; atk <= 15; atk++) {
                for (let def = minIV; def <= 15; def++) {
                    for (let sta = minIV; sta <= 15; sta++) {
                        for (let levelIndex = maxLvlIndex; levelIndex >= minLvlIndex; levelIndex--) {
                            const cpmValue = cpm[levelIndex];

                            let cp = Math.max(10, Math.floor((baseatk + atk) * Math.sqrt(basedef + def) * Math.sqrt(basesta + sta) * cpmValue * cpmValue / 10));

                            if (league && cp > league) continue;
                            
                            const aSt = (baseatk + atk) * cpmValue;
                            const dSt = (basedef + def) * cpmValue;
                            const sSt = Math.max(10, Math.floor((basesta + sta) * cpmValue));
                            const statProd = Math.floor(aSt * dSt * sSt);

                            const largeStatProd = statProd * 10000000;
                            const scaledASt = Math.floor(aSt * 100);
                            const newIndex = largeStatProd + scaledASt;
                            const finalIndexString = String(newIndex);

                            const result = {
                                "IVs": { "A": atk, "D": def, "S": sta },
                                "battle": { "A": aSt, "D": dSt, "S": sSt },
                                "L": (levelIndex / 2) + 1,
                                "CP": cp
                            };
                            
                            if (!(finalIndexString in ranks)) {
                                ranks[finalIndexString] = [result];
                            } else {
                                ranks[finalIndexString].push(result);
                            }
                            break;
                        }
                    }
                }
            }
            
            const sorted = {};
            Object.keys(ranks).sort((a, b) => Number(b) - Number(a)).forEach((key) => {
                sorted[key] = ranks[key];
            });

            return sorted;
        }

        function getRank1IVS(sortedRanks) {
            const keys = Object.keys(sortedRanks);
            if (keys.length === 0) return null;

            const topKey = keys[0];
            let topRanks = sortedRanks[topKey];
            if (topRanks.length === 0) return null;

            topRanks.sort((a, b) => {
                const aSP = Math.floor(a.battle.A * a.battle.D * a.battle.S);
                const bSP = Math.floor(b.battle.A * b.battle.D * b.battle.S);
                if (bSP !== aSP) return bSP - aSP;
                if (a.IVs.A !== b.IVs.A) return a.IVs.A - b.IVs.A;
                if (b.battle.S !== a.battle.S) return b.battle.S - a.battle.S;
                if (b.battle.D !== a.battle.D) return b.battle.D - a.battle.D;
                if (a.CP !== b.CP) return a.CP - b.CP;
                return 0;
            });

            return topRanks[0];
        }

        function getWorstIVS(sortedRanks) {
            const keys = Object.keys(sortedRanks);
            if (keys.length === 0) return null;
            const worstKey = keys[keys.length - 1];
            let worstRanks = sortedRanks[worstKey];
            if (worstRanks.length === 0) return null;
            return worstRanks[0];
        }

        function calculatePvPIVs(baseatk, basedef, basesta, league, floor) {
            const sortedRanks = calculate(baseatk, basedef, basesta, floor, 1, 50, false, league);

            const rank1 = getRank1IVS(sortedRanks);
            const worst = getWorstIVS(sortedRanks);
            
            if (rank1) {
                const maxSP = Math.floor(rank1.battle.A * rank1.battle.D * rank1.battle.S);
                const minSP = worst ? Math.floor(worst.battle.A * worst.battle.D * worst.battle.S) : maxSP;
                
                return {
                    iv: { atk: rank1.IVs.A, def: rank1.IVs.D, sta: rank1.IVs.S },
                    maxSP: maxSP,
                    minSP: minSP,
                    level: rank1.L,
                    cp: rank1.CP
                };
            }
            
            const maxCP = Math.max(10, Math.floor((baseatk + 15) * Math.sqrt(basedef + 15) * Math.sqrt(basesta + 15) * Math.pow(cpm[99], 2) / 10));
            
            if (maxCP <= league) {
                const maxSP = Math.floor(((baseatk + 15) * cpm[99]) * ((basedef + 15) * cpm[99]) * Math.max(10, Math.floor((basesta + 15) * cpm[99])));
                
                return {
                    iv: { atk: 15, def: 15, sta: 15 },
                    maxSP: maxSP,
                    minSP: maxSP,
                    level: 50,
                    cp: maxCP
                };
            }

            return {
                iv: { atk: 0, def: 0, sta: 0 },
                maxSP: 0,
                minSP: 0,
                level: 1,
                cp: 0
            };
        }

        function updateProgress(current, total, message = '') {
            const progressContainer = document.getElementById('progress-container');
            const progressBar = document.getElementById('progress-bar');
            
            progressContainer.style.display = 'block';
            const percent = Math.round((current / total) * 100);
            progressBar.style.width = percent + '%';
            progressBar.textContent = message || `${percent}% (${current}/${total})`;
        }

        // ============================================================
        // DATABASE HELPERS
        // ============================================================
        
        async function initDatabase() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    db = request.result;
                    resolve(db);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    if (db.objectStoreNames.contains('pokemon')) {
                        db.deleteObjectStore('pokemon');
                    }
                    if (db.objectStoreNames.contains('moves')) {
                        db.deleteObjectStore('moves');
                    }
                    if (db.objectStoreNames.contains('metadata')) {
                        db.deleteObjectStore('metadata');
                    }
                    if (db.objectStoreNames.contains('typeEffectiveness')) {
                        db.deleteObjectStore('typeEffectiveness');
                    }
                    if (db.objectStoreNames.contains('rankings')) {
                        db.deleteObjectStore('rankings');
                    }

                    const pokemonStore = db.createObjectStore('pokemon', { keyPath: 'id' });
                    pokemonStore.createIndex('dexNumber', 'dexNumber', { unique: false });
                    
                    db.createObjectStore('moves', { keyPath: 'id' });
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    db.createObjectStore('typeEffectiveness', { keyPath: 'id' });
                    
                    const rankingsStore = db.createObjectStore('rankings', { keyPath: 'id' });
                    rankingsStore.createIndex('league', 'league', { unique: false });
                    db.createObjectStore('cups', { keyPath: 'id' });
                    
                    const userPokemonStore = db.createObjectStore('userPokemon', { keyPath: 'id' });
                    userPokemonStore.createIndex('name', 'name', { unique: false });
                    userPokemonStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                    userPokemonStore.createIndex('dateCaught', 'dateCaught', { unique: false });
                };
            });
        }

        async function saveToDatabase(storeName, data) {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            for (const item of data) {
                await store.put(item);
            }
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }

        async function loadFromDatabase(storeName) {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function clearDatabase() {
            if (!confirm('This will delete ALL scraped data. Continue?')) return;
            
            const transaction = db.transaction(['pokemon', 'moves', 'metadata', 'rankings'], 'readwrite');
            transaction.objectStore('pokemon').clear();
            transaction.objectStore('moves').clear();
            transaction.objectStore('metadata').clear();
            transaction.objectStore('rankings').clear();
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    updateStatus('✅ Database cleared!');
                    updateStats({ pokemon: 0, fastPvP: 0, chargePvP: 0 });
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            });
        }

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
            
            checkUrgency(myIndex, oppIndex) {
                const opponent = oppIndex === 0 ? this.p1 : this.p2;
                const myHP = this.hp[myIndex];
                
                for (const move of opponent.chargedMoves) {
                    const potentialDamage = this.calculateDamage(
                        opponent, 
                        myIndex === 0 ? this.p1 : this.p2, 
                        move, 
                        oppIndex, 
                        myIndex
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
                updateStatus(`⚔️ Simulating ${cup.title} (${cup.cpLimit || 'No Limit'} CP)...`);
                
                // Convert cup to league config format
                const leagueConfig = {
                    name: cup.id.toLowerCase().replace(/_/g, '-'),
                    displayName: cup.title,
                    cpLimit: cup.cpLimit,
                    cpPrune: cup.cpLimit || 2500,
                    limitToFirstStage: false, // TODO: Detect from cup restrictions
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
                } // END OF FOR LOOP - this was missing!
                
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
            const totalMatchups = movesets.length * (movesets.length - 1);
            let matchupsCompleted = 0;
            
            updateProgress(0, totalMatchups, `${league.name}: 0 / ${totalMatchups.toLocaleString()} matchups`);
            
            for (let i = 0; i < movesets.length; i++) {
                const moveset1 = movesets[i];
                const p1Data = results.get(moveset1.pokemon.variantId);
                
                for (let j = 0; j < movesets.length; j++) {
                    if (i === j) continue;
                    
                    const moveset2 = movesets[j];
                    
                    // Run all scenarios for this matchup
                    for (const scenario of scenarios) {
                        const isSymmetric = isScenarioSymmetric(scenario);
                        
                        if (isSymmetric && i > j) {
                            // Already simulated when j was attacker
                            continue;
                        }
                        
                        const rating = simulateBattle(moveset1, moveset2, scenario, league, typeChart, typeOrder);
                        
                        // Record for P1
                        recordBestResult(p1Data, scenario, rating, moveset1);
                        
                        // For symmetric, also record reverse
                        if (isSymmetric) {
                            const p2Data = results.get(moveset2.pokemon.variantId);
                            recordBestResult(p2Data, scenario, 1000 - rating, moveset2);
                        }
                    }
                    
                    matchupsCompleted++;
                    
                    if (matchupsCompleted % 50 === 0) {
                        updateProgress(matchupsCompleted, totalMatchups, 
                            `${league.name}: ${matchupsCompleted.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups`);
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }
            
            updateProgress(totalMatchups, totalMatchups, 
                `${league.name}: ${totalMatchups.toLocaleString()} / ${totalMatchups.toLocaleString()} matchups - Aggregating...`);
            
            const rankings = aggregateResults(results, eligiblePokemon, league);
            
            // Clear all temporary data
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

        function isScenarioSymmetric(scenario) {
            return scenario === 'leads' || scenario === 'leads-baited' || scenario === 'closers';
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

        // ============================================================
        // SCRAPER CORE
        // ============================================================

        const TYPE_COLORS = {
            'NORMAL': '#A8A77A', 'FIRE': '#EE8130', 'WATER': '#6390F0', 'GRASS': '#7AC74C',
            'ELECTRIC': '#F7D02C', 'ICE': '#96D9D6', 'FIGHTING': '#C22E28', 'POISON': '#A33EA1',
            'GROUND': '#E2BF65', 'FLYING': '#A98FF3', 'PSYCHIC': '#F95587', 'BUG': '#A6B91A',
            'ROCK': '#B6A136', 'GHOST': '#735797', 'DRAGON': '#6F35FC', 'STEEL': '#B7B7CE',
            'DARK': '#705746', 'FAIRY': '#D685AD'
        };

        async function startScraping() {
            const btn = document.getElementById('scrape-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Scraping...';
            
            try {
                await initDatabase();
                
                updateStatus('⏳ Fetching Game Master from GitHub...');
                const response = await fetch(GAME_MASTER_URL + '?t=' + Date.now());
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const gameMaster = await response.json();
                updateStatus(`✅ Loaded ${gameMaster.length.toLocaleString()} templates. Parsing...`);
                
                const { pokemon, moves, cups, scheduleData } = await parseGameMaster(gameMaster);
                updateStatus('💾 Saving to IndexedDB...');
                await saveToDatabase('pokemon', pokemon);
                await saveToDatabase('moves', moves);
                await saveToDatabase('cups', cups);
                // Save the active season schedule
                await saveToDatabase('metadata', [
                    {
                        key: 'activeSeasonCups',
                        value: Array.from(scheduleData)
                    },
                    {
                        key: 'seasonSchedule',
                        value: {
                            seasonTitle: scheduleData.seasonTitle,
                            blogUrl: scheduleData.blogUrl,
                            schedule: scheduleData.schedule
                        }
                    }
                ]);
                
                await saveToDatabase('metadata', [{
                    key: 'lastUpdated',
                    value: new Date().toISOString(),
                    gameMasterVersion: gameMaster[0]?.templateId || 'unknown'
                }]);
                
                await calculateTypeEffectiveness();

                document.getElementById('progress-container').style.display = 'none';
                updateStatus('✅ Scraping complete! Data saved to IndexedDB. Select leagues below to run battle simulations.');
                updateStats({
                    pokemon: pokemon.length,
                    fastPvP: moves.filter(m => m.category === 'fast' && m.mode === 'pvp').length,
                    chargePvP: moves.filter(m => m.category === 'charge' && m.mode === 'pvp').length,
                });
                
                document.getElementById('view-btn').disabled = false;
                document.getElementById('download-btn').disabled = false;

                // Populate league checkboxes
                await populateLeagueCheckboxes(cups);
                document.getElementById('league-selection').style.display = 'block';
                
            } catch (error) {
                updateStatus(`❌ Error: ${error.message}`);
                console.error('Scraping error:', error);
            } finally {
                btn.disabled = false;
                btn.textContent = '🔄 Re-scrape Data';
            }
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

        async function parseGameMaster(gameMaster) {
            const pokemon = [];
            const moves = [];
            const cups = [];
            const processedPokemon = new Set();
            const warnings = [];
            const debugInfo = {
                pvpOnlyMoves: [],
                pveOnlyMoves: [],
                missingFromDB: []
            };

            const { pvpMoves, pveMoves } = buildMoveMaps(gameMaster);

            updateStatus('⏳ Parsing VS Seeker schedule...');
            const scheduleData = parseVSSeekerSchedule(gameMaster);
            const activeCupIds = scheduleData.activeCupIds;

            updateStatus('⏳ Parsing cup templates...');
            const parsedCups = parseCups(gameMaster);
            cups.push(...parsedCups);

            for (const item of gameMaster) {
                if (!item.templateId?.startsWith('V') || !item.data?.pokemonSettings) continue;
                if (processedPokemon.has(item.templateId)) continue;
                
                try {
                    const parsed = parsePokemon(item, pvpMoves, pveMoves, gameMaster);
                    if (parsed && shouldIncludePokemon(parsed, pokemon)) {
                        pokemon.push(parsed);
                        processedPokemon.add(item.templateId);
                    }
                } catch (error) {
                    warnings.push(`${item.templateId}: ${error.message}`);
                }
            }

            updateStatus('⏳ Calculating PvP IVs (this may take a minute)...');
            const sortedPokemon = pokemon.sort((a, b) => a.dexNumber - b.dexNumber);
            
            for (let i = 0; i < sortedPokemon.length; i++) {
                const p = sortedPokemon[i];
                
                if (i % 10 === 0) {
                    updateProgress(i, sortedPokemon.length);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
                const littleWild = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 500, 0);
                const littleHatch = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 500, 10);
                const greatWild = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 0);
                const greatHatch = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 10);
                const ultraWild = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 0);
                const ultraHatch = calculatePvPIVs(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 10);
                
                p.little = {
                    iv: littleWild.iv,
                    maxSP: littleWild.maxSP,
                    minSP: littleWild.minSP,
                    level: littleWild.level,
                    cp: littleWild.cp,
                    ivHatch: littleHatch.iv,
                    maxSPHatch: littleHatch.maxSP,
                    minSPHatch: littleHatch.minSP
                };
                
                p.great = {
                    iv: greatWild.iv,
                    maxSP: greatWild.maxSP,
                    minSP: greatWild.minSP,
                    level: greatWild.level,
                    cp: greatWild.cp,
                    ivHatch: greatHatch.iv,
                    maxSPHatch: greatHatch.maxSP,
                    minSPHatch: greatHatch.minSP
                };
                
                p.ultra = {
                    iv: ultraWild.iv,
                    maxSP: ultraWild.maxSP,
                    minSP: ultraWild.minSP,
                    level: ultraWild.level,
                    cp: ultraWild.cp,
                    ivHatch: ultraHatch.iv,
                    maxSPHatch: ultraHatch.maxSP,
                    minSPHatch: ultraHatch.minSP
                };
                
                p.master = {
                    iv: { atk: 15, def: 15, sta: 15 },
                    maxSP: Math.floor(
                        ((p.stats.attack + 15) * cpm[99]) * 
                        ((p.stats.defense + 15) * cpm[99]) * 
                        Math.max(10, Math.floor((p.stats.hp + 15) * cpm[99]))
                    ),
                    minSP: Math.floor(
                        ((p.stats.attack + 15) * cpm[99]) * 
                        ((p.stats.defense + 15) * cpm[99]) * 
                        Math.max(10, Math.floor((p.stats.hp + 15) * cpm[99]))
                    ),
                    level: 50,
                    cp: calculateMaxCP(p.stats.attack, p.stats.defense, p.stats.hp)
                };
            }
            
            updateProgress(sortedPokemon.length, sortedPokemon.length);

            const pvpMoveIds = new Set(pvpMoves.keys());
            const pveMoveIds = new Set(pveMoves.keys());
            
            pvpMoveIds.forEach(id => {
                if (!pveMoveIds.has(id)) debugInfo.pvpOnlyMoves.push(id);
            });
            
            pveMoveIds.forEach(id => {
                if (!pvpMoveIds.has(id)) debugInfo.pveOnlyMoves.push(id);
            });

            compareWithSpreadsheet(sortedPokemon, debugInfo);

            console.group('🔍 Scraping Debug Report');
            console.log(`Total Pokemon parsed: ${sortedPokemon.length}`);
            console.log(`Highest Dex Number: ${sortedPokemon[sortedPokemon.length - 1]?.dexNumber || 0}`);
            
            if (debugInfo.missingFromDB?.length > 0) {
                console.group(`❌ In Spreadsheet but Missing from DB (${debugInfo.missingFromDB.length} entries)`);
                debugInfo.missingFromDB.forEach(entry => {
                    console.log(`Row ${entry.row}: ${entry.name}${entry.form ? ' (' + entry.form + ')' : ''}`);
                });
                console.groupEnd();
            }
            
            if (warnings.length > 0) {
                console.warn(`⚠️ Parsing warnings (${warnings.length} total):`, warnings.slice(0, 10));
            }
            console.groupEnd();

            pvpMoves.forEach((move, id) => {
                moves.push({ ...move, id: `pvp-${move.category}-${id}`, mode: 'pvp' });
            });
            pveMoves.forEach((move, id) => {
                moves.push({ ...move, id: `pve-${move.category}-${id}`, mode: 'pve' });
            });

            return {
                pokemon: sortedPokemon,
                moves: moves.sort((a, b) => a.name.localeCompare(b.name)),
                cups: cups,
                scheduleData: scheduleData  // Return the whole scheduleData object
            };
        }

        function parseCups(gameMaster) {
            const cups = [];
            const nineMonthsAgo = Date.now() - (270 * 24 * 60 * 60 * 1000);
            
            for (const item of gameMaster) {
                if (!item.templateId?.startsWith('COMBAT_LEAGUE_') || !item.data?.combatLeague) continue;
                
                const id = item.templateId;
                const league = item.data.combatLeague;
                
                // Skip paid event cups
                if (id.includes('SAFARI')) continue;
                if (id.includes('GO_FEST')) continue;
                if (id.includes('POKEMON_GO_TOUR')) continue;
                
                // Skip old year-specific cups
                const yearMatch = id.match(/_(\d{4})_/);
                if (yearMatch && parseInt(yearMatch[1]) <= 2024) continue;
                
                // Skip cups with expired catch windows (>9 months old)
                const conditions = league.pokemonCondition || [];
                const timestampCondition = conditions.find(c => c.pokemonCaughtTimestamp);
                if (timestampCondition) {
                    const beforeMs = parseInt(timestampCondition.pokemonCaughtTimestamp.beforeTimestamp);
                    if (beforeMs < nineMonthsAgo) continue;
                }
                
                // Extract cup data
                const cup = {
                    id: id,
                    title: cleanCupTitle(league.title || id),
                    cpLimit: null,
                    allowedTypes: [],
                    allowedPokemon: [],
                    bannedPokemon: league.bannedPokemon || [],
                    maxLevel: null,
                    isStandard: isStandardLeague(id)
                };
                
                // Parse conditions
                for (const condition of conditions) {
                    if (condition.type === 'WITH_POKEMON_CP_LIMIT') {
                        cup.cpLimit = condition.withPokemonCpLimit?.maxCp || null;
                    }
                    
                    if (condition.type === 'WITH_POKEMON_TYPE') {
                        cup.allowedTypes = (condition.withPokemonType?.pokemonType || [])
                            .map(t => t.replace('POKEMON_TYPE_', ''));
                    }
                    
                    if (condition.type === 'POKEMON_WHITELIST') {
                        cup.allowedPokemon = (condition.pokemonWhiteList?.pokemon || [])
                            .map(p => ({
                                id: p.id,
                                form: p.form || null
                            }));
                    }
                    
                    if (condition.type === 'POKEMON_LEVEL_RANGE') {
                        cup.maxLevel = condition.pokemonLevelRange?.maxLevel || null;
                    }
                }
                
                cups.push(cup);
            }
            
            console.log(`🏆 Parsed ${cups.length} cups (${cups.filter(c => c.isStandard).length} standard, ${cups.filter(c => !c.isStandard).length} special)`);
            return cups;
        }

        
        function parseVSSeekerSchedule(gameMaster) {
            const scheduleTemplate = gameMaster.find(item => 
                item.templateId === 'VS_SEEKER_SCHEDULE_SETTINGS'
            );
            
            if (!scheduleTemplate?.data?.vsSeekerScheduleSettings?.seasonSchedules) {
                console.warn('⚠️ VS_SEEKER_SCHEDULE_SETTINGS not found in Game Master');
                return new Set();
            }
            
            const settings = scheduleTemplate.data.vsSeekerScheduleSettings;
            const activeCupIds = new Set();
            
            const seasons = settings.seasonSchedules;
            const currentSeason = seasons[seasons.length - 1];
                       
            for (const week of currentSeason.vsSeekerSchedules) {
                const startDate = new Date(parseInt(week.startTimeMs));
                const endDate = new Date(parseInt(week.endTimeMs));
                
                console.log(`  Week: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
                
                for (const cupId of week.vsSeekerLeagueTempalteId) {
                    activeCupIds.add(cupId);
                    const displayId = cupId.replace('COMBAT_LEAGUE_', '');
                    console.log(`    → ${displayId}`);
                }
            }
            
            console.log('Active Cup IDs:', Array.from(activeCupIds).map(id => id.replace('COMBAT_LEAGUE_', '')));
            return activeCupIds;
        }

        function isStandardLeague(templateId) {
            const exactStandard = [
                'COMBAT_LEAGUE_VS_SEEKER_GREAT', 
                'COMBAT_LEAGUE_VS_SEEKER_ULTRA',
                'COMBAT_LEAGUE_VS_SEEKER_MASTER',
                'COMBAT_LEAGUE_VS_SEEKER_GREAT_LITTLE'
            ];
            
            return exactStandard.includes(templateId);
        }

        function cleanCupTitle(title) {
            // Remove i18n key suffixes
            title = title.replace(/_title$/, '').replace(/_cup_title$/, '');
            
            // Convert underscores to spaces and title case
            return title.split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }

        async function populateLeagueCheckboxes(cups) {
            const container = document.getElementById('league-checkboxes');
            if (!container) return;
            
            // Load active season cups from metadata
            const metadata = await loadFromDatabase('metadata');
            const seasonData = metadata.find(m => m.key === 'activeSeasonCups');
            const activeCupIds = seasonData ? new Set(seasonData.value) : new Set();
            
            console.log('📋 Populating checkboxes. Active cup IDs:', Array.from(activeCupIds).map(id => id.replace('COMBAT_LEAGUE_', '')));
            
            // Always check Little League by default (not in schedule but we want it)
            const littleCup = cups.find(c => c.id === 'COMBAT_LEAGUE_VS_SEEKER_GREAT_LITTLE');
            if (littleCup) {
                activeCupIds.add(littleCup.id);
            }
            
            const standardCups = cups.filter(c => c.isStandard).sort((a, b) => {
                const order = { 500: 0, 1500: 1, 2500: 2, null: 3 };
                return (order[a.cpLimit] || 4) - (order[b.cpLimit] || 4);
            });
            
            const specialCups = cups.filter(c => !c.isStandard).sort((a, b) => a.title.localeCompare(b.title));
            
            let html = '<div style="margin-bottom: 20px;"><strong>Standard Leagues</strong><br>';
            
            standardCups.forEach(cup => {
                const cpText = cup.cpLimit ? `${cup.cpLimit} CP` : 'No Limit';
                const extraInfo = cup.maxLevel ? ` (Max Level ${cup.maxLevel})` : '';
                const isActive = activeCupIds.has(cup.id);
                const activeLabel = isActive ? ' 🔥' : '';
                const displayId = cup.id.replace('COMBAT_LEAGUE_', '');
                
                console.log(`  ${cup.title} (${displayId}): ${isActive ? 'CHECKED' : 'unchecked'}`);
                
                html += `
                    <label style="display: block; margin: 8px 0; cursor: pointer;" title="${displayId}">
                        <input type="checkbox" value="${cup.id}" ${isActive ? 'checked' : ''} style="margin-right: 8px;">
                        <strong>${cup.title}</strong>${activeLabel} - ${cpText}${extraInfo}
                        <span style="color: #999; font-size: 11px; margin-left: 5px;">${displayId}</span>
                    </label>
                `;
            });
            
            html += '</div>';
            
            if (specialCups.length > 0) {
                html += '<div><strong>Special Cups</strong><br>';
                
                specialCups.forEach(cup => {
                    const cpText = cup.cpLimit ? `${cup.cpLimit} CP` : 'No Limit';
                    const restrictions = [];
                    
                    if (cup.allowedTypes.length > 0) {
                        restrictions.push(`${cup.allowedTypes.length} types`);
                    }
                    if (cup.allowedPokemon.length > 0) {
                        restrictions.push(`${cup.allowedPokemon.length} Pokemon`);
                    }
                    if (cup.bannedPokemon.length > 0) {
                        restrictions.push(`${cup.bannedPokemon.length} banned`);
                    }
                    if (cup.maxLevel) {
                        restrictions.push(`Max Lv${cup.maxLevel}`);
                    }
                    
                    const restrictText = restrictions.length > 0 ? ` (${restrictions.join(', ')})` : '';
                    const isActive = activeCupIds.has(cup.id);
                    const activeLabel = isActive ? ' 🔥' : '';
                    const displayId = cup.id.replace('COMBAT_LEAGUE_', '');
                    
                    // Check if this is a catch cup (identical to default league)
                    const isCatchCup = cup.id.includes('CATCH');
                    const disabledStyle = isCatchCup ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;';
                    const catchLabel = isCatchCup ? ' ⏭️ (Uses default league rankings)' : '';
                    
                    console.log(`  ${cup.title} (${displayId}): ${isActive ? 'CHECKED' : 'unchecked'}${isCatchCup ? ' [CATCH CUP]' : ''}`);
                    
                    html += `
                        <label style="display: block; margin: 8px 0; ${disabledStyle}" title="${displayId}">
                            <input type="checkbox" value="${cup.id}" ${isActive && !isCatchCup ? 'checked' : ''} ${isCatchCup ? 'disabled' : ''} style="margin-right: 8px;">
                            <strong>${cup.title}</strong>${activeLabel}${catchLabel} - ${cpText}${restrictText}
                            <span style="color: #999; font-size: 11px; margin-left: 5px;">${displayId}</span>
                        </label>
                    `;
                });
                
                html += '</div>';
            }
            
            container.innerHTML = html;
        }

        function buildMoveMaps(gameMaster) {
            const pvpMoves = new Map();
            const pveMoves = new Map();
            
            for (const item of gameMaster) {
                if (!item.templateId?.includes('_MOVE_') || !item.data) continue;
                
                const move = item.data.combatMove || item.data.moveSettings;
                if (!move) continue;
                
                const isPvP = item.templateId.startsWith('COMBAT_');
                const category = (move.energyDelta > 0) ? 'fast' : 'charge';

                let moveId;
                if (typeof move.uniqueId === 'number' || typeof move.movementId === 'number') {
                    const moveIndex = item.templateId.indexOf('_MOVE_');
                    moveId = item.templateId.substring(moveIndex + 6);
                } else {
                    moveId = move.uniqueId || move.movementId;
                }
                
                const moveData = {
                    name: toTitleCase(moveId),
                    type: (move.type || move.pokemonType || '').split('_').pop() || 'NORMAL',
                    power: move.power || 0,
                    energy: Math.abs(move.energyDelta || 0),
                    duration: move.durationTurns || (move.durationMs ? move.durationMs / 1000 : 0),
                    category: category,
                    rawId: moveId
                };
                
                if (category === 'fast') {
                    if (isPvP) {
                        const turns = (move.durationTurns || 0) + 1;
                        moveData.dpt = turns > 0 ? moveData.power / turns : 0;
                        moveData.ept = turns > 0 ? Math.abs(move.energyDelta || 0) / turns : 0;
                    } else {
                        moveData.durationMs = move.durationMs || 0;
                        moveData.damageWindowStartMs = move.damageWindowStartMs || 0;
                        moveData.damageWindowEndMs = move.damageWindowEndMs || 0;
                        
                        const durationSec = moveData.durationMs / 1000;
                        moveData.dps = durationSec > 0 ? moveData.power / durationSec : 0;
                        moveData.eps = durationSec > 0 ? Math.abs(move.energyDelta || 0) / durationSec : 0;
                    }
                } else {
                    moveData.dpe = moveData.energy > 0 ? moveData.power / moveData.energy : 0;
                    
                    if (isPvP) {
                        if (move.buffs) {
                            moveData.buffs = {
                                activationChance: move.buffs.buffActivationChance || 0,
                                attackerAttackPercent: move.buffs.attackerAttackStatsChange ? (move.buffs.attackerAttackStatsChange * 0.125) : 0,
                                attackerDefensePercent: move.buffs.attackerDefenseStatsChange ? (move.buffs.attackerDefenseStatsChange * 0.125) : 0,
                                targetAttackPercent: move.buffs.targetAttackStatsChange ? (move.buffs.targetAttackStatsChange * 0.125) : 0,
                                targetDefensePercent: move.buffs.targetDefenseStatsChange ? (move.buffs.targetDefenseStatsChange * 0.125) : 0
                            };
                        }
                    } else {
                        moveData.durationMs = move.durationMs || 0;
                        moveData.damageWindowStartMs = move.damageWindowStartMs || 0;
                        moveData.damageWindowEndMs = move.damageWindowEndMs || 0;
                    }
                }
                
                if (isPvP) {
                    pvpMoves.set(moveId, moveData);
                } else {
                    pveMoves.set(moveId, moveData);
                }
            }
            
            return { pvpMoves, pveMoves };
        }

        function parsePokemon(item, pvpMoves, pveMoves, gameMaster) {
            const settings = item.data.pokemonSettings;
            const templateId = item.templateId;
            
            const match = templateId.match(/V(\d+)/);
            const dexNumber = match ? parseInt(match[1]) : 0;
            const isSpecial = (dexNumber === 999 || dexNumber === 1000);
            
            if (!settings.pokemonId) return null;
            
            let pokemonIdString;
            if (typeof settings.pokemonId === 'number') {
                const nameMatch = templateId.match(/_POKEMON_(.+)/);
                pokemonIdString = nameMatch ? nameMatch[1] : `POKEMON_${settings.pokemonId}`;
            } else {
                pokemonIdString = settings.pokemonId;
            }
            
            if (!isSpecial) {
                const upper = pokemonIdString.toUpperCase();
                const isNidoran = upper.startsWith('NIDORAN_');
                if (!isNidoran && (upper.includes('_MALE') || upper.includes('_FEMALE'))) {
                    return null;
                }
                if (upper.startsWith('SHADOW') || upper.startsWith('_PURIFIED')) {
                    return null;
                }
            }
            
            const pokeNameRaw = pokemonIdString.split('_')[0] || '';
            let name = toTitleCase(pokeNameRaw);
            let form = extractForm(templateId, settings.form, pokeNameRaw);
            
            ({ name, form } = applyNameOverrides(name, form, dexNumber, templateId, pokemonIdString));
            
            const type1 = (settings.type || '').split('_').pop() || 'NORMAL';
            const type2 = (settings.type2 || '').split('_').pop() || '';
            
            const stats = settings.stats || {};
            if (!stats.baseStamina && !isSpecial) return null;
            
            const moves = extractMoves(settings, pvpMoves, gameMaster);
            const isSmeargle = (dexNumber === 235);
            if (!moves.fast.length && !moves.charge.length && !isSmeargle) return null;
            
            const evolutions = extractEvolutions(settings, gameMaster);
            
            const thirdMoveCost = settings.thirdMove ? {
                stardust: settings.thirdMove.stardustToUnlock || 0,
                candy: settings.thirdMove.candyToUnlock || 0
            } : null;

            const shadowInfo = settings.shadow ? {
                purificationStardust: settings.shadow.purificationStardustNeeded || 0,
                purificationCandy: settings.shadow.purificationCandyNeeded || 0,
                purifiedChargeMove: settings.shadow.purifiedChargeMove || '',
                shadowChargeMove: settings.shadow.shadowChargeMove || ''
            } : null;

            const baseAttack = stats.baseAttack || 0;
            const baseDefense = stats.baseDefense || 0;
            const baseStamina = stats.baseStamina || 0;

            const allChargeMoves = [...moves.charge, ...moves.chargeElite];
            const chargeMoveTypes = new Set();
            
            allChargeMoves.forEach(moveName => {
                const pvpMove = pvpMoves.get(getMoveId(moveName, pvpMoves));
                if (pvpMove) {
                    chargeMoveTypes.add(pvpMove.type);
                }
            });
            
            const uniqueChargeTypes = Array.from(chargeMoveTypes);

            return {
                id: `${name}-${form || 'base'}`,
                dexNumber,
                name,
                form,
                types: [type1, type2].filter(t => t),
                stats: {
                    attack: baseAttack,
                    defense: baseDefense,
                    hp: baseStamina
                },
                maxCP: calculateMaxCP(baseAttack, baseDefense, baseStamina),
                moves,
                evolutions,
                pokemonClass: settings.pokemonClass || 'NORMAL',
                thirdMoveCost,
                shadowInfo,
                templateId,
                chargeTypeCoverage: {
                    count: uniqueChargeTypes.length,
                    types: uniqueChargeTypes
                }
            };
        }

        function getMoveId(moveName, moveMap) {
            for (const [id, move] of moveMap.entries()) {
                if (move.name === moveName) {
                    return id;
                }
            }
            return null;
        }

        function extractMoves(settings, moveMap, gameMaster) {
            const resolveMove = (moveId) => {
                if (!moveId) return null;
                
                let move = moveMap.get(moveId);
                if (move) return move.name;
                
                if (typeof moveId === 'number') {
                    const paddedId = String(moveId).padStart(4, '0');
                    const templatePrefix = `COMBAT_V${paddedId}_MOVE_`;
                    
                    for (const item of gameMaster) {
                        if (item.templateId?.startsWith(templatePrefix)) {
                            const idx = item.templateId.indexOf('_MOVE_');
                            return toTitleCase(item.templateId.substring(idx + 6));
                        }
                    }
                }
                
                return toTitleCase(String(moveId));
            };
            
            const moves = {
                fast: [],
                fastElite: [],
                charge: [],
                chargeElite: []
            };
            
            if (settings.quickMoves) {
                moves.fast = settings.quickMoves.map(resolveMove).filter(m => m);
            }
            
            if (settings.eliteQuickMove) {
                moves.fastElite = settings.eliteQuickMove.map(resolveMove).filter(m => m);
            }
            
            let chargeList = [...(settings.cinematicMoves || [])];
            if (settings.nonTmCinematicMoves) {
                chargeList.push(...settings.nonTmCinematicMoves);
            }
            if (settings.formChange) {
                for (const fc of settings.formChange) {
                    if (fc.moveReassignment?.cinematicMoves) {
                        for (const reassign of fc.moveReassignment.cinematicMoves) {
                            if (reassign.replacementMoves) {
                                chargeList.push(...reassign.replacementMoves);
                            }
                        }
                    }
                }
            }
            moves.charge = [...new Set(chargeList)].map(resolveMove).filter(m => m);
            
            if (settings.eliteCinematicMove) {
                moves.chargeElite = settings.eliteCinematicMove.map(resolveMove).filter(m => m);
            }
            
            return moves;
        }

        function parseEvolutionQuest(questTemplateId, gameMaster) {
            if (!questTemplateId) return null;
            
            const questTemplate = gameMaster.find(item => 
                item.templateId === questTemplateId && 
                item.data?.evolutionQuestTemplate
            );
            
            if (!questTemplate) return null;
            
            const quest = questTemplate.data.evolutionQuestTemplate;
            const questType = quest.questType;
            const goal = quest.goals?.[0];
            if (!goal) return null;
            
            const target = goal.target || 0;
            const conditions = goal.condition || [];
            
            switch (questType) {
                case 'QUEST_CATCH_POKEMON': {
                    const typeCondition = conditions.find(c => c.type === 'WITH_POKEMON_TYPE');
                    if (typeCondition?.withPokemonType?.pokemonType) {
                        const types = typeCondition.withPokemonType.pokemonType
                            .map(t => toTitleCase(t.replace('POKEMON_TYPE_', '')))
                            .join(' or ');
                        return `Catch ${target} ${types} Type${target > 1 ? 's' : ''}`;
                    }
                    return `Catch ${target} Pokemon`;
                }
                
                case 'QUEST_BUDDY_EVOLUTION_WALK':
                    return `Walk ${target} km as Buddy`;
                
                case 'QUEST_COMPLETE_RAID_BATTLE':
                    return `Win ${target} Raid${target > 1 ? 's' : ''}`;
                
                case 'QUEST_LAND_THROW': {
                    const throwCondition = conditions.find(c => c.type === 'WITH_THROW_TYPE');
                    const throwType = throwCondition?.withThrowType?.throwType || '';
                    let throwName = 'Throws';
                    if (throwType.includes('EXCELLENT')) throwName = 'Excellent Throws';
                    else if (throwType.includes('GREAT')) throwName = 'Great Throws';
                    else if (throwType.includes('NICE')) throwName = 'Nice Throws';
                    return `Land ${target} ${throwName}`;
                }
                
                case 'QUEST_BUDDY_EARN_AFFECTION_POINTS':
                    return `Earn ${target} Buddy Heart${target > 1 ? 's' : ''}`;
                
                case 'QUEST_USE_INCENSE':
                    return `Use ${target} Incense`;
                
                case 'QUEST_BUDDY_FEED':
                    return `Feed Buddy ${target} Berr${target > 1 ? 'ies' : 'y'}`;
                
                case 'QUEST_FIGHT_POKEMON': {
                    const battleCondition = conditions.find(c => c.type === 'WITH_OPPONENT_POKEMON_BATTLE_STATUS');
                    if (battleCondition?.withOpponentPokemonBattleStatus?.opponentPokemonType) {
                        const types = battleCondition.withOpponentPokemonBattleStatus.opponentPokemonType
                            .map(t => toTitleCase(t.replace('POKEMON_TYPE_', '')))
                            .join(' or ');
                        return `Defeat ${target} ${types} Type${target > 1 ? 's' : ''}`;
                    }
                    return `Defeat ${target} Pokemon`;
                }
                
                case 'QUEST_COMPLETE_BATTLE': {
                    const combatCondition = conditions.find(c => c.type === 'WITH_COMBAT_TYPE');
                    const typeCondition = conditions.find(c => c.type === 'WITH_POKEMON_TYPE');
                    
                    let battleType = 'Battle';
                    if (combatCondition?.withCombatType?.combatType) {
                        const combat = combatCondition.withCombatType.combatType[0] || '';
                        if (combat.includes('RAID')) battleType = 'Raid';
                        else if (combat.includes('PVP')) battleType = 'PvP Battle';
                    }
                    
                    if (typeCondition?.withPokemonType?.pokemonType) {
                        const types = typeCondition.withPokemonType.pokemonType
                            .map(t => toTitleCase(t.replace('POKEMON_TYPE_', '')))
                            .join(' or ');
                        return `Win ${target} ${types} ${battleType}${target > 1 ? 's' : ''}`;
                    }
                    
                    return `Win ${target} ${battleType}${target > 1 ? 's' : ''}`;
                }
                
                default:
                    return `Complete Evolution Quest`;
            }
        }

        function extractEvolutions(settings, gameMaster) {
            const evolutions = [];
            
            if (settings.evolutionBranch) {
                for (const branch of settings.evolutionBranch) {
                    const evoId = branch.form || branch.evolution;
                    if (!evoId) continue;
                    
                    const evolutionData = {
                        name: '',
                        form: '',
                        candyCost: branch.candyCost || 0,
                        candyCostPurified: branch.candyCostPurified || 0
                    };
                    
                    if (branch.questDisplay?.[0]?.questRequirementTemplateId) {
                        const questId = branch.questDisplay[0].questRequirementTemplateId;
                        const requirement = parseEvolutionQuest(questId, gameMaster);
                        if (requirement) {
                            evolutionData.evolveRequirement = requirement;
                        }
                    }
                    
                    if (typeof evoId === 'string') {
                        const parts = evoId.split('_');
                        const baseName = parts[0];
                        evolutionData.name = toTitleCase(baseName);
                        
                        if (parts.length > 1) {
                            const formParts = parts.slice(1);
                            const formStr = formParts.join('_').toUpperCase();
                            
                            if (formStr.includes('ALOLA')) {
                                evolutionData.form = 'Alolan';
                            } else if (formStr.includes('GALARIAN') || formStr.includes('GALAR')) {
                                evolutionData.form = 'Galarian';
                            } else if (formStr.includes('HISUIAN') || formStr.includes('HISUI')) {
                                evolutionData.form = 'Hisuian';
                            } else if (formStr.includes('PALDEAN') || formStr.includes('PALDEA')) {
                                evolutionData.form = 'Paldean';
                            } else if (formStr === 'NORMAL' || formStr === 'STANDARD') {
                                evolutionData.form = '';
                            } else {
                                evolutionData.form = toTitleCase(formParts.join('_'));
                            }
                        }
                    } else if (typeof evoId === 'number') {
                        const paddedId = String(evoId).padStart(4, '0');
                        const evoTemplate = gameMaster.find(item => {
                            if (!item.templateId) return false;
                            return item.templateId.startsWith(`V${paddedId}_POKEMON_`);
                        });
                        
                        if (evoTemplate?.templateId) {
                            const nameMatch = evoTemplate.templateId.match(/_POKEMON_(.+)/);
                            if (nameMatch) {
                                const parts = nameMatch[1].split('_');
                                const baseName = parts[0];
                                evolutionData.name = toTitleCase(baseName);
                                
                                if (parts.length > 1) {
                                    const formParts = parts.slice(1);
                                    const formStr = formParts.join('_').toUpperCase();
                                    
                                    if (formStr.includes('ALOLA')) {
                                        evolutionData.form = 'Alolan';
                                    } else if (formStr.includes('GALARIAN') || formStr.includes('GALAR')) {
                                        evolutionData.form = 'Galarian';
                                    } else if (formStr.includes('HISUIAN') || formStr.includes('HISUI')) {
                                        evolutionData.form = 'Hisuian';
                                    } else if (formStr.includes('PALDEAN') || formStr.includes('PALDEA')) {
                                        evolutionData.form = 'Paldean';
                                    } else if (formStr === 'NORMAL' || formStr === 'STANDARD') {
                                        evolutionData.form = '';
                                    } else {
                                        evolutionData.form = toTitleCase(formParts.join('_'));
                                    }
                                }
                            }
                        }
                    }
                    
                    evolutions.push(evolutionData);
                }
            }
            
            const seen = new Set();
            return evolutions.filter(evo => {
                const key = `${evo.name}|${evo.form}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        
        function shouldIncludePokemon(pokemon, existingPokemon) {
            if (/\d{4}/.test(pokemon.form)) return false;
            
            const key = `${pokemon.dexNumber}|${pokemon.name}|` +
                       `${pokemon.types.join(',')}|` +
                       `${pokemon.stats.attack}|${pokemon.stats.defense}|${pokemon.stats.hp}|` +
                       `${pokemon.moves.fast.join(',')}|${pokemon.moves.fastElite.join(',')}|` +
                       `${pokemon.moves.charge.join(',')}|${pokemon.moves.chargeElite.join(',')}`;
            
            const duplicateIndex = existingPokemon.findIndex(p => {
                const existingKey = `${p.dexNumber}|${p.name}|` +
                                   `${p.types.join(',')}|` +
                                   `${p.stats.attack}|${p.stats.defense}|${p.stats.hp}|` +
                                   `${p.moves.fast.join(',')}|${p.moves.fastElite.join(',')}|` +
                                   `${p.moves.charge.join(',')}|${p.moves.chargeElite.join(',')}`;
                return existingKey === key;
            });
            
            if (duplicateIndex !== -1) {
                const existing = existingPokemon[duplicateIndex];
                
                if (pokemon.form === '' && existing.form.toUpperCase() === 'NORMAL') {
                    existingPokemon[duplicateIndex] = pokemon;
                    return false;
                }
                
                if (pokemon.form.toUpperCase() === 'NORMAL' && existing.form === '') {
                    return false;
                }
                
                return false;
            }
            
            return true;
        }

        function extractForm(templateId, formField, pokeNameRaw) {
            if (templateId.includes('V0150_POKEMON_MEWTWO_A')) return 'Armored';
            
            const pokeNameUpper = pokeNameRaw.toUpperCase();
            const pokemonIndex = templateId.indexOf('_POKEMON_');
            if (pokemonIndex === -1) return '';
            
            let rawSuffix = templateId.substring(pokemonIndex + 9);
            if (rawSuffix.toUpperCase().startsWith(pokeNameUpper)) {
                rawSuffix = rawSuffix.substring(pokeNameUpper.length);
            }
            
            rawSuffix = rawSuffix.replace(/_/g, ' ').trim();
            
            if (rawSuffix.includes('ALOLA')) return 'Alolan';
            if (rawSuffix.includes('GALARIAN ZEN') || rawSuffix.includes('GALARIAN_ZEN')) return 'Galarian Zen';
            if (rawSuffix.includes('GALAR')) return 'Galarian';
            if (rawSuffix.includes('HISUI')) return 'Hisuian';
            if (rawSuffix.includes('PALDEA')) return 'Paldean';
            if (rawSuffix.includes('ORIGIN')) return 'Origin';
            if (rawSuffix.includes('ZEN')) return 'Zen';
            if (rawSuffix.includes('MEGA')) return 'Mega';
            
            if (formField && typeof formField === 'string' && (!rawSuffix || rawSuffix.toUpperCase() === 'NORMAL')) {
                return toTitleCase(formField.split('_').pop());
            }
            
            return toTitleCase(rawSuffix);
        }

        function applyNameOverrides(name, form, dexNumber, templateId, pokemonIdString) {
            const nameUpper = name.toUpperCase();
            
            if (dexNumber === 32 || dexNumber === 29) {
                const idUpper = pokemonIdString.toUpperCase();
                if (idUpper.includes('NIDORAN_FEMALE')) {
                    return { name: 'Nidoran♀', form: '' };
                } else if (idUpper.includes('NIDORAN_MALE')) {
                    return { name: 'Nidoran♂', form: '' };
                }
            }
            
            if (nameUpper === 'MR' && name === 'Mr') {
                name = 'Mr. Mime';
                if (form === 'Rime') {
                    name = 'Mr. Rime';
                    form = '';
                } else if (form.toUpperCase().includes('GALARIAN')) {
                    form = 'Galarian';
                } else {
                    form = '';
                }
            } else if (nameUpper === 'HO') {
                name = 'Ho-Oh';
                if (form.toUpperCase() === 'OH') form = '';
            } else if (dexNumber === 439) {
                name = 'Mime Jr.';
                form = '';
            } else if (dexNumber === 474) {
                name = 'Porygon-Z';
                form = '';
            } else if (dexNumber === 772) {
                name = 'Type: Null';
                form = '';
            } else if (dexNumber >= 782 && dexNumber <= 784) {
                if (templateId.includes('JANGMO')) name = 'Jangmo-o';
                else if (templateId.includes('HAKAMO')) name = 'Hakamo-o';
                else if (templateId.includes('KOMMO')) name = 'Kommo-o';
                form = '';
            } else if (dexNumber >= 785 && dexNumber <= 788) {
                name = `Tapu ${form}`;
                form = '';
            } else if (dexNumber === 718) {
                name = 'Zygarde';
                if (templateId.includes('TEN_PERCENT')) form = '10%';
                else if (templateId.includes('FIFTY_PERCENT')) form = '50%';
                else if (templateId.includes('COMPLETE')) form = 'Complete';
                else form = '50%';
            }
            
            return { name, form };
        }

        function compareWithSpreadsheet(pokemon, debugInfo) {
            if (!spreadsheetData || !Array.isArray(spreadsheetData)) {
                return;
            }

            const dbEntries = new Set();
            pokemon.forEach(p => {
                const key = `${p.name}|${p.form}`;
                dbEntries.add(key);
            });
            
            const missing = [];
            spreadsheetData.forEach((row, index) => {
                const [name, form] = row;
                const key = `${name}|${form}`;
                if (!dbEntries.has(key)) {
                    missing.push({
                        row: index + 2,
                        name: name,
                        form: form
                    });
                }
            });
            
            debugInfo.missingFromDB = missing;
        }

        const csvUploadEl = document.getElementById('csv-upload');
        if (csvUploadEl) {
            csvUploadEl.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const statusEl = document.getElementById('csv-status');
                statusEl.textContent = 'Reading CSV...';
                
                try {
                    const text = await file.text();
                    const lines = text.split('\n');
                    spreadsheetData = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
                        if (parts.length >= 2) {
                            const name = parts[0].replace(/"/g, '').trim();
                            const form = parts[1].replace(/"/g, '').trim();
                            if (name) {
                                spreadsheetData.push([name, form]);
                            }
                        }
                    }
                    
                    statusEl.textContent = `✅ Loaded ${spreadsheetData.length} entries from CSV`;
                    statusEl.style.color = '#4CAF50';
                } catch (error) {
                    statusEl.textContent = `❌ Error reading CSV: ${error.message}`;
                    statusEl.style.color = '#f44336';
                }
            });
        }

        function toTitleCase(str) {
            if (!str) return '';
            return String(str).toLowerCase()
                .replace(/_/g, ' ')
                .replace(/ fast$/i, '')
                .replace(/ pokemon move$/i, '')
                .replace(/\b\w/g, l => l.toUpperCase());
        }

        function updateStatus(message) {
            document.getElementById('status').innerHTML = message;
        }

        function updateStats(counts) {
            document.getElementById('pokemon-count').textContent = counts.pokemon || 0;
            document.getElementById('fast-pvp-count').textContent = counts.fastPvP || 0;
            document.getElementById('charge-pvp-count').textContent = counts.chargePvP || 0;
            
            const estimatedSize = (counts.pokemon * 2.5) + ((counts.fastPvP || 0) + (counts.chargePvP || 0)) * 0.3;
            document.getElementById('db-size').textContent = Math.round(estimatedSize) + ' KB';
        }

        let currentView = 'pokemon';
        let showAll = false;

        async function viewDatabase() {
            const preview = document.getElementById('preview');
            preview.innerHTML = '<h3>Loading from IndexedDB...</h3>';
            
            try {
                const pokemon = await loadFromDatabase('pokemon');
                const moves = await loadFromDatabase('moves');
                
                const fastPvP = moves.filter(m => m.category === 'fast' && m.mode === 'pvp');
                const chargePvP = moves.filter(m => m.category === 'charge' && m.mode === 'pvp');
                const fastPvE = moves.filter(m => m.category === 'fast' && m.mode === 'pve');
                const chargePvE = moves.filter(m => m.category === 'charge' && m.mode === 'pve');
                
                let html = `
                    <h3>📦 Database Contents</h3>
                    <p><strong>${pokemon.length}</strong> Pokemon, <strong>${moves.length}</strong> Moves</p>
                    <div style="margin-bottom: 20px;">
                        <button onclick="switchView('pokemon')" style="margin-right: 5px; ${currentView === 'pokemon' ? 'background: #2196F3;' : ''}">Pokemon (${pokemon.length})</button>
                        <button onclick="switchView('fastPvP')" style="margin-right: 5px; ${currentView === 'fastPvP' ? 'background: #2196F3;' : ''}">Fast PvP (${fastPvP.length})</button>
                        <button onclick="switchView('chargePvP')" style="margin-right: 5px; ${currentView === 'chargePvP' ? 'background: #2196F3;' : ''}">Charge PvP (${chargePvP.length})</button>
                        <button onclick="switchView('fastPvE')" style="margin-right: 5px; ${currentView === 'fastPvE' ? 'background: #2196F3;' : ''}">Fast PvE (${fastPvE.length})</button>
                        <button onclick="switchView('chargePvE')" style="${currentView === 'chargePvE' ? 'background: #2196F3;' : ''}">Charge PvE (${chargePvE.length})</button>
                    </div>
                    <button onclick="toggleShowAll()" class="secondary-btn" style="margin-bottom: 15px;">
                        ${showAll ? '📋 Show First 20' : '📜 Show All'}
                    </button>
                `;
                
                if (currentView === 'pokemon') {
                    const displayPokemon = showAll ? pokemon : pokemon.slice(0, 20);
                    displayPokemon.forEach(p => {
                        const typeBadges = p.types.map(t => 
                            `<span class="type-badge" style="background: ${TYPE_COLORS[t]}">${t}</span>`
                        ).join('');
                        
                        const evos = p.evolutions.map(e => {
                            const evoStr = e.form ? `${e.name} (${e.form})` : e.name;
                            const candyStr = e.candyCost > 0 ? ` [${e.candyCost} candy]` : '';
                            return evoStr + candyStr;
                        }).join(', ');
                        
                        const thirdMove = p.thirdMoveCost ? 
                            `<br>3rd Move: ${p.thirdMoveCost.stardust.toLocaleString()} dust, ${p.thirdMoveCost.candy} candy` : '';
                        
                        const typeCoverage = p.chargeTypeCoverage ? 
                            `<br>Charge Type Coverage: ${p.chargeTypeCoverage.count} types (${p.chargeTypeCoverage.types.join(', ')})` : '';
                        
                        const formatIV = (iv) => `${iv.atk}/${iv.def}/${iv.sta}`;
                        
                        html += `
                            <div class="pokemon-preview">
                                <strong>#${String(p.dexNumber).padStart(4, '0')} ${p.name}${p.form ? ' (' + p.form + ')' : ''}</strong><br>
                                ${typeBadges} | ${p.pokemonClass} | <strong>Max CP: ${p.maxCP || 'N/A'}</strong><br>
                                ATK: ${p.stats.attack} | DEF: ${p.stats.defense} | HP: ${p.stats.hp}<br>
                                Fast: ${p.moves.fast.join(', ')}<br>
                                Charge: ${p.moves.charge.join(', ')}
                                ${evos ? '<br>Evolves To: ' + evos : ''}
                                ${thirdMove}
                                ${typeCoverage}
                                ${p.little ? `<br><strong>Little League:</strong> ${formatIV(p.little.iv)} (SP: ${p.little.maxSP.toLocaleString()})` : ''}
                                ${p.great ? `<br><strong>Great League:</strong> ${formatIV(p.great.iv)} (SP: ${p.great.maxSP.toLocaleString()})` : ''}
                                ${p.ultra ? `<br><strong>Ultra League:</strong> ${formatIV(p.ultra.iv)} (SP: ${p.ultra.maxSP.toLocaleString()})` : ''}
                            </div>
                        `;
                    });
                } else {
                    let displayMoves = [];
                    if (currentView === 'fastPvP') displayMoves = fastPvP;
                    else if (currentView === 'chargePvP') displayMoves = chargePvP;
                    else if (currentView === 'fastPvE') displayMoves = fastPvE;
                    else if (currentView === 'chargePvE') displayMoves = chargePvE;
                    
                    const showMoves = showAll ? displayMoves : displayMoves.slice(0, 20);
                    showMoves.forEach(m => {
                        html += `
                            <div class="pokemon-preview">
                                <strong>${m.name}</strong> (${m.type})<br>
                                Power: ${m.power} | Energy: ${m.energy} | Duration: ${m.duration || m.durationMs || 0}<br>
                                ${m.durationMs ? `Duration: ${m.durationMs}ms | Window: ${m.damageWindowStartMs}-${m.damageWindowEndMs}ms<br>` : ''}
                                ${m.dpt ? `DPT: ${m.dpt.toFixed(2)} | EPT: ${m.ept.toFixed(2)}` : ''}
                                ${m.dpe ? `DPE: ${m.dpe.toFixed(2)}` : ''}
                                ${m.dps ? `<br>DPS: ${m.dps.toFixed(2)} | EPS: ${m.eps.toFixed(2)}` : ''}
                            </div>
                        `;
                    });
                }
                
                preview.innerHTML = html;
                
            } catch (error) {
                preview.innerHTML = `<p style="color: red;">Error loading database: ${error.message}</p>`;
            }
        }

        function switchView(view) {
            currentView = view;
            showAll = false;
            viewDatabase();
        }

        function calculateMaxCP(attack, defense, stamina) {
            return Math.floor(
                Math.pow(stamina + 15, 0.5) * 
                (attack + 15) * 
                Math.pow(defense + 15, 0.5) * 
                Math.pow(0.84030001, 2) / 10
            );
        }

        function toggleShowAll() {
            showAll = !showAll;
            viewDatabase();
        }

        async function downloadJSON() {
            try {
                const pokemon = await loadFromDatabase('pokemon');
                const moves = await loadFromDatabase('moves');
                const metadata = await loadFromDatabase('metadata');
                const typeEffectiveness = await loadFromDatabase('typeEffectiveness');
                const rankings = await loadFromDatabase('rankings');
                
                const exportData = {
                    metadata: metadata[0] || {},
                    pokemon: pokemon,
                    moves: moves,
                    typeEffectiveness: typeEffectiveness,
                    rankings: rankings
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `pokemon-go-database-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
                
            } catch (error) {
                alert('Error downloading: ' + error.message);
            }
        }

        async function downloadJSON() {
            try {
                const pokemon = await loadFromDatabase('pokemon');
                const moves = await loadFromDatabase('moves');
                const metadata = await loadFromDatabase('metadata');
                const typeEffectiveness = await loadFromDatabase('typeEffectiveness');
                const rankings = await loadFromDatabase('rankings');
                const cups = await loadFromDatabase('cups');
                const userPokemon = await loadFromDatabase('userPokemon');
                
                const exportData = {
                    metadata: metadata[0] || {},
                    pokemon: pokemon,
                    moves: moves,
                    typeEffectiveness: typeEffectiveness,
                    rankings: rankings,
                    cups: cups,
                    userPokemon: userPokemon // User's collection
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `pokemon-go-database-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
                
            } catch (error) {
                alert('Error downloading: ' + error.message);
            }
        }

        (async function init() {
            try {
                await initDatabase();
                
                const pokemon = await loadFromDatabase('pokemon');
                const moves = await loadFromDatabase('moves');
                const cups = await loadFromDatabase('cups');
                const userPokemon = await loadFromDatabase('userPokemon');
                
                if (pokemon.length > 0) {
                    updateStatus(`✅ Database loaded: ${pokemon.length} Pokemon, ${moves.length} moves${userPokemon.length > 0 ? `, ${userPokemon.length} in collection` : ''}.`);
                    updateStats({
                        pokemon: pokemon.length,
                        fastPvP: moves.filter(m => m.category === 'fast' && m.mode === 'pvp').length,
                        chargePvP: moves.filter(m => m.category === 'charge' && m.mode === 'pvp').length,
                        userCollection: userPokemon.length // Add this if you have a stats display
                    });
                    document.getElementById('view-btn').disabled = false;
                    document.getElementById('download-btn').disabled = false;
                    document.getElementById('scrape-btn').textContent = '🔄 Re-scrape Data';
                    
                    // Populate league checkboxes if cups exist
                    if (cups && cups.length > 0) {
                        await populateLeagueCheckboxes(cups);
                        document.getElementById('league-selection').style.display = 'block';
                    }
                }
                
            } catch (error) {
                updateStatus('⚠️ IndexedDB not initialized. Click "Start Scraping" to begin.');
            }
        })();