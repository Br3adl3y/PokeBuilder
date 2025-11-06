// ====================================
// addMon.js - SCREENSHOT PROCESSING MODULE
// ====================================

class ScreenshotProcessor {
    constructor(app) {
        this.app = app;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.batchImages = [];
        this.currentBatchIndex = 0;
        this.isDesktop = !('ontouchstart' in window);
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

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.ctx.drawImage(img, 0, 0);
                    resolve({
                        image: img,
                        dataUrl: e.target.result,
                        width: img.width,
                        height: img.height
                    });
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Process screenshot and extract data with OCR
    async processScreenshot(imageData) {
        // Extract regions from the Pokémon GO screenshot
        const pokemonName = await this.extractPokemonName(imageData);
        const cp = await this.extractCP(imageData);
        const dateCaught = await this.extractDateCaught(imageData);
        const stats = await this.extractIVStats(imageData);

        return {
            name: pokemonName?.value || '',
            nameConfidence: pokemonName?.confidence || 0,
            cp: cp?.value || '',
            cpConfidence: cp?.confidence || 0,
            dateCaught: dateCaught?.value || '',
            dateCaughtConfidence: dateCaught?.confidence || 0,
            ivAttack: stats.attack?.value || '',
            ivAttackConfidence: stats.attack?.confidence || 0,
            ivDefense: stats.defense?.value || '',
            ivDefenseConfidence: stats.defense?.confidence || 0,
            ivStamina: stats.stamina?.value || '',
            ivStaminaConfidence: stats.stamina?.confidence || 0,
            screenshot: imageData.dataUrl,
            form: null,
            // Toggle states
            secondChargeUnlocked: false,
            shiny: false,
            shadow: false,
            dynamax: false,
            xxl: false,
            xxs: false,
            background: null,
            costume: null
        };
    }

    // OCR PLACEHOLDER FUNCTIONS
    async extractPokemonName(imageData) {
        return { value: '', confidence: 0 };
    }

    async extractCP(imageData) {
        return { value: '', confidence: 0 };
    }

    async extractDateCaught(imageData) {
        return { value: '', confidence: 0 };
    }

    async extractIVStats(imageData) {
        return {
            attack: { value: '', confidence: 0 },
            defense: { value: '', confidence: 0 },
            stamina: { value: '', confidence: 0 }
        };
    }

    // Calculate level from CP given IVs and pokemon
    calculateLevel(pokemon, cp, ivAttack, ivDefense, ivStamina) {
        if (!pokemon || !cp || ivAttack === '' || ivDefense === '' || ivStamina === '') {
            return '';
        }
        // Placeholder - would use actual CP formula and iterate through levels
        // CP = floor((baseAtk + ivAtk) * sqrt(baseDef + ivDef) * sqrt(baseStam + ivStam) * cpMultiplier^2 / 10)
        return 25; // Placeholder
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
                                    <label class="block text-sm font-medium text-white mb-1">Nickname (optional)</label>
                                    <input 
                                        type="text" 
                                        value="" 
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

                                <!-- Toggle Switches -->
                                <div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-white border-opacity-20">
                                    <h3 class="font-semibold text-white text-sm mb-3">Properties</h3>
                                    
                                    ${this.renderToggle('2nd Charge Move Unlocked', 'secondChargeUnlocked', data.secondChargeUnlocked)}
                                    ${this.renderToggle('Shiny', 'shiny', data.shiny)}
                                    ${this.renderToggle('Shadow', 'shadow', data.shadow)}
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

        // IV Auto-advance functionality
        const ivFields = {
            attack: modal.querySelector('[data-iv-field="attack"]'),
            defense: modal.querySelector('[data-iv-field="defense"]'),
            stamina: modal.querySelector('[data-iv-field="stamina"]')
        };

        // Auto-advance from Attack -> Defense -> Stamina
        ivFields.attack.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 0 && parseInt(value) >= 0 && parseInt(value) <= 15) {
                ivFields.defense.focus();
                ivFields.defense.select();
            }
        });

        ivFields.defense.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > 0 && parseInt(value) >= 0 && parseInt(value) <= 15) {
                ivFields.stamina.focus();
                ivFields.stamina.select();
            }
        });

        // Prevent values outside 0-15 range
        Object.values(ivFields).forEach(field => {
            field.addEventListener('blur', (e) => {
                let value = parseInt(e.target.value);
                if (isNaN(value) || value < 0) {
                    e.target.value = 0;
                } else if (value > 15) {
                    e.target.value = 15;
                }
                this.updateCalculatedLevel(modal);
            });
        });

        // Update form dropdown based on selected Pokémon
        const nameInput = modal.querySelector('[data-field="name"]');
        const formSelect = modal.querySelector('[data-field="form"]');
        
        nameInput.addEventListener('change', () => {
            this.updateFormOptions(nameInput.value, formSelect);
            this.updateCalculatedLevel(modal);
        });
        
        nameInput.addEventListener('blur', () => {
            this.updateCalculatedLevel(modal);
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

    gatherFormData(modal) {
        return {
            name: modal.querySelector('[data-field="name"]').value,
            form: modal.querySelector('[data-field="form"]').value || null,
            nickname: modal.querySelector('[data-field="nickname"]').value || null,
            cp: parseInt(modal.querySelector('[data-field="cp"]').value) || 0,
            level: parseFloat(modal.querySelector('[data-field="level"]').value) || null,
            dateCaught: modal.querySelector('[data-field="dateCaught"]').value,
            dateUploaded: new Date().toISOString(),
            ivs: {
                attack: parseInt(modal.querySelector('[data-field="ivAttack"]').value) || 0,
                defense: parseInt(modal.querySelector('[data-field="ivDefense"]').value) || 0,
                stamina: parseInt(modal.querySelector('[data-field="ivStamina"]').value) || 0
            },
            // Toggle states
            secondChargeUnlocked: modal.querySelector('[data-field="secondChargeUnlocked"]').checked,
            shiny: modal.querySelector('[data-field="shiny"]').checked,
            shadow: modal.querySelector('[data-field="shadow"]').checked,
            dynamax: modal.querySelector('[data-field="dynamax"]').checked,
            xxl: modal.querySelector('[data-field="xxl"]').checked,
            xxs: modal.querySelector('[data-field="xxs"]').checked,
            background: modal.querySelector('[data-field="background"]').value || null,
            costume: modal.querySelector('[data-field="costume"]').value || null,
            // Placeholders for future features
            role: null,
            ivEfficiency: null,
            currentMoveset: {
                fast: null,
                charge1: null,
                charge2: null
            },
            assignedMoveset: {
                fast: null,
                charge1: null,
                charge2: null
            },
            screenshot: null // Will be set in savePokemon
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
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="batch-complete">
                <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                    <div class="text-green-500 text-center">
                        <i class="fa-solid fa-circle-check text-5xl mb-3"></i>
                        <h2 class="text-2xl font-bold text-gray-800">Batch Complete!</h2>
                    </div>
                    <p class="text-gray-600 text-center">All screenshots have been processed</p>
                    <button 
                        class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition"
                        data-action="close-batch-complete"
                    >
                        Done
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('[data-modal="batch-complete"]');
        modal.querySelector('[data-action="close-batch-complete"]').addEventListener('click', () => {
            modal.remove();
        });
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

    // Save Pokémon to IndexedDB
    async savePokemon(data) {
        try {
            const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const dbRequest = indexedDB.open('PokemonGoDB');
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                store.add({
                    id,
                    ...data
                });
                
                tx.oncomplete = () => {
                    // Open catch report placeholder
                    this.showCatchReportPlaceholder(id, data);
                };
                
                tx.onerror = () => {
                    console.error('Error saving Pokémon:', tx.error);
                    this.showErrorModal('Failed to save Pokémon');
                };
            };
            
            dbRequest.onerror = () => {
                this.showErrorModal('Failed to access database');
            };
        } catch (error) {
            console.error('Error saving Pokémon:', error);
            this.showErrorModal('Failed to save Pokémon');
        }
    }

    // Show catch report (uses CatchReport class from catchReport.js)
    showCatchReportPlaceholder(pokemonId, data) {
        // Check if CatchReport class exists
        if (typeof CatchReport !== 'undefined') {
            const catchReport = new CatchReport(this.app);
            catchReport.show(pokemonId, data);
        } else {
            // Fallback if catchReport.js not loaded
            console.warn('CatchReport class not found, showing simple success message');
            const modalHtml = `
                <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" data-modal="simple-success">
                    <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center space-y-4">
                        <div class="text-green-500">
                            <i class="fa-solid fa-circle-check text-6xl mb-4"></i>
                            <h2 class="text-3xl font-bold text-gray-800">Saved!</h2>
                        </div>
                        <p class="text-gray-600">${data.name} has been added to your collection</p>
                        <button 
                            class="w-full bg-blue-500 text-white rounded-xl py-3 hover:bg-blue-600 transition"
                            data-action="close-simple-success"
                        >
                            Done
                        </button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.querySelector('[data-modal="simple-success"]');
            modal.querySelector('[data-action="close-simple-success"]').addEventListener('click', () => {
                modal.remove();
            });
            setTimeout(() => {
                if (modal.parentNode) modal.remove();
            }, 2000);
        }
    }
}