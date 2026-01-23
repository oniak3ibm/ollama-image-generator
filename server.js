const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint to generate image using Ollama HTTP API
// This endpoint handles image generation requests from the frontend
app.post('/api/generate', async (req, res) => {
    const { prompt, model } = req.body;

    if (!prompt || !model) {
        return res.status(400).json({ error: 'Prompt and model are required' });
    }

    try {
        console.log(`Generating image with model: ${model}`);
        console.log(`Prompt: ${prompt}`);

        // Call Ollama's HTTP API endpoint for image generation
        // Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
        //
        // Request format:
        // POST /api/generate
        // {
        //   "model": "x/flux2-klein:4b",
        //   "prompt": "your prompt here",
        //   "stream": false  // We use non-streaming for simplicity
        // }
        //
        // Response format: Newline-delimited JSON (NDJSON)
        // Each line is a separate JSON object showing generation progress
        // The final line contains the complete image in the 'image' field
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: model,
            prompt: prompt,
            stream: false  // Non-streaming mode returns all data at once
        }, {
            timeout: 180000, // 3 minutes timeout (image generation is slow)
            maxContentLength: 50 * 1024 * 1024, // 50MB max response size
            maxBodyLength: 50 * 1024 * 1024     // 50MB max request size
        });

        console.log('Ollama API response received');
        console.log('Response data type:', typeof response.data);
        console.log('Is Buffer:', Buffer.isBuffer(response.data));
        
        let imageData = null;
        let ollamaResponse = '';
        
        // CRITICAL: Ollama returns newline-delimited JSON (NDJSON) for image generation
        // Format: Each line is a separate JSON object
        // Example:
        // {"model":"x/flux2-klein:4b","created_at":"...","response":"","done":false}
        // {"model":"x/flux2-klein:4b","created_at":"...","response":"","done":false}
        // {"model":"x/flux2-klein:4b","created_at":"...","done":true,"image":"base64data..."}
        //
        // The LAST line contains the complete image in the 'image' field (singular, not 'images')
        
        if (typeof response.data === 'string') {
            console.log('Response is a string, length:', response.data.length);
            console.log('First 200 chars:', response.data.substring(0, 200));
            
            try {
                // Split the newline-delimited JSON into individual lines
                const lines = response.data.trim().split('\n');
                console.log('Number of lines:', lines.length);
                
                // Parse the LAST line which contains the final response with image data
                const lastLine = lines[lines.length - 1];
                const parsed = JSON.parse(lastLine);
                
                console.log('Parsed response keys:', Object.keys(parsed));
                
                // IMPORTANT: Image generation models return a singular 'image' field
                // NOT an 'images' array. This is different from some other APIs.
                if (parsed.image) {
                    // Convert base64 PNG data to a data URI for browser display
                    imageData = `data:image/png;base64,${parsed.image}`;
                    console.log('✓ Found image in parsed response (singular image field)');
                }
                // Fallback: Check for images array (some models might use this)
                else if (parsed.images && parsed.images.length > 0) {
                    imageData = `data:image/png;base64,${parsed.images[0]}`;
                    console.log('✓ Found image in parsed response images array');
                }
                // For text-based models, the response field contains the text
                else if (parsed.response) {
                    ollamaResponse = parsed.response;
                    console.log('Found response field, length:', ollamaResponse.length);
                }
            } catch (e) {
                console.log('Failed to parse as JSON:', e.message);
                ollamaResponse = response.data;
            }
        }
        // Fallback: Handle binary Buffer responses (rare for Ollama)
        else if (Buffer.isBuffer(response.data)) {
            const base64Data = response.data.toString('base64');
            imageData = `data:image/png;base64,${base64Data}`;
            console.log('✓ Converted Buffer to base64 image');
        }
        // Fallback: Handle pre-parsed JSON with images array
        else if (response.data.images && response.data.images.length > 0) {
            imageData = `data:image/png;base64,${response.data.images[0]}`;
            console.log('✓ Found image in images array');
        }
        // Fallback: Handle pre-parsed JSON with response field
        else if (response.data.response) {
            ollamaResponse = response.data.response;
            console.log('Response length:', ollamaResponse.length);
        }
        
        if (!imageData && !ollamaResponse) {
            console.log('✗ No image or response data found');
        }
        
        res.json({
            success: true,
            result: imageData || ollamaResponse || 'No image generated',
            model: model,
            hasImage: !!imageData,
            debug: {
                responseType: typeof response.data,
                isBuffer: Buffer.isBuffer(response.data),
                responseLength: ollamaResponse.length,
                hasImages: !!response.data.images
            }
        });

    } catch (error) {
        console.error('Error generating image:', error.message);
        console.error('Error details:', error.response?.data);
        res.status(500).json({
            error: 'Failed to generate image',
            details: error.message,
            response: error.response?.data || ''
        });
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
