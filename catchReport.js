// ====================================
// catchReport.js - CATCH REPORT MODULE
// ====================================

// This is a placeholder for the full catch report feature
// The catch report will show:
// - Pokemon details (sprite, name, form, CP, level, IVs)
// - IV efficiency for each league
// - PvP rankings and viability
// - Evolution chain and costs
// - Recommended movesets
// - Power-up costs to reach optimal levels
// - Type effectiveness
// - Move analysis

class CatchReport {
    constructor(app) {
        this.app = app;
    }

    async show(pokemonId, userData) {
        // Get Pokemon data from game master
        const pokemon = this.app.pokemon.find(p => 
            p.name.toLowerCase() === userData.name.toLowerCase() &&
            (!userData.form || p.form === userData.form)
        );

        if (!pokemon) {
            this.showError('Pokemon not found in database');
            return;
        }

        // Calculate IV percentage
        const ivPercent = ((userData.ivs.attack + userData.ivs.defense + userData.ivs.stamina) / 45 * 100).toFixed(1);

        const modalHtml = `
            <div class="fixed inset-0 bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 z-50 flex items-center justify-center p-4" data-modal="catch-report">
                <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center space-y-4">
                    <div class="text-green-500">
                        <i class="fa-solid fa-circle-check text-6xl mb-4"></i>
                        <h2 class="text-3xl font-bold text-gray-800">${userData.name} Saved!</h2>
                        ${userData.nickname ? `<p class="text-lg text-gray-600 italic">"${userData.nickname}"</p>` : ''}
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div class="flex justify-between">
                            <span class="text-gray-600">CP:</span>
                            <span class="font-bold text-gray-800">${userData.cp}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Level:</span>
                            <span class="font-bold text-gray-800">${userData.level || '?'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">IVs:</span>
                            <span class="font-bold text-gray-800">${userData.ivs.attack}/${userData.ivs.defense}/${userData.ivs.stamina} (${ivPercent}%)</span>
                        </div>
                        ${userData.dateCaught ? `
                            <div class="flex justify-between">
                                <span class="text-gray-600">Caught:</span>
                                <span class="font-bold text-gray-800">${new Date(userData.dateCaught).toLocaleDateString()}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${userData.shiny ? `
                        <div class="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-3">
                            <p class="text-yellow-800 font-bold">✨ SHINY ✨</p>
                        </div>
                    ` : ''}

                    ${userData.shadow ? `
                        <div class="bg-purple-100 border-2 border-purple-400 rounded-xl p-3">
                            <p class="text-purple-800 font-bold">👤 SHADOW</p>
                        </div>
                    ` : ''}

                    <p class="text-sm text-gray-500 pt-4">
                        Full Catch Report coming soon...<br>
                        Will include PvP rankings, optimal IVs, movesets, and more!
                    </p>
                    
                    <button 
                        class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition font-semibold"
                        data-action="close-catch-report"
                    >
                        Done
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('[data-modal="catch-report"]');
        modal.querySelector('[data-action="close-catch-report"]').addEventListener('click', () => {
            modal.remove();
        });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            if (modal.parentNode) modal.remove();
        }, 3000);
    }

    showError(message) {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="error">
                <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                    <div class="text-red-500 text-center">
                        <i class="fa-solid fa-circle-exclamation text-5xl mb-3"></i>
                        <h2 class="text-2xl font-bold text-gray-800">Error</h2>
                    </div>
                    <p class="text-gray-600 text-center">${message}</p>
                    <button 
                        class="w-full bg-gray-200 text-gray-700 rounded-xl py-3 hover:bg-gray-300 transition"
                        data-action="close-error"
                    >
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('[data-modal="error"]');
        modal.querySelector('[data-action="close-error"]').addEventListener('click', () => {
            modal.remove();
        });
    }

    // Future methods to implement:
    // - calculateIVEfficiency(pokemon, ivs, league)
    // - getPVPRankings(pokemon, league)
    // - getOptimalMovesets(pokemon, league)
    // - calculatePowerUpCosts(currentLevel, targetLevel)
    // - getEvolutionChain(pokemon)
    // - renderLeagueComparison(pokemon, ivs)
    // - renderTypeEffectiveness(pokemon)
    // - renderMoveAnalysis(pokemon)
}