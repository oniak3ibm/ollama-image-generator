const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_API_URL = 'http://localhost:11434';
const MAX_CONTENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const IMAGE_GENERATION_TIMEOUT_MS = 180000; // 3 minutes timeout for image generation
const OLLAMA_REQUEST_CONFIG = {
    timeout: IMAGE_GENERATION_TIMEOUT_MS,
    maxContentLength: MAX_CONTENT_SIZE_BYTES,
    maxBodyLength: MAX_CONTENT_SIZE_BYTES
};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate request body for image generation
 */
function validateRequest(body) {
    const { prompt, model } = body;
    if (!prompt || !model) {
        return { valid: false, error: 'Prompt and model are required' };
    }
    return { valid: true, prompt, model };
}

/**
 * Measure current memory usage
 */
function measureMemory() {
    return process.memoryUsage();
}

/**
 * Calculate and log memory usage difference
 */
function logMemoryUsage(memBefore, memAfter) {
    const memDiff = {
        rss: ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2),
        heapTotal: ((memAfter.heapTotal - memBefore.heapTotal) / 1024 / 1024).toFixed(2),
        heapUsed: ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2),
        external: ((memAfter.external - memBefore.external) / 1024 / 1024).toFixed(2)
    };
    
    debugLog('=== Memory Usage Before Generation ===');
    debugLog(`RSS: ${(memBefore.rss / 1024 / 1024).toFixed(2)} MB`);
    debugLog(`Heap Total: ${(memBefore.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    debugLog(`Heap Used: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    debugLog(`External: ${(memBefore.external / 1024 / 1024).toFixed(2)} MB`);
    
    debugLog('=== Memory Usage After Generation ===');
    debugLog(`RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB (Δ ${memDiff.rss} MB)`);
    debugLog(`Heap Total: ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB (Δ ${memDiff.heapTotal} MB)`);
    debugLog(`Heap Used: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB (Δ ${memDiff.heapUsed} MB)`);
    debugLog(`External: ${(memAfter.external / 1024 / 1024).toFixed(2)} MB (Δ ${memDiff.external} MB)`);
    
    return memDiff;
}

/**
 * Track memory usage for a generation operation
 */
function trackMemoryUsage(beforeMem) {
    const afterMem = measureMemory();
    return logMemoryUsage(beforeMem, afterMem);
}

/**
 * Conditional debug logging
 */
function debugLog(...args) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
        console.log(...args);
    }
}

/**
 * Extract base64 image data from various response formats
 */
function extractImageData(data) {
    if (data.image) return `data:image/png;base64,${data.image}`;
    if (data.images?.[0]) return `data:image/png;base64,${data.images[0]}`;
    if (Buffer.isBuffer(data)) return `data:image/png;base64,${data.toString('base64')}`;
    return null;
}

/**
 * Parse NDJSON string and return last line as JSON
 */
function parseNDJSON(data) {
    const lines = data.trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
}

/**
 * Handle string response (NDJSON format)
 */
function parseStringResponse(data, log) {
    log('Response is a string, length:', data.length);
    
    try {
        const parsed = parseNDJSON(data);
        log('Parsed response keys:', Object.keys(parsed));
        
        const imageData = extractImageData(parsed);
        if (imageData) {
            log('✓ Found image in parsed response');
            return { imageData, ollamaResponse: '' };
        }
        
        if (parsed.response) {
            log('Found response field, length:', parsed.response.length);
            return { imageData: null, ollamaResponse: parsed.response };
        }
    } catch (e) {
        log('Failed to parse as JSON:', e.message);
        return { imageData: null, ollamaResponse: data };
    }
    
    return { imageData: null, ollamaResponse: '' };
}

/**
 * Handle object/Buffer response
 */
function parseObjectResponse(data, log) {
    const imageData = extractImageData(data);
    if (imageData) {
        log('✓ Found image in response');
        return { imageData, ollamaResponse: '' };
    }
    
    if (data.response) {
        log('Response length:', data.response.length);
        return { imageData: null, ollamaResponse: data.response };
    }
    
    return { imageData: null, ollamaResponse: '' };
}

/**
 * Parse Ollama API response and extract image/text data
 *
 * CRITICAL: Ollama returns newline-delimited JSON (NDJSON) for image generation
 * Format: Each line is a separate JSON object
 * Example:
 * {"model":"x/flux2-klein:4b","created_at":"...","response":"","done":false}
 * {"model":"x/flux2-klein:4b","created_at":"...","response":"","done":false}
 * {"model":"x/flux2-klein:4b","created_at":"...","done":true,"image":"base64data..."}
 *
 * The LAST line contains the complete image in the 'image' field (singular, not 'images')
 */
function parseOllamaResponse(data) {
    debugLog('Ollama API response received');
    debugLog('Response data type:', typeof data);
    
    if (typeof data === 'object' && !Buffer.isBuffer(data)) {
        debugLog('Response data keys:', Object.keys(data));
    }
    
    if (typeof data === 'string') {
        return parseStringResponse(data, debugLog);
    }
    
    if (typeof data === 'object' || Buffer.isBuffer(data)) {
        return parseObjectResponse(data, debugLog);
    }
    
    debugLog('✗ No image or response data found');
    return { imageData: null, ollamaResponse: '' };
}

/**
 * Build API response object
 */
function buildResponse({ imageData, ollamaResponse, model, memDiff, responseData }) {
    return {
        success: true,
        result: imageData || ollamaResponse || 'No image generated',
        model,
        hasImage: !!imageData,
        memoryUsage: {
            rssDiff: memDiff.rss,
            heapUsedDiff: memDiff.heapUsed
        },
        debug: {
            responseType: typeof responseData,
            isBuffer: Buffer.isBuffer(responseData),
            responseLength: ollamaResponse.length,
            hasImages: !!(responseData.images)
        }
    };
}

/**
 * Generate image using Ollama API
 */
async function generateImageWithOllama(model, prompt) {
    return axios.post(
        `${OLLAMA_API_URL}/api/generate`,
        { model, prompt, stream: false },
        OLLAMA_REQUEST_CONFIG
    );
}

/**
 * Handle error responses
 */
function handleError(error, res) {
    console.error('Error generating image:', error.message);
    if (error.response?.data) {
        console.error('Error details:', error.response.data);
    }
    if (error.stack) {
        console.error('Stack trace:', error.stack);
    }
    res.status(500).json({
        error: 'Failed to generate image',
        details: error.message,
        response: error.response?.data || ''
    });
}

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Endpoint to generate image using Ollama HTTP API
 * This endpoint handles image generation requests from the frontend
 */
app.post('/api/generate', async (req, res) => {
    const { valid, error, prompt, model } = validateRequest(req.body);
    if (!valid) {
        return res.status(400).json({ error });
    }

    try {
        const memBefore = measureMemory();
        debugLog(`Generating image with model: ${model}`);

        const response = await generateImageWithOllama(model, prompt);
        const { imageData, ollamaResponse } = parseOllamaResponse(response.data);
        const memDiff = trackMemoryUsage(memBefore);
        
        res.json(buildResponse({
            imageData,
            ollamaResponse,
            model,
            memDiff,
            responseData: response.data
        }));

    } catch (error) {
        handleError(error, res);
    }
});

// Endpoint to check available models
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:11434/api/tags');
        const models = response.data.models || [];
        
        res.json({
            models: models.map(m => ({ name: m.name }))
        });
    } catch (error) {
        console.error('Error fetching models:', error.message);
        res.status(500).json({
            error: 'Failed to fetch models',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
        res.json({ status: 'ok', ollama: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', ollama: 'disconnected', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using Ollama API for image generation`);
    console.log(`Supported models: x/flux2-klein:4b, x/z-image-turbo:fp8`);
});

// Made with Bob
