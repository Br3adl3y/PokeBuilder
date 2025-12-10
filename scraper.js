// ====================================
// AUTO-UPDATE DATABASE MANAGER
// ====================================
// Handles automatic scraping and incremental updates on app load

class AutoUpdateManager {
    constructor() {
        this.db = null;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000;
        this.GAME_MASTER_URL = 'https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json';
        
        // CPM array (Combat Power Multiplier for each level)
        this.cpm = [0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159, 0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];
        
        // Type effectiveness chart
        this.TYPES = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
        this.BASE_CHART = {
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
    }

    /**
     * Main initialization - called on app startup
     */
    async initialize(db) {
        this.db = db;
        
        try {
            console.log('AutoUpdateManager: Checking metadata...');
            const metadata = await this.getMetadata('lastUpdated');
            
            // Check if we got a valid result
            if (metadata && metadata.value) {
                console.log('Database found, last updated:', metadata.value);
                console.log('Checking for updates...');
                await this.checkForUpdates();
            } else {
                console.log('No lastUpdated found - running full scrape');
                await this.fullScrape();
            }
        } catch (error) {
            console.error('Error in initialize:', error);
            console.log('Running full scrape as fallback...');
            try {
                await this.fullScrape();
            } catch (scrapeError) {
                console.error('Full scrape also failed:', scrapeError);
                throw new Error('Failed to initialize database: ' + scrapeError.message);
            }
        }
        
        try {
            await this.loadRankingsFromJSON();
        } catch (rankingError) {
            console.warn('Rankings load failed (non-critical):', rankingError);
        }
    }

    async parseGameMaster(gameMaster, updateStatus = null, updateProgress = null) {
        const pokemon = [];
        const moves = [];
        const cups = [];
        const processedPokemon = new Set();
        
        const { pvpMoves, pveMoves } = this.buildMoveMaps(gameMaster);
        
        if (updateStatus) updateStatus('Parsing GBL schedule...');
        const scheduleData = this.parseVSSeekerSchedule(gameMaster);
        
        if (updateStatus) updateStatus('Parsing cup templates...');
        const parsedCups = this.parseCups(gameMaster);
        cups.push(...parsedCups);
        
        if (updateStatus) updateStatus('Parsing Pokemon...');
        for (const item of gameMaster) {
            if (!item.templateId?.startsWith('V') || !item.data?.pokemonSettings) continue;
            if (processedPokemon.has(item.templateId)) continue;
            
            try {
                const parsed = this.parsePokemon(item, pvpMoves, pveMoves, gameMaster);
                if (parsed && this.shouldIncludePokemon(parsed, pokemon)) {
                    pokemon.push(parsed);
                    processedPokemon.add(item.templateId);
                }
            } catch (error) {
                console.warn(`${item.templateId}: ${error.message}`);
            }
        }
        
        pokemon.sort((a, b) => a.dexNumber - b.dexNumber);
        
        if (updateStatus) updateStatus('Calculating PvP IVs... (~1 minute)');
        for (let i = 0; i < pokemon.length; i++) {
            const p = pokemon[i];
            
            if (i % 10 === 0) {
                if (updateProgress) updateProgress(i, pokemon.length, `PvP IVs: ${i}/${pokemon.length}`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            const littleWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 500, 0);
            const littleHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 500, 10);
            const greatWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 0);
            const greatHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 10);
            const ultraWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 0);
            const ultraHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 10);

            p.little = { iv: littleWild.iv, maxSP: littleWild.maxSP, minSP: littleWild.minSP, level: littleWild.level, cp: littleWild.cp, ivHatch: littleHatch.iv, maxSPHatch: littleHatch.maxSP, minSPHatch: littleHatch.minSP, needsXL: littleWild.level > 40 };
            p.great = { iv: greatWild.iv, maxSP: greatWild.maxSP, minSP: greatWild.minSP, level: greatWild.level, cp: greatWild.cp, ivHatch: greatHatch.iv, maxSPHatch: greatHatch.maxSP, minSPHatch: greatHatch.minSP, needsXL: greatWild.level > 40 };
            p.ultra = { iv: ultraWild.iv, maxSP: ultraWild.maxSP, minSP: ultraWild.minSP, level: ultraWild.level, cp: ultraWild.cp, ivHatch: ultraHatch.iv, maxSPHatch: ultraHatch.maxSP, minSPHatch: ultraHatch.minSP, needsXL: ultraWild.level > 40 };
            p.master = { iv: { atk: 15, def: 15, sta: 15 }, maxSP: Math.floor(((p.stats.attack + 15) * this.cpm[99]) * ((p.stats.defense + 15) * this.cpm[99]) * Math.max(10, Math.floor((p.stats.hp + 15) * this.cpm[99]))), minSP: Math.floor(((p.stats.attack + 15) * this.cpm[99]) * ((p.stats.defense + 15) * this.cpm[99]) * Math.max(10, Math.floor((p.stats.hp + 15) * this.cpm[99]))), level: 50, cp: this.calculateMaxCP(p.stats.attack, p.stats.defense, p.stats.hp), needsXL: true };
        }
        
        if (updateProgress) updateProgress(pokemon.length, pokemon.length, `PvP IVs: Complete`);
        
        if (updateStatus) updateStatus('Calculating PvE TDO scores... (~2-5 minutes)');

        // Fun splash texts
        const splashTexts = [
            'Sylveon says, "Trans Rights are Human Rights"',
            'Explaining Stat Product vs. Combat Power, again...',
            'Justifying why Flygon isn\'t Bug/Dragon...',
            'Using Strength on a truck...',
            'Wondering why Skelegirge got Blast Burn before Cinderace...',
            'Discriminating between Zoroark, Zeraora, and Zarude...',
            'Nickit says, "If you see someone shoplifting, no, you didn\'t"',
            'Saving XXS\'s for a showcase that will never come...',
            'Pondering my Voltorb...',
            'Error! Attempted to divide by Slaking\'s DPS...',
            'Avoiding eye contact with Hypno...',
            'Slowking says, "Boss makes a dollar, I make a dime, that\'s why I poop on company time"',
            'Blasting off again...',
            'Adding Unicode support for Nidoran�...',
            'Calculating odds of catching a mega shundo-shadynamax-XXL...',
            'Smeargle says, "1 part flour, 4 parts water, score with a razor blade"',
            'Humoring Regigigas that Normal Legendary isn\'t an oxymoron...',
            'Not thinking about what happened to all the pokémon you transfered to the professor...',
            'Filing a FAFSA for Wishiwashi...',
            'Contemplating Shuckle juice...',
            'Obstructing the FBI until Drifloon can get away...',
            'Realizing Cosmog weighs more than Wailord...',
            'Googling "Mimikyu upskirts"...',
            'Cleaning Dittos out of Mewtwo\'s litterbox...',
            'Xatu says, "Land Back"',
            'Generating Stunfisk\'s 3rd Dimension...',
            'Hey guys, did you know that in terms of male human and female Pokémon br...',
            'Bisharp says, "Eat the Rich"'
        ];

        const seriousMessage = 'Calculating PvE TDO scores... (~2-5 minutes)';
        let splashIndex = 0;
        let showSerious = false;

        // Custom update progress that alternates between serious and silly
        const customUpdateProgress = (current, total, message) => {
            if (current % 20 === 0 && current > 0) {
                if (showSerious) {
                    if (updateStatus) updateStatus(seriousMessage);
                } else {
                    if (updateStatus) updateStatus(splashTexts[splashIndex]);
                    splashIndex = (splashIndex + 1) % splashTexts.length;
                }
                showSerious = !showSerious;
            }
            if (updateProgress) updateProgress(current, total, message);
        };

        await this.calculatePvETDO(pokemon, pvpMoves, pveMoves, customUpdateProgress);
        
        pvpMoves.forEach((move, id) => {
            moves.push({ ...move, id: `pvp-${move.category}-${id}`, mode: 'pvp' });
        });
        pveMoves.forEach((move, id) => {
            moves.push({ ...move, id: `pve-${move.category}-${id}`, mode: 'pve' });
        });
        
        return { pokemon, moves: moves.sort((a, b) => a.name.localeCompare(b.name)), cups, scheduleData };
    }

    /**
     * Full scrape - only runs on first load
     */
    async fullScrape() {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 50%, #10b981 100%); z-index: 9999;">
                <div style="max-width: 500px; margin: 0 auto; padding: 32px; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                    <h1 style="color: white; text-align: center; font-size: 28px; font-weight: 300; letter-spacing: 0.1em; margin-bottom: 32px;">CREATING DATABASE</h1>
                    
                    <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 24px; margin-bottom: 16px;">
                        <div id="scrape-status" style="color: white; font-size: 16px; font-weight: 300; text-align: center;">
                            Fetching Game Master...
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.2); border-radius: 9999px; height: 12px; overflow: hidden; margin-bottom: 16px;">
                        <div id="scrape-progress-bar" style="width: 0%; height: 100%; background: rgba(255, 255, 255, 0.5); transition: width 0.3s ease; font-size: 10px; color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; white-space: nowrap;">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; text-align: center;">
                            <div id="scrape-pokemon-count" style="font-size: 36px; font-weight: bold; color: white;">0</div>
                            <div style="color: rgba(255, 255, 255, 0.8); margin-top: 8px; font-size: 12px; letter-spacing: 0.05em;">POKÉMON</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; text-align: center;">
                            <div id="scrape-fast-count" style="font-size: 36px; font-weight: bold; color: white;">0</div>
                            <div style="color: rgba(255, 255, 255, 0.8); margin-top: 8px; font-size: 12px; letter-spacing: 0.05em;">FAST</div>
                        </div>
                        <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 20px; text-align: center;">
                            <div id="scrape-charge-count" style="font-size: 36px; font-weight: bold; color: white;">0</div>
                            <div style="color: rgba(255, 255, 255, 0.8); margin-top: 8px; font-size: 12px; letter-spacing: 0.05em;">CHARGE</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const updateScrapeStatus = (message) => {
            document.getElementById('scrape-status').innerHTML = message;
        };
        
        const updateScrapeProgress = (current, total) => {
            const percent = Math.round((current / total) * 100);
            document.getElementById('scrape-progress-bar').style.width = percent + '%';
            document.getElementById('scrape-progress-bar').textContent = `${percent}% (${current}/${total})`;
        };
        
        try {
            updateScrapeStatus('Fetching Game Master from GitHub...');
            const gameMaster = await this.fetchGameMasterWithRetry();
            
            updateScrapeStatus(`Loaded ${gameMaster.length.toLocaleString()} templates. Parsing...`);
            const { pokemon, moves, cups, scheduleData } = await this.parseGameMaster(gameMaster, updateScrapeStatus, updateScrapeProgress);

            document.getElementById('scrape-pokemon-count').textContent = pokemon.length;
            document.getElementById('scrape-fast-count').textContent = moves.filter(m => m.category === 'fast' && m.mode === 'pvp').length;
            document.getElementById('scrape-charge-count').textContent = moves.filter(m => m.category === 'charge' && m.mode === 'pvp').length;
            
            updateScrapeStatus('Saving to IndexedDB...');
            await this.saveToDatabase('pokemon', pokemon);
            await this.saveToDatabase('moves', moves);
            await this.saveToDatabase('cups', cups);
            
            await this.saveToDatabase('metadata', [
                {
                    key: 'lastUpdated',
                    value: new Date().toISOString(),
                    gameMasterVersion: gameMaster[0]?.templateId || 'unknown',
                    pokemonCount: pokemon.length
                },
                {
                    key: 'activeSeasonCups',
                    value: Array.from(scheduleData.activeCupIds)
                },
                {
                    key: 'seasonSchedule',
                    value: { schedule: scheduleData.schedule }
                }
            ]);
            
            updateScrapeStatus('Fetching Team Rocket lineups from LeekDuck...');
            const rocketData = await this.scrapeRocketLineups();
            await this.saveToDatabase('metadata', [
                { key: 'rocketTeams', value: rocketData.teams },
                { key: 'rocketCatch', value: rocketData.catchable },
                { key: 'rocketLastUpdated', value: new Date().toISOString() }
            ]);
            
            updateScrapeStatus('Fetching Raid Boss lineups from LeekDuck...');
            const raidData = await this.scrapeRaidBosses();
            await this.saveToDatabase('metadata', [
                { key: 'raidCatch', value: raidData },
                { key: 'raidLastUpdated', value: new Date().toISOString() }
            ]);
            
            updateScrapeStatus('Calculating type effectiveness...');
            await this.calculateTypeEffectiveness();
            
            updateScrapeStatus('Scraping complete! Data saved to IndexedDB.');
            
            setTimeout(() => overlay.remove(), 2000);
            
        } catch (error) {
            overlay.remove();
            console.error('Full scrape failed:', error);
            alert('Failed to load game data: ' + error.message);
        }
    }

    /**
     * Check for updates - compares Game Master with existing database
     */
    async checkForUpdates() {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 50%, #10b981 100%); z-index: 9999;">
                <div style="max-width: 500px; margin: 0 auto; padding: 32px; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                    <h1 style="color: white; text-align: center; font-size: 28px; font-weight: 300; letter-spacing: 0.1em; margin-bottom: 32px;">CHECKING UPDATES</h1>
                    
                    <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 16px; padding: 24px; margin-bottom: 16px;">
                        <div id="update-status" style="color: white; font-size: 14px; font-weight: 300; text-align: center;">
                            Checking for new data...
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.2); border-radius: 9999px; height: 12px; overflow: hidden;">
                        <div id="update-progress-bar" style="width: 0%; height: 100%; background: rgba(255, 255, 255, 0.5); transition: width 0.3s ease; font-size: 10px; color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; white-space: nowrap;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const updateStatus = (message) => {
            const el = document.getElementById('update-status');
            if (el) el.innerHTML = message;
        };
        
        const updateProgress = (percent) => {
            const bar = document.getElementById('update-progress-bar');
            if (bar) {
                bar.style.width = percent + '%';
                bar.textContent = percent + '%';
            }
        };
        
        try {
            updateProgress(10);
            updateStatus('Fetching Game Master from GitHub...');
            const gameMaster = await this.fetchGameMasterWithRetry();
            
            updateProgress(20);
            updateStatus('Updating GBL schedule...');
            const scheduleData = this.parseVSSeekerSchedule(gameMaster);
            await this.saveToDatabase('metadata', [
                {
                    key: 'activeSeasonCups',
                    value: Array.from(scheduleData.activeCupIds)
                },
                {
                    key: 'seasonSchedule',
                    value: { schedule: scheduleData.schedule }
                }
            ]);
            
            updateProgress(30);
            updateStatus('Loading existing database...');
            const existingPokemon = await this.loadFromDatabase('pokemon');
            const existingMoves = await this.loadFromDatabase('moves');
            
            updateProgress(50);
            updateStatus('Parsing new data...');
            const { pvpMoves, pveMoves } = this.buildMoveMaps(gameMaster);
            
            const newPokemonData = [];
            const processedPokemon = new Set();
            
            for (const item of gameMaster) {
                if (!item.templateId?.startsWith('V') || !item.data?.pokemonSettings) continue;
                if (processedPokemon.has(item.templateId)) continue;
                
                try {
                    const parsed = this.parsePokemon(item, pvpMoves, pveMoves, gameMaster);
                    if (parsed && this.shouldIncludePokemon(parsed, newPokemonData)) {
                        newPokemonData.push(parsed);
                        processedPokemon.add(item.templateId);
                    }
                } catch (error) {
                    console.warn(`${item.templateId}: ${error.message}`);
                }
            }
            
            updateProgress(70);
            updateStatus('Comparing with existing data...');
            
            const newPokemon = newPokemonData.filter(p => 
                !existingPokemon.some(ep => ep.id === p.id)
            );
            
            const pokemonWithNewMoves = newPokemonData.filter(p => {
                const existing = existingPokemon.find(ep => ep.id === p.id);
                if (!existing) return false;
                
                const oldFast = (existing.moves.fast || []).sort().join(',');
                const oldFastElite = (existing.moves.fastElite || []).sort().join(',');
                const oldCharge = (existing.moves.charge || []).sort().join(',');
                const oldChargeElite = (existing.moves.chargeElite || []).sort().join(',');
                
                const newFast = (p.moves.fast || []).sort().join(',');
                const newFastElite = (p.moves.fastElite || []).sort().join(',');
                const newCharge = (p.moves.charge || []).sort().join(',');
                const newChargeElite = (p.moves.chargeElite || []).sort().join(',');
                
                return oldFast !== newFast || 
                    oldFastElite !== newFastElite || 
                    oldCharge !== newCharge || 
                    oldChargeElite !== newChargeElite;
            });
            
            const pokemonToCalculate = [...newPokemon, ...pokemonWithNewMoves];
            
            const newMoves = [];
            pvpMoves.forEach((move, id) => {
                const moveObj = { ...move, id: `pvp-${move.category}-${id}`, mode: 'pvp' };
                if (!existingMoves.some(em => em.id === moveObj.id)) {
                    newMoves.push(moveObj);
                }
            });
            pveMoves.forEach((move, id) => {
                const moveObj = { ...move, id: `pve-${move.category}-${id}`, mode: 'pve' };
                if (!existingMoves.some(em => em.id === moveObj.id)) {
                    newMoves.push(moveObj);
                }
            });
            
            if (pokemonToCalculate.length === 0 && newMoves.length === 0) {
                updateProgress(100);
                updateStatus('Database is up to date!');
                await this.scrapeLeekDuck();
                setTimeout(() => overlay.remove(), 1500);
                return;
            }
            
            updateProgress(80);
            updateStatus(`Calculating stats for ${pokemonToCalculate.length} pokemon...`);
            
            await this.calculatePvPIVs(pokemonToCalculate);
            await this.calculatePvETDO(pokemonToCalculate, pvpMoves, pveMoves);
            
            updateProgress(90);
            updateStatus('Saving to database...');
            
            await this.saveToDatabase('pokemon', pokemonToCalculate);
            if (newMoves.length > 0) {
                await this.saveToDatabase('moves', newMoves);
            }
            
            await this.saveToDatabase('metadata', [{
                key: 'lastUpdated',
                value: new Date().toISOString(),
                gameMasterVersion: gameMaster[0]?.templateId || 'unknown',
                pokemonCount: existingPokemon.length + newPokemon.length,
                newPokemonAdded: newPokemon.length,
                pokemonUpdated: pokemonWithNewMoves.length,
                newMovesAdded: newMoves.length
            }]);
            
            await this.scrapeLeekDuck();
            
            updateProgress(100);
            updateStatus(`✅ ${newPokemon.length} new, ${pokemonWithNewMoves.length} updated, ${newMoves.length} new moves!`);
            
            setTimeout(() => overlay.remove(), 2000);
            
        } catch (error) {
            overlay.remove();
            console.error('Update check failed:', error);
            alert('Update check failed: ' + error.message);
        }
    }
    
    /**
     * Fetch Game Master with retry logic
     */
    async fetchGameMasterWithRetry() {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(this.GAME_MASTER_URL + '?t=' + Date.now());
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                this.retryAttempts = 0;
                return data;
                
            } catch (error) {
                console.warn(`Fetch attempt ${attempt}/${this.maxRetries} failed:`, error);
                
                if (attempt === this.maxRetries) {
                    throw new Error(`Failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
    }

    /**
     * Scrape LeekDuck for Rocket and Raid data
     */
    async scrapeLeekDuck() {
        try {
            const rocketData = await this.scrapeRocketLineups();
            await this.saveToDatabase('metadata', [
                { key: 'rocketTeams', value: rocketData.teams },
                { key: 'rocketCatch', value: rocketData.catchable },
                { key: 'rocketLastUpdated', value: new Date().toISOString() }
            ]);
            
            const raidData = await this.scrapeRaidBosses();
            await this.saveToDatabase('metadata', [
                { key: 'raidCatch', value: raidData },
                { key: 'raidLastUpdated', value: new Date().toISOString() }
            ]);
            
            console.log('LeekDuck data updated');
            
        } catch (error) {
            console.warn('LeekDuck scrape failed (non-critical):', error);
        }
    }

    /**
     * Load rankings from JSON files
     */
    async loadRankingsFromJSON() {
        try {
            const response = await fetch('list.json');
            if (!response.ok) {
                console.log('No list.json found');
                return;
            }
            
            const files = await response.json();
            
            if (files.length === 0) {
                console.log('No ranking files in list');
                return;
            }
            
            // Sort by date (newest first)
            files.sort((a, b) => b.localeCompare(a));
            
            const allRankings = [];
            const seenLeagues = new Set();
            
            for (const filename of files) {
                try {
                    const fileResponse = await fetch(filename);
                    if (!fileResponse.ok) continue;
                    
                    const data = await fileResponse.json();
                    
                    // Your structure has "leagues" array at top level
                    if (Array.isArray(data.leagues)) {
                        data.leagues.forEach(league => {
                            const key = league.league; // Use league ID as key
                            
                            // Only add if not already present (newer files come first)
                            if (!seenLeagues.has(key)) {
                                seenLeagues.add(key);
                                
                                // Store with proper ID for IndexedDB
                                allRankings.push({
                                    id: key,
                                    league: key,
                                    cupName: league.cupTitle,
                                    cpLimit: league.cpLimit,
                                    calculatedAt: league.calculatedAt,
                                    rankings: league.rankings,
                                    sourceFile: filename,
                                    sourceDate: data.exportDate
                                });
                            }
                        });
                    }
                    
                } catch (error) {
                    console.warn(`Failed to load ${filename}:`, error);
                }
            }
            
            if (allRankings.length > 0) {
                await this.saveToDatabase('rankings', allRankings);
                console.log(`Loaded ${allRankings.length} league rankings from ${files.length} files`);
            }
            
        } catch (error) {
            console.warn('Could not load rankings:', error);
        }
    }            async discoverRankingFiles() {
        try {
            const response = await fetch('list.json');
            if (response.ok) {
                const files = await response.json();
                return files.map(filename => {
                    const dateMatch = filename.match(/pokemon-go-rankings-(\d{4}-\d{2}-\d{2})\.json/);
                    return {
                        name: filename,
                        url: `${filename}`,
                        date: dateMatch ? dateMatch[1] : '1970-01-01'
                    };
                });
            }
        } catch (error) {
            console.log('No rankings list found');
        }
        return [];
    }

    // ====================================
    // HELPER FUNCTIONS
    // ====================================

    buildMoveMaps(gameMaster) {
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
                name: this.toTitleCase(moveId),
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
                if (isPvP && move.buffs) {
                    moveData.buffs = {
                        activationChance: move.buffs.buffActivationChance || 0,
                        attackerAttackPercent: move.buffs.attackerAttackStatsChange ? (move.buffs.attackerAttackStatsChange * 0.125) : 0,
                        attackerDefensePercent: move.buffs.attackerDefenseStatsChange ? (move.buffs.attackerDefenseStatsChange * 0.125) : 0,
                        targetAttackPercent: move.buffs.targetAttackStatsChange ? (move.buffs.targetAttackStatsChange * 0.125) : 0,
                        targetDefensePercent: move.buffs.targetDefenseStatsChange ? (move.buffs.targetDefenseStatsChange * 0.125) : 0
                    };
                } else if (!isPvP) {
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

    parseVSSeekerSchedule(gameMaster) {
        const scheduleTemplate = gameMaster.find(item => item.templateId === 'VS_SEEKER_SCHEDULE_SETTINGS');
        
        if (!scheduleTemplate?.data?.vsSeekerScheduleSettings?.seasonSchedules) {
            console.warn('⚠️ VS_SEEKER_SCHEDULE_SETTINGS not found');
            return { activeCupIds: new Set(), schedule: [] };
        }
        
        const settings = scheduleTemplate.data.vsSeekerScheduleSettings;
        const activeCupIds = new Set();
        const schedule = [];
        const seasons = settings.seasonSchedules;
        const currentSeason = seasons[seasons.length - 1];
        
        for (const week of currentSeason.vsSeekerSchedules) {
            const weekData = {
                startTimeMs: week.startTimeMs,
                endTimeMs: week.endTimeMs,
                cupIds: week.vsSeekerLeagueTempalteId
            };
            schedule.push(weekData);
            for (const cupId of week.vsSeekerLeagueTempalteId) {
                activeCupIds.add(cupId);
            }
        }
        
        return { activeCupIds, schedule };
    }

    parseCups(gameMaster) {
        const cups = [];
        const nineMonthsAgo = Date.now() - (270 * 24 * 60 * 60 * 1000);
        
        for (const item of gameMaster) {
            if (!item.templateId?.startsWith('COMBAT_LEAGUE_') || !item.data?.combatLeague) continue;
            
            const id = item.templateId;
            const league = item.data.combatLeague;
            
            if (id.includes('SAFARI') || id.includes('GO_FEST') || id.includes('POKEMON_GO_TOUR')) continue;
            
            const yearMatch = id.match(/_(\d{4})_/);
            if (yearMatch && parseInt(yearMatch[1]) <= 2024) continue;
            
            const conditions = league.pokemonCondition || [];
            const timestampCondition = conditions.find(c => c.pokemonCaughtTimestamp);
            if (timestampCondition) {
                const beforeMs = parseInt(timestampCondition.pokemonCaughtTimestamp.beforeTimestamp);
                if (beforeMs < nineMonthsAgo) continue;
            }
            
            const cup = {
                id: id,
                title: this.cleanCupTitle(league.title || id),
                cpLimit: null,
                allowedTypes: [],
                allowedPokemon: [],
                bannedPokemon: league.bannedPokemon || [],
                maxLevel: null,
                isStandard: this.isStandardLeague(id)
            };
            
            for (const condition of conditions) {
                if (condition.type === 'WITH_POKEMON_CP_LIMIT') {
                    cup.cpLimit = condition.withPokemonCpLimit?.maxCp || null;
                }
                if (condition.type === 'WITH_POKEMON_TYPE') {
                    cup.allowedTypes = (condition.withPokemonType?.pokemonType || []).map(t => t.replace('POKEMON_TYPE_', ''));
                }
                if (condition.type === 'POKEMON_WHITELIST') {
                    cup.allowedPokemon = (condition.pokemonWhiteList?.pokemon || []).map(p => ({ id: p.id, form: p.form || null }));
                }
                if (condition.type === 'POKEMON_LEVEL_RANGE') {
                    cup.maxLevel = condition.pokemonLevelRange?.maxLevel || null;
                }
            }
            
            cups.push(cup);
        }
        
        return cups;
    }

    isStandardLeague(templateId) {
        const exactStandard = ['COMBAT_LEAGUE_VS_SEEKER_GREAT', 'COMBAT_LEAGUE_VS_SEEKER_ULTRA', 'COMBAT_LEAGUE_VS_SEEKER_MASTER', 'COMBAT_LEAGUE_VS_SEEKER_GREAT_LITTLE'];
        return exactStandard.includes(templateId);
    }

    cleanCupTitle(title) {
        title = title.replace(/_title$/, '').replace(/_cup_title$/, '');
        return title.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    parsePokemon(item, pvpMoves, pveMoves, gameMaster) {
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
            if (!isNidoran && (upper.includes('_MALE') || upper.includes('_FEMALE'))) return null;
            if (upper.startsWith('SHADOW') || upper.startsWith('_PURIFIED')) return null;
        }
        
        const pokeNameRaw = pokemonIdString.split('_')[0] || '';
        let name = this.toTitleCase(pokeNameRaw);
        let form = this.extractForm(templateId, settings.form, pokeNameRaw);
        ({ name, form } = this.applyNameOverrides(name, form, dexNumber, templateId, pokemonIdString));
        
        const type1 = (settings.type || '').split('_').pop() || 'NORMAL';
        const type2 = (settings.type2 || '').split('_').pop() || '';
        const stats = settings.stats || {};
        
        if (!stats.baseStamina && !isSpecial) return null;
        const moves = this.extractMoves(settings, pvpMoves, gameMaster);
        const isSmeargle = (dexNumber === 235);
        if (!moves.fast.length && !moves.charge.length && !isSmeargle) return null;
        
        const evolutions = this.extractEvolutions(settings, gameMaster);
        const thirdMoveCost = settings.thirdMove ? { stardust: settings.thirdMove.stardustToUnlock || 0, candy: settings.thirdMove.candyToUnlock || 0 } : null;
        const shadowInfo = settings.shadow ? { purificationStardust: settings.shadow.purificationStardustNeeded || 0, purificationCandy: settings.shadow.purificationCandyNeeded || 0, purifiedChargeMove: settings.shadow.purifiedChargeMove || '', shadowChargeMove: settings.shadow.shadowChargeMove || '' } : null;
        
        const baseAttack = stats.baseAttack || 0;
        const baseDefense = stats.baseDefense || 0;
        const baseStamina = stats.baseStamina || 0;
        
        const allChargeMoves = [...moves.charge, ...moves.chargeElite];
        const chargeMoveTypes = new Set();
        allChargeMoves.forEach(moveName => {
            const pvpMove = pvpMoves.get(this.getMoveId(moveName, pvpMoves));
            if (pvpMove) chargeMoveTypes.add(pvpMove.type);
        });
        const uniqueChargeTypes = Array.from(chargeMoveTypes);
        
        // Extract mega evolutions
        const megas = this.extractMegaEvolutions(settings);
        
        // Extract size data
        const pokedexHeightM = settings.pokedexHeightM || null;
        const pokedexWeightKg = settings.pokedexWeightKg || null;
        const heightStdDev = settings.heightStdDev || null;
        const weightStdDev = settings.weightStdDev || null;
        
        return {
            id: `${name}-${form || 'base'}`,
            dexNumber,
            name,
            form,
            types: [type1, type2].filter(t => t),
            stats: { attack: baseAttack, defense: baseDefense, hp: baseStamina },
            maxCP: this.calculateMaxCP(baseAttack, baseDefense, baseStamina),
            moves,
            evolutions,
            megas,
            pokemonClass: settings.pokemonClass || 'NORMAL',
            thirdMoveCost,
            shadowInfo,
            templateId,
            chargeTypeCoverage: { count: uniqueChargeTypes.length, types: uniqueChargeTypes },
            pokedexHeightM,
            pokedexWeightKg,
            heightStdDev,
            weightStdDev
        };
    }

extractMegaEvolutions(settings) {
    if (!settings.tempEvoOverrides || settings.tempEvoOverrides.length === 0) {
        return null;
    }
    
    const megas = [];
    
    for (const tempEvo of settings.tempEvoOverrides) {
        if (!tempEvo.tempEvoId || !tempEvo.tempEvoId.includes('MEGA')) continue;
        
        const megaData = {
            tempEvoId: tempEvo.tempEvoId,
            stats: {
                attack: tempEvo.stats?.baseAttack || 0,
                defense: tempEvo.stats?.baseDefense || 0,
                hp: tempEvo.stats?.baseStamina || 0
            },
            types: [],
            maxCP: 0,
            form: '' // 'Mega' or 'Mega X' or 'Mega Y' or "Mega Z'
        };
        
        // Extract types
        const type1 = (tempEvo.typeOverride1 || '').split('_').pop() || '';
        const type2 = (tempEvo.typeOverride2 || '').split('_').pop() || '';
        megaData.types = [type1, type2].filter(t => t);
        
        // Calculate Mega CP
        megaData.maxCP = this.calculateMaxCP(
            megaData.stats.attack,
            megaData.stats.defense,
            megaData.stats.hp
        );
        
        // Determine form name
        if (tempEvo.tempEvoId.includes('_X')) {
            megaData.form = 'Mega X';
        } else if (tempEvo.tempEvoId.includes('_Y')) {
            megaData.form = 'Mega Y';
        } else {
            megaData.form = 'Mega';
        }
        
        megas.push(megaData);
    }
    
    return megas.length > 0 ? megas : null;
}

getMoveId(moveName, moveMap) {
    for (const [id, move] of moveMap.entries()) {
        if (move.name === moveName) return id;
    }
    return null;
}

extractMoves(settings, moveMap, gameMaster) {
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
                    return this.toTitleCase(item.templateId.substring(idx + 6));
                }
            }
        }
        return this.toTitleCase(String(moveId));
    };
    
    const moves = { fast: [], fastElite: [], charge: [], chargeElite: [] };
    
    if (settings.quickMoves) {
        moves.fast = settings.quickMoves.map(resolveMove).filter(m => m);
    }
    if (settings.eliteQuickMove) {
        moves.fastElite = settings.eliteQuickMove.map(resolveMove).filter(m => m);
    }
    
    let chargeList = [...(settings.cinematicMoves || [])];
    if (settings.nonTmCinematicMoves) chargeList.push(...settings.nonTmCinematicMoves);
    if (settings.formChange) {
        for (const fc of settings.formChange) {
            if (fc.moveReassignment?.cinematicMoves) {
                for (const reassign of fc.moveReassignment.cinematicMoves) {
                    if (reassign.replacementMoves) chargeList.push(...reassign.replacementMoves);
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

extractEvolutions(settings, gameMaster) {
    const evolutions = [];
    if (settings.evolutionBranch) {
        for (const branch of settings.evolutionBranch) {
            const evoId = branch.form || branch.evolution;
            if (!evoId) continue;
            const evolutionData = { name: '', form: '', candyCost: branch.candyCost || 0, candyCostPurified: branch.candyCostPurified || 0 };
            if (typeof evoId === 'string') {
                const parts = evoId.split('_');
                
                // Special case for MR_MIME and MR_RIME
                if (parts[0].toUpperCase() === 'MR' && parts.length > 1) {
                    if (parts[1].toUpperCase() === 'MIME') {
                        evolutionData.name = 'Mr. Mime';
                        // Check if there's a regional form after MIME
                        if (parts.length > 2) {
                            if (parts[2].toUpperCase().includes('GALARIAN') || parts[2].toUpperCase().includes('GALAR')) {
                                evolutionData.form = 'Galarian';
                            }
                        }
                    } else if (parts[1].toUpperCase() === 'RIME') {
                        evolutionData.name = 'Mr. Rime';
                        // Check if there's a regional form
                        if (parts.length > 2) {
                            const formStr = parts.slice(2).join('_').toUpperCase();
                            if (formStr.includes('GALARIAN') || formStr.includes('GALAR')) {
                                evolutionData.form = 'Galarian';
                            }
                        }
                    }
                } else {
                    // Normal processing for other Pokemon
                    evolutionData.name = this.toTitleCase(parts[0]);
                    if (parts.length > 1) {
                        const formStr = parts.slice(1).join('_').toUpperCase();
                        if (formStr.includes('ALOLA')) evolutionData.form = 'Alolan';
                        else if (formStr.includes('GALARIAN') || formStr.includes('GALAR')) evolutionData.form = 'Galarian';
                        else if (formStr.includes('HISUIAN') || formStr.includes('HISUI')) evolutionData.form = 'Hisuian';
                        else if (formStr.includes('PALDEAN') || formStr.includes('PALDEA')) evolutionData.form = 'Paldean';
                        else if (formStr === 'NORMAL' || formStr === 'STANDARD') evolutionData.form = '';
                        else evolutionData.form = this.toTitleCase(parts.slice(1).join('_'));
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

shouldIncludePokemon(pokemon, existingPokemon) {
    if (/\d{4}/.test(pokemon.form)) return false;
    
    // Special handling for form variants that should always be included
    const alwaysIncludeForms = ['ORIGINAL_COLOR', 'RESOLUTE', 'ORIGIN', 'ARMORED', 'SHADOW', 'PURIFIED'];
    if (alwaysIncludeForms.some(form => pokemon.form.toUpperCase().includes(form) || pokemon.templateId.includes(form))) {
        return true;
    }
    
    const key = `${pokemon.dexNumber}|${pokemon.name}|${pokemon.types.join(',')}|${pokemon.stats.attack}|${pokemon.stats.defense}|${pokemon.stats.hp}|${pokemon.moves.fast.join(',')}|${pokemon.moves.fastElite.join(',')}|${pokemon.moves.charge.join(',')}|${pokemon.moves.chargeElite.join(',')}`;
    const duplicateIndex = existingPokemon.findIndex(p => {
        const existingKey = `${p.dexNumber}|${p.name}|${p.types.join(',')}|${p.stats.attack}|${p.stats.defense}|${p.stats.hp}|${p.moves.fast.join(',')}|${p.moves.fastElite.join(',')}|${p.moves.charge.join(',')}|${p.moves.chargeElite.join(',')}`;
        return existingKey === key;
    });
    
    if (duplicateIndex !== -1) {
        const existing = existingPokemon[duplicateIndex];
        if (pokemon.form === '' && existing.form.toUpperCase() === 'NORMAL') {
            existingPokemon[duplicateIndex] = pokemon;
            return false;
        }
        if (pokemon.form.toUpperCase() === 'NORMAL' && existing.form === '') return false;
        return false;
    }
    return true;
}

extractForm(templateId, formField, pokeNameRaw) {
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
    
    // FIX: Keep the full Paldean form name
    if (rawSuffix.includes('PALDEA')) {
        if (rawSuffix.includes('COMBAT')) return 'Paldean Combat';
        if (rawSuffix.includes('BLAZE')) return 'Paldean Blaze';
        if (rawSuffix.includes('AQUA')) return 'Paldean Aqua';
        return 'Paldean';
    }
    
    if (rawSuffix.includes('ORIGIN')) return 'Origin';
    if (rawSuffix.includes('ZEN')) return 'Zen';
    if (rawSuffix.includes('MEGA')) return 'Mega';
    if (formField && typeof formField === 'string' && (!rawSuffix || rawSuffix.toUpperCase() === 'NORMAL')) {
        return this.toTitleCase(formField.split('_').pop());
    }
    return this.toTitleCase(rawSuffix);
}

applyNameOverrides(name, form, dexNumber, templateId, pokemonIdString) {
    const nameUpper = name.toUpperCase();
    if (dexNumber === 32 || dexNumber === 29) {
        const idUpper = pokemonIdString.toUpperCase();
        if (idUpper.includes('NIDORAN_FEMALE')) return { name: 'Nidoran♀', form: '' };
        else if (idUpper.includes('NIDORAN_MALE')) return { name: 'Nidoran♂', form: '' };
    }
    if (nameUpper === 'MR' && name === 'Mr') {
        name = 'Mr. Mime';
        if (form.toUpperCase().includes('RIME')) {  // Change from form === 'Rime' to includes('RIME')
            name = 'Mr. Rime'; 
            form = form.replace(/rime/gi, '').trim() || '';  // Remove 'Rime' from form, keep rest
        }
        else if (form.toUpperCase().includes('GALARIAN')) form = 'Galarian';
        else if (form.toUpperCase() === 'NORMAL') form = 'Normal';
        else form = '';
    } else if (nameUpper === 'HO') {
        name = 'Ho-Oh';
        if (form.toUpperCase() === 'OH') form = '';
    } else if (dexNumber === 439) {
        name = 'Mime Jr.'; form = '';
    } else if (dexNumber === 474) {
        name = 'Porygon-Z'; form = '';
    } else if (dexNumber === 772) {
        name = 'Type: Null'; form = '';
    }
    return { name, form };
}

toTitleCase(str) {
    if (!str) return '';
    return String(str).toLowerCase().replace(/_/g, ' ').replace(/ fast$/i, '').replace(/ pokemon move$/i, '').replace(/\b\w/g, l => l.toUpperCase());
}

calculateMaxCP(attack, defense, stamina) {
    return Math.floor(Math.pow(stamina + 15, 0.5) * (attack + 15) * Math.pow(defense + 15, 0.5) * Math.pow(0.84030001, 2) / 10);
}

async calculatePvPIVs(pokemon) {
    for (let i = 0; i < pokemon.length; i++) {
        const p = pokemon[i];
        
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const littleWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 500, 0);
        const littleHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 500, 10);
        const greatWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 0);
        const greatHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 1500, 10);
        const ultraWild = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 0);
        const ultraHatch = this.calculatePvPIVsForLeague(p.stats.attack, p.stats.defense, p.stats.hp, 2500, 10);

        p.little = { 
            iv: littleWild.iv, 
            maxSP: littleWild.maxSP, 
            minSP: littleWild.minSP, 
            level: littleWild.level, 
            cp: littleWild.cp, 
            ivHatch: littleHatch.iv, 
            maxSPHatch: littleHatch.maxSP, 
            minSPHatch: littleHatch.minSP,
            needsXL: littleWild.level > 40
        };

        p.great = { 
            iv: greatWild.iv, 
            maxSP: greatWild.maxSP, 
            minSP: greatWild.minSP, 
            level: greatWild.level, 
            cp: greatWild.cp, 
            ivHatch: greatHatch.iv, 
            maxSPHatch: greatHatch.maxSP, 
            minSPHatch: greatHatch.minSP,
            needsXL: greatWild.level > 40
        };

        p.ultra = { 
            iv: ultraWild.iv, 
            maxSP: ultraWild.maxSP, 
            minSP: ultraWild.minSP, 
            level: ultraWild.level, 
            cp: ultraWild.cp, 
            ivHatch: ultraHatch.iv, 
            maxSPHatch: ultraHatch.maxSP, 
            minSPHatch: ultraHatch.minSP,
            needsXL: ultraWild.level > 40
        };

        p.master = { 
            iv: { atk: 15, def: 15, sta: 15 }, 
            maxSP: Math.floor(((p.stats.attack + 15) * this.cpm[99]) * ((p.stats.defense + 15) * this.cpm[99]) * Math.max(10, Math.floor((p.stats.hp + 15) * this.cpm[99]))), 
            minSP: Math.floor(((p.stats.attack) * this.cpm[99]) * ((p.stats.defense) * this.cpm[99]) * Math.max(10, Math.floor((p.stats.hp) * this.cpm[99]))), 
            level: 50, 
            cp: this.calculateMaxCP(p.stats.attack, p.stats.defense, p.stats.hp),
            needsXL: true
        };

        // Calculate IVs for mega forms if they exist
        if (p.megas) {
            p.megas.forEach(mega => {
                const megaGreat = this.calculatePvPIVsForLeague(mega.stats.attack, mega.stats.defense, mega.stats.hp, 1500, 0);
                const megaUltra = this.calculatePvPIVsForLeague(mega.stats.attack, mega.stats.defense, mega.stats.hp, 2500, 0);
                
                mega.great = {
                    iv: megaGreat.iv,
                    maxSP: megaGreat.maxSP,
                    minSP: megaGreat.minSP,
                    level: megaGreat.level,
                    cp: megaGreat.cp,
                    needsXL: megaGreat.level > 40
                };
                
                mega.ultra = {
                    iv: megaUltra.iv,
                    maxSP: megaUltra.maxSP,
                    minSP: megaUltra.minSP,
                    level: megaUltra.level,
                    cp: megaUltra.cp,
                    needsXL: megaUltra.level > 40
                };
                
                mega.master = {
                    iv: { atk: 15, def: 15, sta: 15 },
                    maxSP: Math.floor(((mega.stats.attack + 15) * this.cpm[99]) * ((mega.stats.defense + 15) * this.cpm[99]) * Math.max(10, Math.floor((mega.stats.hp + 15) * this.cpm[99]))),
                    minSP: Math.floor(((mega.stats.attack + 15) * this.cpm[99]) * ((mega.stats.defense + 15) * this.cpm[99]) * Math.max(10, Math.floor((mega.stats.hp + 15) * this.cpm[99]))),
                    level: 50,
                    cp: this.calculateMaxCP(mega.stats.attack, mega.stats.defense, mega.stats.hp),
                    needsXL: true
                };
            });
    }
}
}

calculatePvPIVsForLeague(baseatk, basedef, basesta, league, floor) {
    const sortedRanks = this.calculate(baseatk, basedef, basesta, floor, 1, 50, false, league);
    const rank1 = this.getRank1IVS(sortedRanks);
    const worst = this.getWorstIVS(sortedRanks);
    if (rank1) {
        const maxSP = Math.floor(rank1.battle.A * rank1.battle.D * rank1.battle.S);
        const minSP = worst ? Math.floor(worst.battle.A * worst.battle.D * worst.battle.S) : maxSP;
        return { iv: { atk: rank1.IVs.A, def: rank1.IVs.D, sta: rank1.IVs.S }, maxSP: maxSP, minSP: minSP, level: rank1.L, cp: rank1.CP };
    }
    const maxCP = Math.max(10, Math.floor((baseatk + 15) * Math.sqrt(basedef + 15) * Math.sqrt(basesta + 15) * Math.pow(this.cpm[99], 2) / 10));
    if (maxCP <= league) {
        const maxSP = Math.floor(((baseatk + 15) * this.cpm[99]) * ((basedef + 15) * this.cpm[99]) * Math.max(10, Math.floor((basesta + 15) * this.cpm[99])));
        return { iv: { atk: 15, def: 15, sta: 15 }, maxSP: maxSP, minSP: maxSP, level: 50, cp: maxCP };
    }
    return { iv: { atk: 0, def: 0, sta: 0 }, maxSP: 0, minSP: 0, level: 1, cp: 0 };
}

calculate(baseatk, basedef, basesta, floor, minLvl, maxLvl, invalid, league) {
    const ranks = {};
    const minIV = floor / 1;
    let minLvlIndex = Math.max(0, (minLvl - 1) * 2);
    let maxLvlIndex = Math.max(0, (maxLvl - 1) * 2);
    for (let atk = minIV; atk <= 15; atk++) {
        for (let def = minIV; def <= 15; def++) {
            for (let sta = minIV; sta <= 15; sta++) {
                for (let levelIndex = maxLvlIndex; levelIndex >= minLvlIndex; levelIndex--) {
                    const cpmValue = this.cpm[levelIndex];
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
                    const result = { "IVs": { "A": atk, "D": def, "S": sta }, "battle": { "A": aSt, "D": dSt, "S": sSt }, "L": (levelIndex / 2) + 1, "CP": cp };
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

getRank1IVS(sortedRanks) {
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

getWorstIVS(sortedRanks) {
    const keys = Object.keys(sortedRanks);
    if (keys.length === 0) return null;
    const worstKey = keys[keys.length - 1];
    let worstRanks = sortedRanks[worstKey];
    if (worstRanks.length === 0) return null;
    return worstRanks[0];
}

async calculatePvETDO(pokemon, pvpMoves, pveMoves, updateProgress = null) {
    const TYPES = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING', 'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
    const dualTypes = [];
    for (let i = 0; i < TYPES.length; i++) {
        for (let j = i + 1; j < TYPES.length; j++) {
            dualTypes.push(`${TYPES[i]}/${TYPES[j]}`);
        }
    }
    const allDefenderTypes = [...TYPES, ...dualTypes];
    
    for (let i = 0; i < pokemon.length; i++) {
        const p = pokemon[i];
        
        if (i % 20 === 0) {
            if (updateProgress) {
                updateProgress(i, pokemon.length, `PvE TDO: ${i}/${pokemon.length}`);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        p.raidTDO = {};
        p.rocketTDO = {};
        p.spamTDO = [];
        
        if (p.shadowInfo) {
            p.shadowRaidTDO = {};
            p.shadowRocketTDO = {};
            p.shadowSpamTDO = [];
        }
        
        const pveFastMoves = p.moves.fast.map(name => 
            Array.from(pveMoves.values()).find(m => m.name === name && m.category === 'fast')
        ).filter(m => m);
        
        const pveChargeMoves = [...p.moves.charge, ...p.moves.chargeElite].map(name =>
            Array.from(pveMoves.values()).find(m => m.name === name && m.category === 'charge')
        ).filter(m => m);
        
        const pvpFastMoves = p.moves.fast.map(name => 
            Array.from(pvpMoves.values()).find(m => m.name === name && m.category === 'fast')
        ).filter(m => m);
        
        const pvpChargeMoves = [...p.moves.charge, ...p.moves.chargeElite].map(name =>
            Array.from(pvpMoves.values()).find(m => m.name === name && m.category === 'charge')
        ).filter(m => m);
        
        this.calculateTDOForVariant(p, pveFastMoves, pveChargeMoves, pvpFastMoves, pvpChargeMoves, allDefenderTypes, false);
        
        if (p.shadowInfo) {
            this.calculateTDOForVariant(p, pveFastMoves, pveChargeMoves, pvpFastMoves, pvpChargeMoves, allDefenderTypes, true);
        }

        // Calculate TDO for mega forms
        if (p.megas) {
            p.megas.forEach(mega => {
                mega.raidTDO = {};
                
                for (const defenderType of allDefenderTypes) {
                    mega.raidTDO[defenderType] = {
                        L40_15_15_15: this.calculateBestTDOForLevel(
                            { ...p, stats: mega.stats, types: mega.types },
                            pveFastMoves,
                            pveChargeMoves,
                            defenderType,
                            { atk: 15, def: 15, sta: 15 },
                            40,
                            true,
                            false,
                            true
                        ),
                        L50_15_15_15: this.calculateBestTDOForLevel(
                            { ...p, stats: mega.stats, types: mega.types },
                            pveFastMoves,
                            pveChargeMoves,
                            defenderType,
                            { atk: 15, def: 15, sta: 15 },
                            50,
                            true,
                            false,
                            true
                        )
                    };
                }
            });
        }
    

    }
    
    if (updateProgress) {
        updateProgress(pokemon.length, pokemon.length, `PvE TDO: Complete`);
    }
}   

calculateTDOForVariant(p, pveFastMoves, pveChargeMoves, pvpFastMoves, pvpChargeMoves, allDefenderTypes, isShadow) {
    const raidKey = isShadow ? 'shadowRaidTDO' : 'raidTDO';
    const rocketKey = isShadow ? 'shadowRocketTDO' : 'rocketTDO';
    const spamKey = isShadow ? 'shadowSpamTDO' : 'spamTDO';
    
    // Calculate raid TDO for both IV spreads
    for (const defenderType of allDefenderTypes) {
        p[raidKey][defenderType] = {
            L40_15_0_15: this.calculateBestTDOForLevel(p, pveFastMoves, pveChargeMoves, defenderType, { atk: 15, def: 0, sta: 15 }, 40, true, isShadow, true),
            L40_15_15_15: this.calculateBestTDOForLevel(p, pveFastMoves, pveChargeMoves, defenderType, { atk: 15, def: 15, sta: 15 }, 40, true, isShadow, true),
            L50_15_0_15: this.calculateBestTDOForLevel(p, pveFastMoves, pveChargeMoves, defenderType, { atk: 15, def: 0, sta: 15 }, 50, true, isShadow, true),
            L50_15_15_15: this.calculateBestTDOForLevel(p, pveFastMoves, pveChargeMoves, defenderType, { atk: 15, def: 15, sta: 15 }, 50, true, isShadow, true)
        };
    }
    
    // **UPDATED: Now stores DPS along with TDO**
    for (const defenderType of allDefenderTypes) {
        p[rocketKey][defenderType] = {
            L40: this.calculateBestTDOForLevel(p, pvpFastMoves, pvpChargeMoves, defenderType, { atk: 15, def: 15, sta: 15 }, 40, false, isShadow, false),
            L50: this.calculateBestTDOForLevel(p, pvpFastMoves, pvpChargeMoves, defenderType, { atk: 15, def: 15, sta: 15 }, 50, false, isShadow, false)
        };
    }
    
    const spammyMovesets = [];
    for (const fast of pvpFastMoves) {
        for (const charge of pvpChargeMoves) {
            const spamScore = (1 / (charge.energy / fast.ept)) * 100;
            if (spamScore > 11) {
                const movesetTypes = [fast.type, charge.type].sort().join('/');
                
                const existingIndex = spammyMovesets.findIndex(ms => 
                    [ms.fast.type, ms.charge.type].sort().join('/') === movesetTypes
                );
                
                if (existingIndex === -1) {
                    spammyMovesets.push({
                        fast: fast,
                        charge: charge,
                        spamScore: spamScore,
                        typeSignature: movesetTypes
                    });
                } else {
                    if (spamScore > spammyMovesets[existingIndex].spamScore) {
                        spammyMovesets[existingIndex] = {
                            fast: fast,
                            charge: charge,
                            spamScore: spamScore,
                            typeSignature: movesetTypes
                        };
                    }
                }
            }
        }
    }
    
    // **UPDATED: Now stores DPS along with TDO**
    for (const spamMoveset of spammyMovesets) {
        const tdoByType = {};
        
        for (const defenderType of allDefenderTypes) {
            const resultL40 = this.simulateRaidBattle(p, spamMoveset.fast, spamMoveset.charge, defenderType, { atk: 15, def: 15, sta: 15 }, 40, false, isShadow, false);
            const resultL50 = this.simulateRaidBattle(p, spamMoveset.fast, spamMoveset.charge, defenderType, { atk: 15, def: 15, sta: 15 }, 50, false, isShadow, false);
            
            tdoByType[defenderType] = {
                L40: { 
                    tdo: resultL40.tdo, 
                    dps: resultL40.dps,  // **NEW**
                    moveset: { fast: spamMoveset.fast.rawId, charge: spamMoveset.charge.rawId } 
                },
                L50: { 
                    tdo: resultL50.tdo, 
                    dps: resultL50.dps,  // **NEW**
                    moveset: { fast: spamMoveset.fast.rawId, charge: spamMoveset.charge.rawId } 
                }
            };
        }
        
        p[spamKey].push({
            moveset: { fast: spamMoveset.fast.rawId, charge: spamMoveset.charge.rawId },
            spamScore: spamMoveset.spamScore,
            typeSignature: spamMoveset.typeSignature,
            tdoByType: tdoByType
        });
    }
}

calculateBestTDOForLevel(pokemon, fastMoves, chargeMoves, defenderType, ivs, level, dummyAttacks, isShadow, isRaid) {
    let bestResult = { tdo: 0, dps: 0, timeTaken: 0, moveset: null };
    
    for (const fast of fastMoves) {
        for (const charge of chargeMoves) {
            const result = this.simulateRaidBattle(pokemon, fast, charge, defenderType, ivs, level, dummyAttacks, isShadow, isRaid);
            
            if (result.tdo > bestResult.tdo) {
                bestResult = {
                    tdo: result.tdo,
                    dps: result.dps,
                    timeTaken: result.timeTaken,
                    moveset: { fast: fast.rawId, charge: charge.rawId }
                };
            }
        }
    }
    
    // **UPDATED: Return DPS for both raid and rocket**
    return {
        tdo: bestResult.tdo,
        dps: bestResult.dps,  // **NEW: Always return DPS**
        moveset: bestResult.moveset
    };
}

simulateRaidBattle(pokemon, fastMove, chargeMove, defenderType, ivs, level, dummyAttacks, isShadow, isRaid) {
    const shadowAtkMultiplier = isShadow ? 1.2 : 1.0;
    const shadowDefMultiplier = isShadow ? 0.833 : 1.0;
    
    const levelIndex = Math.round((level - 1) * 2);
    const pokemonCPM = this.cpm[levelIndex];
    
    const attackerAtk = (pokemon.stats.attack + ivs.atk) * pokemonCPM * shadowAtkMultiplier;
    const attackerDef = (pokemon.stats.defense + ivs.def) * pokemonCPM * shadowDefMultiplier;
    const attackerHP = Math.floor((pokemon.stats.hp + ivs.sta) * pokemonCPM);
    
    const defenderAtk = 100 * 1;
    const defenderDef = 100 * 1;
    
    let attackerCurrentHP = attackerHP;
    let attackerEnergy = 0;
    let timeElapsed = 0;
    let totalDamage = 0;
    let defenderEnergy = 0;
    
    const isShedinja = pokemon.dexNumber === 292;
    const maxDuration = (isRaid && !isShedinja) ? Infinity : 100000;
    
    while (timeElapsed < maxDuration && attackerCurrentHP > 0) {
        const fastDamage = this.calculatePvEDamage(
            attackerAtk, 
            defenderDef, 
            fastMove.power, 
            fastMove.type, 
            defenderType, 
            pokemon.types
        );
        
        totalDamage += fastDamage;
        
        attackerEnergy += fastMove.energy;
        
        if (dummyAttacks) {
            defenderEnergy += Math.floor(fastDamage / 2);
        }
        
        timeElapsed += fastMove.durationMs || 1000;
        
        if (attackerEnergy >= chargeMove.energy) {
            attackerEnergy -= chargeMove.energy;
            
            const chargeDamage = this.calculatePvEDamage(
                attackerAtk, 
                defenderDef, 
                chargeMove.power, 
                chargeMove.type, 
                defenderType, 
                pokemon.types
            );
            
            totalDamage += chargeDamage;
            
            if (dummyAttacks) {
                defenderEnergy += Math.floor(chargeDamage / 2);
            }
        }
        
        if (dummyAttacks && defenderEnergy >= 50) {
            defenderEnergy -= 50;
            
            const defenseDamage = Math.floor(0.5 * 50 * (defenderAtk / attackerDef)) + 1;
            attackerCurrentHP -= defenseDamage;
            
            attackerEnergy += Math.floor(defenseDamage / 2);
            attackerEnergy = Math.min(100, attackerEnergy);
        }
        
        if (dummyAttacks && timeElapsed % 1000 === 0) {
            const defenseFastDamage = 3;
            attackerCurrentHP -= defenseFastDamage;
            
            attackerEnergy += Math.floor(defenseFastDamage / 2);
            attackerEnergy = Math.min(100, attackerEnergy);
            
            defenderEnergy += 3;
        }
        
        attackerEnergy = Math.min(100, attackerEnergy);
    }
    
    const timeInSeconds = timeElapsed / 1000;
    const dps = timeInSeconds > 0 ? totalDamage / timeInSeconds : 0;
    
    return {
        tdo: totalDamage,
        dps: dps,
        timeTaken: timeInSeconds
    };
}

calculatePvEDamage(attackStat, defenseStat, movePower, moveType, defenderType, attackerTypes) {
    const effectiveness = this.getTypeEffectivenessForTDO(moveType, defenderType);
    const stab = attackerTypes.includes(moveType) ? 1.2 : 1.0;
    
    const damage = Math.floor(0.5 * movePower * (attackStat / defenseStat) * effectiveness * stab) + 1;
    return damage;
}

getTypeEffectivenessForTDO(attackType, defenderType) {
    if (defenderType.includes('/')) {
        const [type1, type2] = defenderType.split('/');
        const idx1 = this.TYPES.indexOf(type1);
        const idx2 = this.TYPES.indexOf(type2);
        if (idx1 === -1 || idx2 === -1) return 1;
        const eff1 = this.BASE_CHART[attackType]?.[idx1] || 1;
        const eff2 = this.BASE_CHART[attackType]?.[idx2] || 1;
        return eff1 * eff2;
    } else {
        const idx = this.TYPES.indexOf(defenderType);
        if (idx === -1) return 1;
        return this.BASE_CHART[attackType]?.[idx] || 1;
    }
}

async scrapeRocketLineups() {
    try {
        const response = await fetch('https://leekduck.com/rocket-lineups');
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const teams = {
            grunts: { male: {}, female: {} },
            leaders: {},
            giovanni: null
        };
        
        const catchable = {
            fromGrunt: new Set(),
            fromLeader: new Set(),
            fromGiovanni: new Set()
        };
        
        const profiles = doc.querySelectorAll('.rocket-profile');
        
        for (const profile of profiles) {
            const nameEl = profile.querySelector('.name');
            if (!nameEl) continue;
            
            const fullName = nameEl.textContent.trim();
            const isGrunt = fullName.includes('Grunt');
            const isMale = fullName.includes('Male');
            const isFemale = fullName.includes('Female');
            
            const slots = profile.querySelectorAll('.slot');
            const teamData = { slot1: [], slot2: [], slot3: [] };
            
            let slotIndex = 1;
            for (const slot of slots) {
                const slotKey = `slot${slotIndex}`;
                const isEncounter = slot.querySelector('.encounter-icon') !== null;
                
                const shadowPokemon = slot.querySelectorAll('.shadow-pokemon');
                
                for (const mon of shadowPokemon) {
                    const pokemonName = mon.getAttribute('data-pokemon');
                    const type1 = mon.getAttribute('data-type1');
                    const type2 = mon.getAttribute('data-type2');
                    
                    const types = [type1.toUpperCase()];
                    if (type2 && type2 !== 'None') {
                        types.push(type2.toUpperCase());
                    }
                    
                    teamData[slotKey].push(types);
                    
                    if (isEncounter) {
                        if (isGrunt) {
                            catchable.fromGrunt.add(pokemonName);
                        } else if (fullName.toLowerCase() === 'giovanni') {
                            catchable.fromGiovanni.add(pokemonName);
                        } else {
                            catchable.fromLeader.add(pokemonName);
                        }
                    }
                }
                
                slotIndex++;
            }
            
            if (isGrunt) {
                if (isMale) {
                    teams.grunts.male[fullName] = teamData;
                } else if (isFemale) {
                    teams.grunts.female[fullName] = teamData;
                }
            } else if (fullName.toLowerCase() === 'giovanni') {
                teams.giovanni = teamData;
            } else {
                const leaderName = fullName.toLowerCase();
                teams.leaders[leaderName] = teamData;
            }
        }
        
        return {
            teams: teams,
            catchable: {
                fromGrunt: Array.from(catchable.fromGrunt).sort(),
                fromLeader: Array.from(catchable.fromLeader).sort(),
                fromGiovanni: Array.from(catchable.fromGiovanni).sort()
            }
        };
    } catch (error) {
        console.error('Error scraping Rocket lineups:', error);
        return {
            teams: { grunts: { male: {}, female: {} }, leaders: {}, giovanni: null },
            catchable: { fromGrunt: [], fromLeader: [], fromGiovanni: [] }
        };
    }
}

async scrapeRaidBosses() {
    try {
        const response = await fetch('https://leekduck.com/boss');
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const catchable = {
            fromRaid: new Set(),
            fromMega: new Set(),
            fromShadow: new Set()
        };
        
        const regularSection = doc.querySelector('.raid-bosses');
        if (regularSection) {
            const headers = regularSection.querySelectorAll('.header');
            
            for (const header of headers) {
                const tier = header.getAttribute('data-tier');
                const isMega = tier === 'Mega';
                
                let sibling = header.nextElementSibling;
                while (sibling && !sibling.classList.contains('header')) {
                    const nameEl = sibling.querySelector('.name');
                    if (nameEl) {
                        const pokemonName = nameEl.textContent.trim();
                        
                        if (isMega) {
                            catchable.fromMega.add(pokemonName);
                        } else {
                            catchable.fromRaid.add(pokemonName);
                        }
                    }
                    sibling = sibling.nextElementSibling;
                }
            }
        }
        
        const shadowSection = doc.querySelector('.shadow-raid-bosses');
        if (shadowSection) {
            const names = shadowSection.querySelectorAll('.name');
            for (const nameEl of names) {
                const pokemonName = nameEl.textContent.trim();
                catchable.fromShadow.add(pokemonName);
            }
        }
        
        return {
            fromRaid: Array.from(catchable.fromRaid).sort(),
            fromMega: Array.from(catchable.fromMega).sort(),
            fromShadow: Array.from(catchable.fromShadow).sort()
        };
    } catch (error) {
        console.error('Error scraping Raid bosses:', error);
        return {
            fromRaid: [],
            fromMega: [],
            fromShadow: []
        };
    }
}

async calculateTypeEffectiveness() {
    const { matrix, allDefenders } = this.buildExpandedMatrix();
    const dualScores = this.calculateDualPageRank(matrix, 30, 0.85);
    const maxDefScore = Math.max(...dualScores.defensive);
    const defensiveRankings = allDefenders.map((type, idx) => ({
        type: type,
        score: (dualScores.defensive[idx] / maxDefScore) * 100,
        offensiveScore: dualScores.offensive[idx],
        isDual: type.includes('/')
    })).sort((a, b) => b.score - a.score);
    
    await this.saveToDatabase('typeEffectiveness', [
        { id: 'defensiveRankings', data: defensiveRankings, calculatedAt: new Date().toISOString() },
        { id: 'damageMatrix', matrix: matrix.slice(0, 18), attackerTypes: this.TYPES, defenderTypes: allDefenders, calculatedAt: new Date().toISOString() }
    ]);
}

buildExpandedMatrix() {
    const dualTypes = this.generateDualTypes();
    const allTypes = [...this.TYPES, ...dualTypes];
    const matrix = [];
    for (let attackerIdx = 0; attackerIdx < this.TYPES.length; attackerIdx++) {
        const row = [];
        const attacker = this.TYPES[attackerIdx];
        for (let defenderIdx = 0; defenderIdx < this.TYPES.length; defenderIdx++) {
            row.push(this.BASE_CHART[attacker][defenderIdx]);
        }
        for (const dualDefender of dualTypes) {
            const [defType1, defType2] = dualDefender.split('/');
            const defType1Idx = this.TYPES.indexOf(defType1);
            const defType2Idx = this.TYPES.indexOf(defType2);
            const mult = this.BASE_CHART[attacker][defType1Idx] * this.BASE_CHART[attacker][defType2Idx];
            row.push(mult);
        }
        matrix.push(row);
    }
    return { matrix, allDefenders: allTypes };
}

generateDualTypes() {
    const dualTypes = [];
    for (let i = 0; i < this.TYPES.length; i++) {
        for (let j = i + 1; j < this.TYPES.length; j++) {
            dualTypes.push(`${this.TYPES[i]}/${this.TYPES[j]}`);
        }
    }
    return dualTypes;
}

calculateDualPageRank(matrix, iterations = 30, dampingFactor = 0.85) {
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
// ====================================
// DATABASE HELPERS
// ====================================

async saveToDatabase(storeName, data) {
    // If store doesn't exist, we need to create it by upgrading the DB
    if (!this.db.objectStoreNames.contains(storeName)) {
        console.log(`Creating missing store: ${storeName}`);
        
        // Close current connection
        this.db.close();
        
        // Reopen with incremented version to trigger upgrade
        const currentVersion = this.db.version;
        const newDb = await new Promise((resolve, reject) => {
            const request = indexedDB.open('PokemonGoDB', currentVersion + 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        this.db = newDb;
    }
    
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    for (const item of data) {
        await store.put(item);
    }
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async loadFromDatabase(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async getMetadata(key) {
    const transaction = this.db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');
    const request = store.get(key);
    
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ====================================
// UI FEEDBACK
// ====================================

showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 transition-opacity ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    } text-white font-medium`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
}
