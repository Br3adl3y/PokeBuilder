// ====================================
// addMon.js - SCREENSHOT PROCESSING MODULE
// ====================================

class ScreenshotProcessor {
    constructor(app) {
        this.app = app;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }); // ADD THIS
        this.batchImages = [];
        this.currentBatchIndex = 0;
        this.isDesktop = !('ontouchstart' in window);
        this.tesseractWorker = null;
    }

 // Process batch images one by one
    async processBatch() {
        if (this.currentBatchIndex >= this.batchImages.length) {
            this.batchImages = [];
            this.currentBatchIndex = 0;
            this.showBatchCompleteModal();
            return;
        }

        const file = this.batchImages[this.currentBatchIndex];
        
        this.showProcessingModal(`Processing ${this.currentBatchIndex + 1} of ${this.batchImages.length}...`);

        try {
            const imageData = await this.loadImage(file);
            const extractedData = await this.processScreenshot(imageData);
            
            this.hideProcessingModal();
            this.showConfirmationModal(extractedData, imageData, true);
        } catch (error) {
            console.error('Error processing screenshot:', error);
            this.hideProcessingModal();
            
            this.showSkipImageModal(error.message);
        }
    }

    setupNameAutocomplete(modal) {
        const nameInput = modal.querySelector('[data-field="name"]');
        const formSelect = modal.querySelector('[data-field="form"]');
        
        // Create autocomplete dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto hidden';
        dropdown.setAttribute('data-autocomplete', 'dropdown');
        
        nameInput.parentElement.style.position = 'relative';
        nameInput.parentElement.appendChild(dropdown);
        
        // Show dropdown on focus or input
        const showDropdown = () => {
            const query = nameInput.value.toLowerCase().trim();
            
            // Get unique Pokemon names
            const uniqueNames = [...new Set(this.app.pokemon.map(p => p.name))];
            
            // Filter and sort
            let matches = uniqueNames.filter(name => 
                name.toLowerCase().includes(query)
            ).sort();
            
            // Limit to 10 results
            matches = matches.slice(0, 10);
            
            if (matches.length === 0 || (matches.length === 1 && matches[0].toLowerCase() === query)) {
                dropdown.classList.add('hidden');
                return;
            }
            
            // Populate dropdown
            dropdown.innerHTML = matches.map(name => `
                <div class="px-4 py-2 hover:bg-teal-100 cursor-pointer transition text-gray-800" data-name="${name}">
                    ${this.highlightMatch(name, query)}
                </div>
            `).join('');
            
            dropdown.classList.remove('hidden');
            
            // Add click handlers
            dropdown.querySelectorAll('[data-name]').forEach(item => {
                item.addEventListener('click', () => {
                    nameInput.value = item.dataset.name;
                    dropdown.classList.add('hidden');
                    
                    // Update form options and moves
                    this.updateFormOptions(nameInput.value, formSelect);
                    this.updateMoveOptions(nameInput.value, formSelect.value, modal);
                    this.updateCalculatedLevel(modal);
                    
                    // Clear any validation errors
                    nameInput.classList.remove('ring-2', 'ring-red-500');
                    const errorMsg = nameInput.parentElement.querySelector('.validation-error');
                    if (errorMsg) errorMsg.remove();
                });
            });
        };
        
        nameInput.addEventListener('input', showDropdown);
        nameInput.addEventListener('focus', showDropdown);
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!nameInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        // Keyboard navigation
        let selectedIndex = -1;
        nameInput.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('[data-name]');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
                selectedIndex = -1;
            } else if (e.key === 'Escape') {
                dropdown.classList.add('hidden');
                selectedIndex = -1;
            }
        });
        
        function updateSelection(items, index) {
            items.forEach((item, i) => {
                if (i === index) {
                    item.classList.add('bg-teal-100');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('bg-teal-100');
                }
            });
        }
    }

    highlightMatch(text, query) {
        if (!query) return text;
        
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text;
        
        const before = text.slice(0, index);
        const match = text.slice(index, index + query.length);
        const after = text.slice(index + query.length);
        
        return `${before}<strong class="text-teal-600">${match}</strong>${after}`;
    }

    validateFormData(modal) {
        const errors = [];
        
        // Get values
        const name = modal.querySelector('[data-field="name"]').value.trim();
        const cp = modal.querySelector('[data-field="cp"]').value;
        const ivAtk = modal.querySelector('[data-field="ivAttack"]').value;
        const ivDef = modal.querySelector('[data-field="ivDefense"]').value;
        const ivSta = modal.querySelector('[data-field="ivStamina"]').value;
        const dateCaught = modal.querySelector('[data-field="dateCaught"]').value;
        
        // Validate Pokemon name (required)
        if (!name) {
            errors.push({ field: 'name', message: 'Pokémon name is required' });
        } else {
            // Check if Pokemon exists in database
            const pokemon = this.app.pokemon.find(p => 
                p.name.toLowerCase() === name.toLowerCase()
            );
            if (!pokemon) {
                errors.push({ field: 'name', message: 'Pokémon not found in database' });
            }
        }
        
        // Validate CP (required, 0-9999)
        if (!cp) {
            errors.push({ field: 'cp', message: 'CP is required' });
        } else {
            const cpNum = parseInt(cp);
            if (isNaN(cpNum) || cpNum < 0 || cpNum > 9999) {
                errors.push({ field: 'cp', message: 'CP must be between 0 and 9999' });
            }
        }
        
        // Validate IVs (required, 0-15)
        if (ivAtk === '') {
            errors.push({ field: 'ivAttack', message: 'Attack IV is required' });
        } else {
            const val = parseInt(ivAtk);
            if (isNaN(val) || val < 0 || val > 15) {
                errors.push({ field: 'ivAttack', message: 'Attack IV must be 0-15' });
            }
        }
        
        if (ivDef === '') {
            errors.push({ field: 'ivDefense', message: 'Defense IV is required' });
        } else {
            const val = parseInt(ivDef);
            if (isNaN(val) || val < 0 || val > 15) {
                errors.push({ field: 'ivDefense', message: 'Defense IV must be 0-15' });
            }
        }
        
        if (ivSta === '') {
            errors.push({ field: 'ivStamina', message: 'Stamina IV is required' });
        } else {
            const val = parseInt(ivSta);
            if (isNaN(val) || val < 0 || val > 15) {
                errors.push({ field: 'ivStamina', message: 'Stamina IV must be 0-15' });
            }
        }
        
        // Validate date (required, not in future)
        if (!dateCaught) {
            errors.push({ field: 'dateCaught', message: 'Date caught is required' });
        } else {
            const caughtDate = new Date(dateCaught);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today
            
            if (caughtDate > today) {
                errors.push({ field: 'dateCaught', message: 'Date cannot be in the future' });
            }
            
            // Pokemon GO launched July 6, 2016
            const pogoLaunch = new Date('2016-07-06');
            if (caughtDate < pogoLaunch) {
                errors.push({ field: 'dateCaught', message: 'Date cannot be before Pokémon GO launched (July 6, 2016)' });
            }
        }
        
        return errors;
    }

    showValidationErrors(modal, errors) {
        // Clear existing error states
        modal.querySelectorAll('.border-red-500, .ring-red-500').forEach(el => {
            el.classList.remove('border-red-500', 'ring-red-500', 'ring-2');
        });
        
        // Remove existing error messages
        modal.querySelectorAll('.validation-error').forEach(el => el.remove());
        
        // Show new errors
        errors.forEach(error => {
            const field = modal.querySelector(`[data-field="${error.field}"]`);
            if (field) {
                // Highlight field
                field.classList.add('ring-2', 'ring-red-500');
                
                // Add error message below field
                const errorMsg = document.createElement('p');
                errorMsg.className = 'validation-error text-red-200 text-xs mt-1';
                errorMsg.textContent = error.message;
                field.parentElement.appendChild(errorMsg);
            }
        });
        
        // Scroll to first error
        if (errors.length > 0) {
            const firstErrorField = modal.querySelector(`[data-field="${errors[0].field}"]`);
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
        }
    }

    // Show screenshot capture modal
    showCaptureModal() {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="screenshot">
                <div class="bg-gradient-to-br from-teal-400 to-teal-500 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                    <h2 class="text-2xl font-bold text-white">Add Pokémon</h2>
                    <p class="text-teal-50">Upload screenshots from Pokémon GO</p>
                    
                    <div class="space-y-3">
                        ${!this.isDesktop ? `
                            <button 
                                class="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl py-4 flex items-center justify-center gap-3 hover:bg-opacity-30 transition border border-white border-opacity-20"
                                data-action="single-pokemon"
                            >
                                <i class="fa-solid fa-image text-xl"></i>
                                <span>Single Pokémon</span>
                            </button>
                        ` : ''}
                        
                        <button 
                            class="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl py-4 flex items-center justify-center gap-3 hover:bg-opacity-30 transition border border-white border-opacity-20"
                            data-action="batch-upload"
                        >
                            <i class="fa-solid fa-images text-xl"></i>
                            <span>Batch Upload</span>
                        </button>
                        
                        ${this.batchImages.length > 0 ? `
                            <button 
                                class="w-full bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl py-4 flex items-center justify-center gap-3 hover:bg-opacity-30 transition border border-white border-opacity-20"
                                data-action="continue-batch"
                            >
                                <i class="fa-solid fa-play text-xl"></i>
                                <span>Continue Batch (${this.currentBatchIndex + 1}/${this.batchImages.length})</span>
                            </button>
                        ` : ''}
                    </div>
                    
                    <button 
                        class="w-full bg-white bg-opacity-10 backdrop-blur-sm text-white rounded-xl py-3 mt-4 hover:bg-opacity-20 transition border border-white border-opacity-20"
                        data-action="close-modal"
                    >
                        Cancel
                    </button>
                    
                    <input 
                        type="file" 
                        accept="image/*" 
                        ${this.isDesktop ? 'multiple' : ''}
                        class="hidden" 
                        data-input="file-upload"
                    />
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.attachModalListeners();
    }

    attachModalListeners() {
        const modal = document.querySelector('[data-modal="screenshot"]');
        if (!modal) return;

        modal.querySelector('[data-action="close-modal"]').addEventListener('click', () => {
            modal.remove();
        });

        const singleBtn = modal.querySelector('[data-action="single-pokemon"]');
        if (singleBtn) {
            singleBtn.addEventListener('click', () => {
                modal.querySelector('[data-input="file-upload"]').click();
            });
        }

        modal.querySelector('[data-action="batch-upload"]').addEventListener('click', () => {
            modal.querySelector('[data-input="file-upload"]').click();
        });

        const continueBtn = modal.querySelector('[data-action="continue-batch"]');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                modal.remove();
                this.processBatch();
            });
        }

        modal.querySelector('[data-input="file-upload"]').addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            modal.remove();
            
            if (files.length === 1 && !this.isDesktop) {
                this.handleSingleImage(files[0]);
            } else {
                this.handleBatchUpload(files);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Handle single image upload
    async handleSingleImage(file) {
        if (!file) return;

        this.showProcessingModal();

        try {
            const imageData = await this.loadImage(file);
            const extractedData = await this.processScreenshot(imageData);
            
            this.hideProcessingModal();
            this.showConfirmationModal(extractedData, imageData);
        } catch (error) {
            console.error('Error processing screenshot:', error);
            this.hideProcessingModal();
            this.showErrorModal(error.message);
        }
    }

    // Handle batch upload
    async handleBatchUpload(files) {
        this.batchImages = files;
        this.currentBatchIndex = 0;
        this.processBatch();
    }


    updateMoveOptions(pokemonName, form, modal) {
        const pokemon = this.app.pokemon.find(p => 
            p.name.toLowerCase() === pokemonName.toLowerCase() &&
            (!form || p.form === form)
        );
        
        if (!pokemon) return;
        
        const fastSelect = modal.querySelector('[data-field="currentFastMove"]');
        const charge1Select = modal.querySelector('[data-field="currentChargeMove1"]');
        const charge2Select = modal.querySelector('[data-field="currentChargeMove2"]');
        
        // Populate fast moves
        fastSelect.innerHTML = '<option value="" class="bg-teal-600">None</option>';
        if (pokemon.fastMoves) {
            pokemon.fastMoves.forEach(moveId => {
                const move = this.app.moves.find(m => m.id === moveId || m.rawId === moveId);
                if (move) {
                    fastSelect.innerHTML += `<option value="${moveId}" class="bg-teal-600">${move.name}</option>`;
                }
            });
        }
        
        // Populate charged moves
        const chargeOptions = '<option value="" class="bg-teal-600">None</option>' + 
            (pokemon.chargedMoves || []).map(moveId => {
                const move = this.app.moves.find(m => m.id === moveId || m.rawId === moveId);
                return move ? `<option value="${moveId}" class="bg-teal-600">${move.name}</option>` : '';
            }).join('');
        
        charge1Select.innerHTML = chargeOptions;
        charge2Select.innerHTML = chargeOptions;
    }

    calculateLevel(pokemon, cp, ivAttack, ivDefense, ivStamina) {
    if (!pokemon || !cp || ivAttack === '' || ivDefense === '' || ivStamina === '') {
        return null;
    }
        
    const baseAtk = pokemon.attack;
    const baseDef = pokemon.defense;
    const baseSta = pokemon.stamina;
    
    const totalAtk = baseAtk + ivAttack;
    const totalDef = baseDef + ivDefense;
    const totalSta = baseSta + ivStamina;
    
    let closestLevel = 1;
    let minDiff = Infinity;
    
    // Check each level (array index * 0.5 + 1 = level)
    for (let i = 0; i < cpm.length; i++) {
        const level = (i * 0.5) + 1;
        const calculatedCP = Math.max(10, Math.floor(
            totalAtk * Math.sqrt(totalDef) * Math.sqrt(totalSta) * cpm[i] * cpm[i] / 10
        ));
        
        const diff = Math.abs(calculatedCP - cp);
        
        if (diff < minDiff) {
            minDiff = diff;
            closestLevel = level;
        }
        
        if (diff === 0) break;
    }
    
    return closestLevel;
}

    // Show processing modal
    showProcessingModal(message = 'Processing Screenshot...') {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="processing">
                <div class="bg-white rounded-2xl p-8 text-center">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p class="text-gray-700 font-semibold">${message}</p>
                    <p class="text-gray-500 text-sm mt-2">This may take a few seconds</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    hideProcessingModal() {
        const modal = document.querySelector('[data-modal="processing"]');
        if (modal) modal.remove();
    }

    // Show confirmation/edit modal
    showConfirmationModal(data, imageData, isBatch = false) {
        const needsAttention = this.getFieldsNeedingAttention(data);
        
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto py-8" data-modal="confirmation">
                <div class="flex items-start justify-center min-h-full p-4">
                    <div class="bg-gradient-to-br from-teal-400 to-teal-500 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl">
                        <div class="flex justify-between items-start">
                            <div>
                                <h2 class="text-2xl font-bold text-white">Review Pokémon Data</h2>
                                <p class="text-teal-50">Please verify and complete the information</p>
                            </div>
                            ${isBatch ? `
                                <div class="text-sm text-white bg-white bg-opacity-20 px-3 py-1 rounded-full backdrop-blur-sm">
                                    ${this.currentBatchIndex + 1} / ${this.batchImages.length}
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <!-- Screenshot Preview Column -->
                            <div>
                                <img src="${imageData.dataUrl}" alt="Screenshot" class="w-full rounded-lg shadow-lg">
                            </div>
                            
                            <!-- Form Fields Column -->
                            <div class="space-y-3">
                                ${needsAttention.length > 0 ? `
                                    <div class="bg-yellow-500 bg-opacity-20 backdrop-blur-sm border border-yellow-300 border-opacity-50 rounded-lg p-4">
                                        <div class="flex items-start gap-2">
                                            <i class="fa-solid fa-triangle-exclamation text-yellow-100 mt-1"></i>
                                            <div>
                                                <p class="font-semibold text-white">Attention Required</p>
                                                <ul class="text-sm text-teal-50 mt-1 space-y-1">
                                                    ${needsAttention.map(field => `<li>• ${field}</li>`).join('')}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                                
                                <div>
                                    <label class="block text-sm font-medium text-white mb-1">
                                        Pokémon Name ${this.getConfidenceBadge(data.nameConfidence)}
                                    </label>
                                    <input 
                                        type="text" 
                                        value="${data.name}" 
                                        data-field="name"
                                        class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.nameConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                        placeholder="e.g., Pikachu"
                                    />
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-white mb-1">Form (if applicable)</label>
                                    <select 
                                        data-field="form"
                                        class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                    >
                                        <option value="" class="bg-teal-600">Normal</option>
                                    </select>
                                    <p class="text-xs text-teal-100 mt-1">Forms will populate based on selected Pokémon</p>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-white mb-1">Nickname </label>
                                    <input 
                                        type="text" 
                                        value="${data.nickname}" 
                                        data-field="nickname"
                                        class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                        placeholder="Custom nickname"
                                    />
                                </div>
                                
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-sm font-medium text-white mb-1">
                                            CP ${this.getConfidenceBadge(data.cpConfidence)}
                                        </label>
                                        <input 
                                            type="number" 
                                            value="${data.cp}" 
                                            data-field="cp"
                                            class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.cpConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                            placeholder="0-9999"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-white mb-1">
                                            Level (auto)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.5" 
                                            value="" 
                                            data-field="level"
                                            disabled
                                            class="w-full px-3 py-2 bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 rounded-lg text-teal-100"
                                            placeholder="Calculated"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-white mb-1">
                                        Date Caught ${this.getConfidenceBadge(data.dateCaughtConfidence)}
                                    </label>
                                    <input 
                                        type="date" 
                                        value="${data.dateCaught}" 
                                        data-field="dateCaught"
                                        class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.dateCaughtConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                    />
                                </div>
                                
                                <div class="border-t border-white border-opacity-20 pt-3">
                                    <label class="block text-sm font-medium text-white mb-2">Individual Values (IVs)</label>
                                    <div class="grid grid-cols-3 gap-2">
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">
                                                ATK ${this.getConfidenceBadge(data.ivAttackConfidence, true)}
                                            </label>
                                            <input 
                                                type="number" 
                                                inputmode="numeric"
                                                min="0" 
                                                max="15" 
                                                value="${data.ivAttack}" 
                                                data-field="ivAttack"
                                                data-iv-field="attack"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white text-center placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.ivAttackConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                                placeholder="0-15"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">
                                                DEF ${this.getConfidenceBadge(data.ivDefenseConfidence, true)}
                                            </label>
                                            <input 
                                                type="number" 
                                                inputmode="numeric"
                                                min="0" 
                                                max="15" 
                                                value="${data.ivDefense}" 
                                                data-field="ivDefense"
                                                data-iv-field="defense"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white text-center placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.ivDefenseConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                                placeholder="0-15"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">
                                                STA ${this.getConfidenceBadge(data.ivStaminaConfidence, true)}
                                            </label>
                                            <input 
                                                type="number" 
                                                inputmode="numeric"
                                                min="0" 
                                                max="15" 
                                                value="${data.ivStamina}" 
                                                data-field="ivStamina"
                                                data-iv-field="stamina"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white text-center placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 ${data.ivStaminaConfidence < 0.7 ? 'ring-2 ring-yellow-300' : ''}"
                                                placeholder="0-15"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="border-t border-white border-opacity-20 pt-3">
                                    <label class="block text-sm font-medium text-white mb-2">Current Moves</label>
                                    <div class="space-y-2">
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">Fast Move</label>
                                            <select 
                                                data-field="currentFastMove"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                            >
                                                <option value="" class="bg-teal-600">None</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">Charged Move 1</label>
                                            <select 
                                                data-field="currentChargeMove1"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                            >
                                                <option value="" class="bg-teal-600">None</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-teal-100 mb-1">Charged Move 2</label>
                                            <select 
                                                data-field="currentChargeMove2"
                                                class="w-full px-3 py-2 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                            >
                                                <option value="" class="bg-teal-600">None</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Toggle Switches -->
                                <div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-white border-opacity-20">
                                    <h3 class="font-semibold text-white text-sm mb-3">Properties</h3>
                                    
                                    ${this.renderToggle('2nd Charge Move Unlocked', 'secondChargeUnlocked', data.secondChargeUnlocked)}
                                    ${this.renderToggle('Shiny', 'shiny', data.shiny)}
                                    <div class="flex justify-between items-center">
                                        <label class="text-sm text-white">Shadow Status</label>
                                        <div class="flex gap-2">
                                            <button 
                                                type="button"
                                                data-shadow-state="normal"
                                                class="px-3 py-1 text-xs rounded-lg transition bg-white text-teal-600"
                                            >
                                                Normal
                                            </button>
                                            <button 
                                                type="button"
                                                data-shadow-state="shadow"
                                                class="px-3 py-1 text-xs rounded-lg transition bg-white bg-opacity-20 text-white"
                                            >
                                                Shadow
                                            </button>
                                            <button 
                                                type="button"
                                                data-shadow-state="purified"
                                                class="px-3 py-1 text-xs rounded-lg transition bg-white bg-opacity-20 text-white"
                                            >
                                                Purified
                                            </button>
                                        </div>
                                    </div>
                                    ${this.renderToggle('Dynamax', 'dynamax', data.dynamax)}
                                    ${this.renderToggle('XXL', 'xxl', data.xxl)}
                                    ${this.renderToggle('XXS', 'xxs', data.xxs)}
                                    
                                    <div class="flex justify-between items-center pt-2 border-t border-white border-opacity-20">
                                        <label class="text-sm text-white">Background</label>
                                        <input 
                                            type="text" 
                                            value="${data.background || ''}" 
                                            data-field="background"
                                            class="w-32 px-2 py-1 text-sm bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                            placeholder="None"
                                        />
                                    </div>
                                    
                                    <div class="flex justify-between items-center">
                                        <label class="text-sm text-white">Costume</label>
                                        <input 
                                            type="text" 
                                            value="${data.costume || ''}" 
                                            data-field="costume"
                                            class="w-32 px-2 py-1 text-sm bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                                            placeholder="None"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex gap-3 pt-4">
                            ${isBatch ? `
                                <button 
                                    class="px-6 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl py-3 hover:bg-opacity-30 transition font-semibold border border-white border-opacity-20"
                                    data-action="skip-batch"
                                >
                                    <i class="fa-solid fa-forward mr-2"></i>Skip
                                </button>
                            ` : ''}
                            <button 
                                class="flex-1 bg-white text-teal-600 rounded-xl py-3 hover:bg-teal-50 transition font-semibold shadow-lg"
                                data-action="save-pokemon"
                            >
                                <i class="fa-solid fa-check mr-2"></i>${isBatch ? 'Save & Next' : 'Save Pokémon'}
                            </button>
                            <button 
                                class="px-6 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl py-3 hover:bg-opacity-30 transition font-semibold border border-white border-opacity-20"
                                data-action="cancel-confirmation"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.attachConfirmationListeners(data, imageData, isBatch);
    }

    renderToggle(label, fieldName, isActive) {
        return `
            <div class="flex justify-between items-center">
                <label class="text-sm text-gray-700">${label}</label>
                <div class="ios-toggle ${isActive ? 'active' : ''}" data-toggle="${fieldName}">
                    <input type="checkbox" ${isActive ? 'checked' : ''} class="hidden" data-field="${fieldName}">
                </div>
            </div>
        `;
    }

    getConfidenceBadge(confidence, small = false) {
        if (confidence === 0) return '';
        
        let color = 'green';
        let icon = 'check';
        if (confidence < 0.7) {
            color = 'yellow';
            icon = 'exclamation';
        }
        if (confidence < 0.4) {
            color = 'red';
            icon = 'xmark';
        }
        
        const sizeClass = small ? 'text-xs' : 'text-sm';
        return `<span class="inline-flex items-center gap-1 text-${color}-600 ${sizeClass}">
            <i class="fa-solid fa-${icon}-circle"></i>
            <span class="font-normal">${Math.round(confidence * 100)}%</span>
        </span>`;
    }

    getFieldsNeedingAttention(data) {
        const fields = [];
        if (!data.name || data.nameConfidence < 0.7) fields.push('Pokémon Name');
        if (!data.cp || data.cpConfidence < 0.7) fields.push('CP');
        if (!data.dateCaught || data.dateCaughtConfidence < 0.7) fields.push('Date Caught');
        if (data.ivAttack === '' || data.ivAttackConfidence < 0.7) fields.push('Attack IV');
        if (data.ivDefense === '' || data.ivDefenseConfidence < 0.7) fields.push('Defense IV');
        if (data.ivStamina === '' || data.ivStaminaConfidence < 0.7) fields.push('Stamina IV');
        fields.push('Form (always verify)');
        return fields;
    }

    attachConfirmationListeners(initialData, imageData, isBatch) {
        const modal = document.querySelector('[data-modal="confirmation"]');
        if (!modal) return;

        // Setup autocomplete
        this.setupNameAutocomplete(modal);
        
        // Cancel button
        modal.querySelector('[data-action="cancel-confirmation"]').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Unsaved data will be lost.')) {
                modal.remove();
                if (isBatch) {
                    this.batchImages = [];
                    this.currentBatchIndex = 0;
                }
            }
        });

        // Skip button
        const skipBtn = modal.querySelector('[data-action="skip-batch"]');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                modal.remove();
                this.currentBatchIndex++;
                this.processBatch();
            });
        }

        // Toggle switches
        modal.querySelectorAll('.ios-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const checkbox = toggle.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                toggle.classList.toggle('active');
            });
        });

        // Shadow state buttons
        modal.querySelectorAll('[data-shadow-state]').forEach(btn => {
            btn.addEventListener('click', () => {
                const state = btn.dataset.shadowState;
                
                // Update button styles
                modal.querySelectorAll('[data-shadow-state]').forEach(b => {
                    if (b.dataset.shadowState === state) {
                        if (state === 'shadow') {
                            b.className = 'px-3 py-1 text-xs rounded-lg transition bg-purple-600 text-white';
                        } else if (state === 'purified') {
                            b.className = 'px-3 py-1 text-xs rounded-lg transition bg-blue-400 text-white';
                        } else {
                            b.className = 'px-3 py-1 text-xs rounded-lg transition bg-white text-teal-600';
                        }
                    } else {
                        b.className = 'px-3 py-1 text-xs rounded-lg transition bg-white bg-opacity-20 text-white';
                    }
                });
            });
        });

        // IV Auto-advance functionality with numpad shortcut support
        const ivFields = {
            attack: modal.querySelector('[data-iv-field="attack"]'),
            defense: modal.querySelector('[data-iv-field="defense"]'),
            stamina: modal.querySelector('[data-iv-field="stamina"]')
        };

        // Auto-select all text when IV fields receive focus
        Object.values(ivFields).forEach(field => {
            field.addEventListener('focus', (e) => {
                e.target.select();
            });
        });

        // Helper function to advance to next field
        function advanceFromField(currentField, nextField) {
            // Enforce 0-15 range
            let numValue = parseInt(currentField.value);
            if (numValue > 15) {
                currentField.value = '15';
            } else if (numValue < 0 || isNaN(numValue)) {
                currentField.value = '0';
            }
            
            // Move to next field
            if (nextField) {
                nextField.focus();
                nextField.select();
            }
        }

        // Attack IV
        ivFields.attack.addEventListener('keydown', (e) => {
            // Check for numpad operator keys (triggers advancement)
            if (['/','.','+','-','*'].includes(e.key) || 
                ['Divide','Decimal','Add','Subtract','Multiply'].includes(e.code)) {
                e.preventDefault();
                advanceFromField(e.target, ivFields.defense);
                return;
            }
        });

        ivFields.attack.addEventListener('input', (e) => {
            const value = e.target.value;
            const numValue = parseInt(value);
            const length = value.length;
            
            // Auto-advance if: 2 digits OR single digit 2-9
            if (length === 2 || (length === 1 && numValue >= 2 && numValue <= 9)) {
                advanceFromField(e.target, ivFields.defense);
            }
        });

        // Defense IV
        ivFields.defense.addEventListener('keydown', (e) => {
            // Check for numpad operator keys
            if (['/','.','+','-','*'].includes(e.key) || 
                ['Divide','Decimal','Add','Subtract','Multiply'].includes(e.code)) {
                e.preventDefault();
                advanceFromField(e.target, ivFields.stamina);
                return;
            }
        });

        ivFields.defense.addEventListener('input', (e) => {
            const value = e.target.value;
            const numValue = parseInt(value);
            const length = value.length;
            
            if (length === 2 || (length === 1 && numValue >= 2 && numValue <= 9)) {
                advanceFromField(e.target, ivFields.stamina);
            }
        });

        // Stamina IV (no next field, but still clean up on operators)
        ivFields.stamina.addEventListener('keydown', (e) => {
            // Check for numpad operator keys - just clean up and blur
            if (['/','.','+','-','*'].includes(e.key) || 
                ['Divide','Decimal','Add','Subtract','Multiply'].includes(e.code)) {
                e.preventDefault();
                advanceFromField(e.target, null);
                e.target.blur();
                return;
            }
        });

        ivFields.stamina.addEventListener('input', (e) => {
            // Auto-clamp if they type 16-19
            const numValue = parseInt(e.target.value);
            if (numValue > 15) {
                e.target.value = '15';
            }
        });

        // Prevent values outside 0-15 range on blur
        Object.values(ivFields).forEach(field => {
            field.addEventListener('blur', (e) => {
                let value = parseInt(e.target.value);
                if (isNaN(value) || value < 0) {
                    e.target.value = '0';
                } else if (value > 15) {
                    e.target.value = '15';
                }
                this.updateCalculatedLevel(modal);
            });
        });

        // Update form dropdown based on selected Pokémon
        const nameInput = modal.querySelector('[data-field="name"]');
        const formSelect = modal.querySelector('[data-field="form"]');
        
        nameInput.addEventListener('change', () => {
            this.updateFormOptions(nameInput.value, formSelect);
            this.updateMoveOptions(nameInput.value, formSelect.value, modal);
            this.updateCalculatedLevel(modal);
        });

        formSelect.addEventListener('change', () => {
            this.updateMoveOptions(nameInput.value, formSelect.value, modal);
            this.updateCalculatedLevel(modal);
        });

        // Auto-check 2nd Charge Unlocked when charge move 2 is selected
        const charge2Select = modal.querySelector('[data-field="currentChargeMove2"]');
        charge2Select.addEventListener('change', (e) => {
            const toggle = modal.querySelector('[data-toggle="secondChargeUnlocked"]');
            const checkbox = toggle.querySelector('input[type="checkbox"]');
            
            if (e.target.value && e.target.value !== '') {
                checkbox.checked = true;
                toggle.classList.add('active');
            }
        });

        // Auto-calculate level on field changes
        const fieldsToWatch = ['cp', 'ivAttack', 'ivDefense', 'ivStamina'];
        fieldsToWatch.forEach(fieldName => {
            const field = modal.querySelector(`[data-field="${fieldName}"]`);
            if (field) {
                field.addEventListener('change', () => this.updateCalculatedLevel(modal));
            }
        });

        formSelect.addEventListener('change', () => this.updateCalculatedLevel(modal));

        // Save button
        modal.querySelector('[data-action="save-pokemon"]').addEventListener('click', async () => {
            // Validate form
            const errors = this.validateFormData(modal);
            
            if (errors.length > 0) {
                this.showValidationErrors(modal, errors);
                return; // Don't save if there are errors
            }
            
            const formData = this.gatherFormData(modal);
            
            modal.remove();
            await this.savePokemon(formData);
            
            if (isBatch) {
                this.currentBatchIndex++;
                this.processBatch();
            }
        });
    }

    updateFormOptions(pokemonName, formSelect) {
        const forms = this.app.pokemon.filter(p => 
            p.name.toLowerCase() === pokemonName.toLowerCase()
        );
        
        formSelect.innerHTML = '<option value="">Normal</option>';
        forms.forEach(p => {
            if (p.form) {
                formSelect.innerHTML += `<option value="${p.form}">${p.form}</option>`;
            }
        });
    }

    updateCalculatedLevel(modal) {
        const name = modal.querySelector('[data-field="name"]').value;
        const form = modal.querySelector('[data-field="form"]').value;
        const cp = parseInt(modal.querySelector('[data-field="cp"]').value);
        const ivAtk = parseInt(modal.querySelector('[data-field="ivAttack"]').value);
        const ivDef = parseInt(modal.querySelector('[data-field="ivDefense"]').value);
        const ivSta = parseInt(modal.querySelector('[data-field="ivStamina"]').value);

        if (!name || !cp || isNaN(ivAtk) || isNaN(ivDef) || isNaN(ivSta)) {
            modal.querySelector('[data-field="level"]').value = '';
            return;
        }

        const pokemon = this.app.pokemon.find(p => 
            p.name.toLowerCase() === name.toLowerCase() &&
            (!form || p.form === form)
        );

        if (pokemon) {
            const level = this.calculateLevel(pokemon, cp, ivAtk, ivDef, ivSta);
            modal.querySelector('[data-field="level"]').value = level;
        }
    }

    async gatherFormData(modal, imageData) {
        // Find which shadow state button is active
        let shadowState = 'normal';
        modal.querySelectorAll('[data-shadow-state]').forEach(btn => {
            if (btn.classList.contains('bg-purple-600')) {
                shadowState = 'shadow';
            } else if (btn.classList.contains('bg-blue-400')) {
                shadowState = 'purified';
            } else if (btn.classList.contains('bg-white') && btn.classList.contains('text-teal-600')) {
                shadowState = 'normal';
            }
        });
        
        return {
            name: modal.querySelector('[data-field="name"]').value,
            form: modal.querySelector('[data-field="form"]').value || null,
            nickname: modal.querySelector('[data-field="nickname"]').value || null,
            cp: parseInt(modal.querySelector('[data-field="cp"]').value) || 0,
            level: parseFloat(modal.querySelector('[data-field="level"]').value) || null,
            dateCaught: modal.querySelector('[data-field="dateCaught"]').value,
            ivs: {
                attack: parseInt(modal.querySelector('[data-field="ivAttack"]').value) || 0,
                defense: parseInt(modal.querySelector('[data-field="ivDefense"]').value) || 0,
                stamina: parseInt(modal.querySelector('[data-field="ivStamina"]').value) || 0
            },
            // Toggle states
            secondChargeUnlocked: modal.querySelector('[data-field="secondChargeUnlocked"]').checked,
            shiny: modal.querySelector('[data-field="shiny"]').checked,
            shadow: shadowState === 'shadow',
            purified: shadowState === 'purified',
            dynamax: modal.querySelector('[data-field="dynamax"]').checked,
            xxl: modal.querySelector('[data-field="xxl"]').checked,
            xxs: modal.querySelector('[data-field="xxs"]').checked,
            background: modal.querySelector('[data-field="background"]').value || null,
            costume: modal.querySelector('[data-field="costume"]').value || null,
            // Current moveset
            currentMoveset: {
                fast: modal.querySelector('[data-field="currentFastMove"]').value || null,
                charge1: modal.querySelector('[data-field="currentChargeMove1"]').value || null,
                charge2: modal.querySelector('[data-field="currentChargeMove2"]').value || null
            },
            // Placeholders for future features
            roles: [], // Will be populated when role assignment is implemented
            ivEfficiency: null, // Will be calculated when IV ranking is implemented
            assignedMoveset: {
                fast: null,
                charge1: null,
                charge2: null
            }
        };
    }

    showSkipImageModal(errorMessage) {
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="skip">
                <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                    <div class="text-red-500 text-center">
                        <i class="fa-solid fa-circle-exclamation text-5xl mb-3"></i>
                        <h2 class="text-2xl font-bold text-gray-800">Processing Error</h2>
                    </div>
                    <p class="text-gray-600 text-center">${errorMessage}</p>
                    <div class="flex gap-3">
                        <button 
                            class="flex-1 bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition"
                            data-action="skip-continue"
                        >
                            Skip & Continue
                        </button>
                        <button 
                            class="flex-1 bg-gray-200 text-gray-700 rounded-xl py-3 hover:bg-gray-300 transition"
                            data-action="stop-batch"
                        >
                            Stop Batch
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('[data-modal="skip"]');
        modal.querySelector('[data-action="skip-continue"]').addEventListener('click', () => {
            modal.remove();
            this.currentBatchIndex++;
            this.processBatch();
        });
        
        modal.querySelector('[data-action="stop-batch"]').addEventListener('click', () => {
            modal.remove();
            this.batchImages = [];
            this.currentBatchIndex = 0;
        });
    }

    showBatchCompleteModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center space-y-6">
                <div class="text-green-500">
                    <i class="fa-solid fa-circle-check text-6xl mb-4"></i>
                    <h2 class="text-3xl font-bold text-gray-800">Uploads Complete!</h2>
                </div>
                
                <p class="text-gray-600">
                    Pokémon uploaded and ready for analysis
                </p>
                
                <div class="space-y-3">
                    <button class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition font-semibold" data-action="start-report">
                        <i class="fa-solid fa-chart-line mr-2"></i>Analyze Caught Pokémon
                    </button>
                    <button class="w-full bg-gray-200 text-gray-700 rounded-xl py-3 hover:bg-gray-300 transition" data-action="close">
                        <i class="fa-solid fa-home mr-2"></i>Return to Collection
                    </button>
                </div>
            </div>
        `;
        
        modal.querySelector('[data-action="start-report"]').addEventListener('click', () => {
            modal.remove();
            this.app.catchReport.startQueue();
        });
        
        modal.querySelector('[data-action="close"]').addEventListener('click', () => {
            modal.remove();
        });
        
        document.body.appendChild(modal);
    }

    showErrorModal(message) {
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

    async savePokemon(formData) {
        try {
            const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const pokemonEntry = {
                id: id,
                inQueue: true,

                // Basic Info
                name: formData.name || '',
                form: formData.form || null,
                nickname: formData.nickname || null,
                
                // Stats
                cp: parseInt(formData.cp) || 0,
                level: parseFloat(formData.level) || null,
                ivs: {
                    attack: parseInt(formData.ivs?.attack) || 0,
                    defense: parseInt(formData.ivs?.defense) || 0,
                    stamina: parseInt(formData.ivs?.stamina) || 0
                },
                ivEfficiency: formData.ivEfficiency || null,
                
                // Properties (booleans)
                secondChargeUnlocked: Boolean(formData.secondChargeUnlocked),
                shiny: Boolean(formData.shiny),
                shadow: Boolean(formData.shadow),
                dynamax: Boolean(formData.dynamax),
                xxl: Boolean(formData.xxl),
                xxs: Boolean(formData.xxs),
                
                // Special attributes
                background: formData.background || null,
                costume: formData.costume || null,
                
                // Roles
                roles: formData.roles || [],
                
                // Movesets
                currentMoveset: {
                    fast: formData.currentMoveset?.fast || null,
                    charge1: formData.currentMoveset?.charge1 || null,
                    charge2: formData.currentMoveset?.charge2 || null
                },
                assignedMoveset: {
                    fast: formData.assignedMoveset?.fast || null,
                    charge1: formData.assignedMoveset?.charge1 || null,
                    charge2: formData.assignedMoveset?.charge2 || null
                },
                
                // Dates
                dateCaught: formData.dateCaught || '',
                dateUploaded: new Date().toISOString(),
                
                // Screenshot
                screenshot: formData.screenshot || null
            };
            
            console.log('Saving Pokemon with full data:', pokemonEntry); // Debug log
            
            const dbRequest = indexedDB.open('PokemonGoDB');
            
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                store.add(pokemonEntry);
                                
                tx.onerror = () => {
                    console.error('❌ Transaction error:', tx.error);
                    this.showErrorModal('Failed to save Pokémon to database');
                };
            };
            
            dbRequest.onerror = () => {
                console.error('❌ Database error:', dbRequest.error);
                this.showErrorModal('Failed to access database');
            };
            
        } catch (error) {
            console.error('❌ Error in savePokemon:', error);
            this.showErrorModal('Failed to save Pokémon: ' + error.message);
        }
    }

    
}