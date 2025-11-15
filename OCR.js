// ============================================
// OCR HELPER FUNCTIONS
// ============================================

class OCRProcessor {
    constructor() {
        this.tesseractWorker = null;
        this.cpm = [0.094, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159, 0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    // Initialize Tesseract (call once)
    async initTesseract() {
        if (!this.tesseractWorker) {
            this.tesseractWorker = await Tesseract.createWorker('eng');
        }
    }

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

    // Process screenshot and extract data with OCR
    async processScreenshot(imageData, pokemonList) {
        console.log('🔍 Starting OCR processing...');
        console.log('Image dimensions:', imageData.width, 'x', imageData.height);
        console.log('Pokemon list length:', pokemonList?.length);
        
        try {
            // Extract regions from the Pokémon GO screenshot
            const anchor = this.findAnchorStar(imageData);
            console.log('✓ Anchor found:', anchor);
            
            const statsBoxTop = this.findStatsBoxEdge(imageData);
            console.log('✓ Stats box top:', statsBoxTop);
            
            const nickname = await this.extractNickname(imageData, statsBoxTop);
            console.log('✓ Nickname extracted:', nickname);
            
            const cp = await this.extractCP(imageData, anchor.x, anchor.y);
            console.log('✓ CP extracted:', cp);
            
            const dateFirstPass = await this.extractDateCaught(imageData, { usedFallback: false });
            console.log('✓ Date first pass:', dateFirstPass);
            
            const pokemonName = await this.extractPokemonName(imageData, dateFirstPass, pokemonList);
            console.log('✓ Pokemon name extracted:', pokemonName);
            
            const dateCaught = await this.extractDateCaught(imageData, pokemonName);
            console.log('✓ Date caught:', dateCaught);
            
            const stats = await this.extractIVStats(imageData, pokemonName);
            console.log('✓ Stats extracted:', stats);
            
            // Crop to just the sprite area
            const croppedScreenshot = this.cropToSprite(imageData);
            console.log('✓ Screenshot cropped');
            
            return {
                name: pokemonName?.value || '',
                nickname: nickname?.value || '',
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
                screenshot: croppedScreenshot,  
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
        } catch (error) {
            console.error('❌ OCR processing error:', error);
            throw error;
        }
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });        const w = imageData.width;
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

    async extractPokemonName(imageData, dateData, pokemonList) {
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
        
        const fuzzyMatch = this.findBestPokemonMatch(pokemonName, pokemonList); // ← Pass it here
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

    findBestPokemonMatch(ocrText, pokemonList) {  
        if (!ocrText) return null;
        
        const lowerOcr = ocrText.toLowerCase();
        
        // Get all unique Pokemon names from the parameter (not this.app.pokemon)
        const pokemonNames = [...new Set(pokemonList.map(p => p.name))];
        
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

    cropToSprite(imageData) {
        const w = imageData.width;
        const h = imageData.height;
        
        // Define the sprite region (between CP and stats box)
        // This captures just the Pokemon visual area
        const refHeight = 2556;
        const scale = h / refHeight;
        
        // Approximate sprite region
        const cropRegion = {
            x: Math.floor(w * 0.1),           // Left edge (10% from left)
            y: Math.floor(h * 0.15),          // Top (below CP, around 15% down)
            width: Math.floor(w * 0.8),       // Width (80% of image)
            height: Math.floor(h * 0.25)      // Height (about 25% - captures sprite area)
        };
        
        // Create a new canvas for the cropped image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = cropRegion.width;
        canvas.height = cropRegion.height;
        
        // Draw the cropped region
        ctx.drawImage(
            imageData.image,
            cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
            0, 0, cropRegion.width, cropRegion.height
        );
        
        return canvas.toDataURL();
    }
}