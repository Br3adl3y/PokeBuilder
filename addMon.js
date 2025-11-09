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
        this.tesseractWorker = null;
    }

    // Initialize Tesseract (call once)
    async initTesseract() {
        if (!this.tesseractWorker) {
            this.tesseractWorker = await Tesseract.createWorker('eng');
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
        // Initialize Tesseract if needed
        await this.initTesseract();

        // Extract regions from the Pokémon GO screenshot
        const anchor = this.findAnchorStar(imageData);
        const statsBoxTop = this.findStatsBoxEdge(imageData);
        const nickname = await this.extractNickname(imageData, statsBoxTop);
        const cp = await this.extractCP(imageData, anchor.x, anchor.y);
        const dateFirstPass = await this.extractDateCaught(imageData, { usedFallback: false });
        const pokemonName = await this.extractPokemonName(imageData, dateFirstPass);
        const dateCaught = await this.extractDateCaught(imageData, pokemonName);
        const stats = await this.extractIVStats(imageData, pokemonName);

        return {
            name: pokemonName?.value || '',
            nameConfidence: pokemonName?.confidence || 0,
            cp: cp?.value || '',
            cpConfidence: cp?.confidence || 0,
            dateCaught: dateCaught?.value || '',
            dateCaughtConfidence: dateCaught?.confidence || 0,
            ivAttack: stats.attack !== undefined ? stats.attack.toString() : '',
            ivAttackConfidence: stats.attack !== undefined ? 95 : 0,
            ivDefense: stats.defense !== undefined ? stats.defense.toString() : '',
            ivDefenseConfidence: stats.defense !== undefined ? 95 : 0,
            ivStamina: stats.stamina !== undefined ? stats.stamina.toString() : '',
            ivStaminaConfidence: stats.stamina !== undefined ? 95 : 0,
            screenshot: imageData.dataUrl,
            form: null,
            // Toggle states
            secondChargeUnlocked: false,
            shiny: false,
            shadow: false,
            purified: false,
            dynamax: false,
            xxl: false,
            xxs: false,
            background: null,
            costume: null
        };
    }

    // ============================================
    // OCR HELPER FUNCTIONS
    // ============================================

    preprocessImage(imageData, region) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = region.width;
        canvas.height = region.height;
        
        ctx.drawImage(
            imageData.image,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
        );
        
        const imgData = ctx.getImageData(0, 0, region.width, region.height);
        const data = imgData.data;
        
        // Convert to black and white with threshold
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const threshold = avg > 128 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = threshold;
        }
        
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL();
    }

    preprocessCPImage(imageData, region) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = region.width;
        canvas.height = region.height;
        
        ctx.drawImage(
            imageData.image,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
        );
        
        // Sample background color
        const sampleSize = Math.floor(region.height * 0.5);
        const sampleX = Math.max(0, region.x - sampleSize);
        const sampleY = region.y + Math.floor((region.height - sampleSize) / 2);
        
        const sampleCanvas = document.createElement('canvas');
        const sampleCtx = sampleCanvas.getContext('2d');
        sampleCanvas.width = sampleSize;
        sampleCanvas.height = sampleSize;
        
        sampleCtx.drawImage(
            imageData.image,
            sampleX, sampleY, sampleSize, sampleSize,
            0, 0, sampleSize, sampleSize
        );
        
        const sampleData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
        const pixels = sampleData.data;
        
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            totalR += pixels[i];
            totalG += pixels[i + 1];
            totalB += pixels[i + 2];
            count++;
        }
        
        const avgR = Math.round(totalR / count);
        const avgG = Math.round(totalG / count);
        const avgB = Math.round(totalB / count);
        const avgBrightness = (avgR + avgG + avgB) / 3;
        
        // Check if it's shadow purple
        const shadowPurple = { r: 0x0a, g: 0x09, b: 0x45 };
        const shadowTextColor = { r: 0xc7, g: 0xad, b: 0xdd };
        
        const isShadowPurple = 
            Math.abs(avgR - shadowPurple.r) < 30 &&
            Math.abs(avgG - shadowPurple.g) < 30 &&
            Math.abs(avgB - shadowPurple.b) < 30;
        
        const imgData = ctx.getImageData(0, 0, region.width, region.height);
        const data = imgData.data;
        
        // Step background toward white
        const stepAmount = 0.4;
        const targetR = avgR + (255 - avgR) * stepAmount;
        const targetG = avgG + (255 - avgG) * stepAmount;
        const targetB = avgB + (255 - avgB) * stepAmount;
        const targetBrightness = (targetR + targetG + targetB) / 3;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (isShadowPurple) {
                const isShadowText = 
                    Math.abs(r - shadowTextColor.r) < 40 &&
                    Math.abs(g - shadowTextColor.g) < 40 &&
                    Math.abs(b - shadowTextColor.b) < 40;
                
                if (isShadowText || r > 200 || g > 200 || b > 200) {
                    data[i] = data[i + 1] = data[i + 2] = 255;
                } else {
                    data[i] = data[i + 1] = data[i + 2] = 0;
                }
            } else {
                const pixelBrightness = (r + g + b) / 3;
                if (pixelBrightness < targetBrightness) {
                    data[i] = data[i + 1] = data[i + 2] = 0;
                } else {
                    data[i] = data[i + 1] = data[i + 2] = 255;
                }
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL();
    }

    async performOCR(imageDataUrl, whitelist = null) {
        try {
            const config = {};
            if (whitelist) {
                config.tessedit_char_whitelist = whitelist;
            }
            
            const result = await this.tesseractWorker.recognize(imageDataUrl);
            return {
                text: result.data.text.trim(),
                confidence: result.data.confidence
            };
        } catch (error) {
            console.error('OCR error:', error);
            return { text: '', confidence: 0 };
        }
    }

    findAnchorStar(imageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = imageData.width;
        const h = imageData.height;
        
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imageData.image, 0, 0);
        
        const searchRegion = {
            x: Math.floor(w * 0.88),
            y: 0,
            width: Math.floor(w * 0.04),
            height: Math.floor(h * 0.10)
        };
        
        const imageData2 = ctx.getImageData(searchRegion.x, searchRegion.y, searchRegion.width, searchRegion.height);
        const data = imageData2.data;
        
        const yellowStar = { r: 0xf7, g: 0xc2, b: 0x10 };
        const grayStar = { r: 0xc8, g: 0xd5, b: 0xdb };
        
        function colorMatches(r, g, b, target, tolerance = 30) {
            return Math.abs(r - target.r) <= tolerance &&
                   Math.abs(g - target.g) <= tolerance &&
                   Math.abs(b - target.b) <= tolerance;
        }
        
        for (let y = searchRegion.height - 1; y >= 0; y--) {
            for (let x = 0; x < searchRegion.width; x++) {
                const idx = (y * searchRegion.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                if (colorMatches(r, g, b, yellowStar) || colorMatches(r, g, b, grayStar)) {
                    const starEdgeY = searchRegion.y + y;
                    const starCenterY = starEdgeY - 45;
                    const starCenterX = Math.floor(w * 0.9025);
                    return { x: starCenterX, y: starCenterY };
                }
            }
        }
        
        return { x: Math.floor(w * 0.9025), y: Math.floor(h * 0.078) };
    }

    findStatsBoxEdge(imageData) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = imageData.width;
        const h = imageData.height;
        
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imageData.image, 0, 0);
        
        const refWidth = 1180;
        const scale = w / refWidth;
        const searchX = Math.floor(145 * scale);
        const startY = Math.floor(h * 0.4);
        
        for (let y = startY; y >= 0; y--) {
            const pixel = ctx.getImageData(searchX, y, 1, 1).data;
            const r = pixel[0];
            const g = pixel[1];
            const b = pixel[2];
            
            const isWhite = r > 240 && g > 240 && b > 240;
            
            if (!isWhite) {
                return y;
            }
        }
        
        return Math.floor(h * 0.35);
    }

    // ============================================
    // EXTRACTION FUNCTIONS
    // ============================================

    async extractNickname(imageData, statsBoxTop) {
        const w = imageData.width;
        const h = imageData.height;
        
        const refHeight = 2556;
        const scale = h / refHeight;
        
        const originalHeight = Math.floor(h * 0.08);
        const newHeight = Math.floor(originalHeight * 0.5);
        const yOffset = Math.floor(originalHeight * 0.25) + Math.floor(70 * scale);
        
        const region = {
            x: Math.floor(w * 0.05),
            y: statsBoxTop + Math.floor(60 * scale) + yOffset,
            width: Math.floor(w * 0.8), 
            height: newHeight
        };
        
        const processedImage = this.preprocessImage(imageData, region);
        const result = await this.performOCR(processedImage);
        
        let cleanedText = result.text.trim();
        if (cleanedText.toLowerCase().endsWith('i')) {
            cleanedText = cleanedText.slice(0, -1);
        }
        
        return {
            value: cleanedText,
            confidence: result.confidence
        };
    }

    async extractPokemonName(imageData, dateData) {
        const w = imageData.width;
        const h = imageData.height;
        
        const refHeight = 2556;
        const scale = h / refHeight;
        
        const yOffset = dateData && dateData.triggeredPumpkaboo ? 80 * scale : 0;
        const searchY = h - (176 * scale) - yOffset;
        
        const region = {
            x: Math.floor(w * 0.05),
            y: Math.floor(searchY - (h * 0.02)),
            width: Math.floor(w * 0.45),
            height: Math.floor(h * 0.04)
        };
        
        const processedImage = this.preprocessImage(imageData, region);
        const result = await this.performOCR(processedImage);
        
        let pokemonName = '';
        const match = result.text.match(/This\s+([A-Za-z]+)\s+was/i);
        if (match) {
            pokemonName = match[1];
        } else {
            const words = result.text.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/);
            pokemonName = words.reduce((longest, word) => 
                word.length > longest.length ? word : longest, '');
        }
        
        const fuzzyMatch = this.findBestPokemonMatch(pokemonName);
        return {
            value: fuzzyMatch || pokemonName,
            confidence: fuzzyMatch ? 90 : result.confidence,
            usedFallback: dateData && dateData.triggeredPumpkaboo
        };
    }

    async extractCP(imageData, anchorX, anchorY) {
        const w = imageData.width;
        const h = imageData.height;
        
        const refWidth = 1180;
        const refHeight = 2556;
        const scale = Math.min(w / refWidth, h / refHeight);
        
        const cpX = anchorX + (-475 * scale);
        const cpY = anchorY + (-5 * scale);
        
        const region = {
            x: Math.floor(cpX - (w * 0.25)),
            y: Math.floor(cpY - (h * 0.02)),
            width: Math.floor(w * 0.45),
            height: Math.floor(h * 0.04)
        };
        
        const processedImage = this.preprocessCPImage(imageData, region);
        const result = await this.performOCR(processedImage, '0123456789');
        
        const cpMatch = result.text.match(/\d+/);
        const cpValue = cpMatch ? cpMatch[0] : '';
        
        return {
            value: cpValue,
            confidence: cpValue ? result.confidence : 0
        };
    }

    async extractDateCaught(imageData, pokemonNameData) {
        const w = imageData.width;
        const h = imageData.height;
        
        const refHeight = 2556;
        const scale = h / refHeight;
        
        const dateY = h - (176 * scale);
        
        const region = pokemonNameData.usedFallback ? {
            x: Math.floor(w * 0.05),
            y: Math.floor(dateY - (h * 0.02)),
            width: Math.floor(w * 0.45),
            height: Math.floor(h * 0.04)
        } : {
            x: Math.floor(w * 0.5),
            y: Math.floor(dateY - (h * 0.02)),
            width: Math.floor(w * 0.45),
            height: Math.floor(h * 0.04)
        };
        
        const processedImage = this.preprocessImage(imageData, region);
        const result = await this.performOCR(processedImage);
        
        const dateMatch = result.text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        
        if (dateMatch) {
            const month = dateMatch[1].padStart(2, '0');
            const day = dateMatch[2].padStart(2, '0');
            const year = dateMatch[3];
            return {
                value: `${year}-${month}-${day}`,
                confidence: result.confidence,
                triggeredPumpkaboo: false
            };
        }
        
        return {
            value: '',
            confidence: 0,
            triggeredPumpkaboo: true
        };
    }

    async extractIVStats(imageData, pokemonNameData) {
        const w = imageData.width;
        const h = imageData.height;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imageData.image, 0, 0);
        
        const refHeight = 2556;
        const scale = h / refHeight;
        
        const shift = pokemonNameData.usedFallback ? 80 * scale : 0;
        
        const atkY = h - (581 * scale) - shift;
        const defY = h - (466 * scale) - shift;
        const staY = h - (356 * scale) - shift;
        
        const refWidth = 1180;
        const barStartX = Math.floor((145 / refWidth) * w);
        const barEndX = Math.floor((530 / refWidth) * w);
        const barWidth = barEndX - barStartX;
        
        const maxColor = { r: 0xdf, g: 0x7f, b: 0x81 };
        const filledColor = { r: 0xf5, g: 0xa5, b: 0x4e };
        const emptyColor = { r: 0xe2, g: 0xe2, b: 0xe4 };
        
        function colorMatches(r, g, b, target, tolerance = 20) {
            return Math.abs(r - target.r) <= tolerance &&
                   Math.abs(g - target.g) <= tolerance &&
                   Math.abs(b - target.b) <= tolerance;
        }
        
        const readIV = (y) => {
            for (let i = 0; i < 15; i++) {
                const x = barStartX + (barWidth * (i / 14));
                const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                
                if (colorMatches(r, g, b, emptyColor)) {
                    return i;
                }
                
                if (colorMatches(r, g, b, maxColor)) {
                    return 15;
                }
            }
            return 15;
        };
        
        return {
            attack: readIV(atkY),
            defense: readIV(defY),
            stamina: readIV(staY)
        };
    }

    findBestPokemonMatch(ocrText) {
        if (!ocrText) return null;
        
        const lowerOcr = ocrText.toLowerCase();
        
        // Get all unique Pokemon names from database
        const pokemonNames = [...new Set(this.app.pokemon.map(p => p.name))];
        
        // Exact match
        const exactMatch = pokemonNames.find(name => 
            name.toLowerCase() === lowerOcr
        );
        if (exactMatch) return exactMatch;
        
        // Contains match
        const containsMatch = pokemonNames.find(name => 
            name.toLowerCase().includes(lowerOcr) || lowerOcr.includes(name.toLowerCase())
        );
        if (containsMatch) return containsMatch;
        
        // Fuzzy match
        let bestMatch = null;
        let bestScore = 0;
        
        for (const name of pokemonNames) {
            const score = this.calculateSimilarity(lowerOcr, name.toLowerCase());
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = name;
            }
        }
        
        return bestMatch;
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
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

    gatherFormData(modal) {
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

    async savePokemon(formData) {
        try {
            const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const pokemonEntry = {
                id: id,
                
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
            
            const dbRequest = indexedDB.open('PokemonGoDB', 2);
            
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['userPokemon'], 'readwrite');
                const store = tx.objectStore('userPokemon');
                
                store.add(pokemonEntry);
                
                tx.oncomplete = () => {
                    console.log('✅ Pokémon saved successfully');
                    this.showCatchReportPlaceholder(id, pokemonEntry);
                };
                
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