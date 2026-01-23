// Application state
let generationHistory = [];

// DOM elements
const promptInput = document.getElementById('prompt');
const modelSelect = document.getElementById('model');
const generateBtn = document.getElementById('generateBtn');
const resultContainer = document.getElementById('result');
const statusDiv = document.getElementById('status');
const historyList = document.getElementById('historyList');
const btnText = generateBtn.querySelector('.btn-text');
const loader = generateBtn.querySelector('.loader');

// Check Ollama connection on load
checkOllamaConnection();

// Event listeners
generateBtn.addEventListener('click', generateImage);

// Check if Ollama is running
async function checkOllamaConnection() {
    statusDiv.textContent = 'Checking connection...';
    statusDiv.className = 'status checking';
    
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            statusDiv.textContent = '✓ Connected to Ollama';
            statusDiv.className = 'status connected';
        } else {
            statusDiv.textContent = '✗ Ollama not connected';
            statusDiv.className = 'status disconnected';
        }
    } catch (error) {
        statusDiv.textContent = '✗ Cannot connect to server';
        statusDiv.className = 'status disconnected';
    }
}

// Generate image function
async function generateImage() {
    const prompt = promptInput.value.trim();
    const model = modelSelect.value;
    
    if (!prompt) {
        alert('Please enter a prompt');
        return;
    }
    
    // Disable button and show loading state
    generateBtn.disabled = true;
    btnText.textContent = 'Generating...';
    loader.style.display = 'block';
    
    // Clear previous result
    resultContainer.innerHTML = '<div class="placeholder"><p>Generating your image...</p></div>';
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, model })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayResult(data, prompt, model);
            addToHistory(prompt, model, data.result);
        } else {
            displayError(data.error || 'Failed to generate image');
        }
    } catch (error) {
        displayError('Network error: ' + error.message);
    } finally {
        // Re-enable button
        generateBtn.disabled = false;
        btnText.textContent = 'Generate Image';
        loader.style.display = 'none';
    }
}

// Display the result
function displayResult(data, prompt, model) {
    const resultContent = document.createElement('div');
    resultContent.className = 'result-content';
    
    // Check if result contains image data (base64)
    if (data.result && (data.result.startsWith('data:image') || data.result.includes('base64'))) {
        const img = document.createElement('img');
        img.src = data.result;
        img.alt = 'Generated image';
        img.className = 'result-image';
        resultContent.appendChild(img);
        
        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '⬇️ Download Image';
        downloadBtn.onclick = () => downloadImage(data.result, prompt);
        resultContent.appendChild(downloadBtn);
    } else {
        // Display as text if not an image
        const textDiv = document.createElement('div');
        textDiv.className = 'result-text';
        textDiv.textContent = data.result;
        resultContent.appendChild(textDiv);
    }
    
    // Add info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'result-info';
    infoDiv.innerHTML = `
        <strong>Model:</strong> ${model}<br>
        <strong>Prompt:</strong> ${prompt}
    `;
    resultContent.appendChild(infoDiv);
    
    resultContainer.innerHTML = '';
    resultContainer.appendChild(resultContent);
}

// Download image with custom filename
function downloadImage(imageDataUrl, defaultPrompt) {
    // Generate a default filename from the prompt (sanitized)
    const sanitizedPrompt = defaultPrompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `${sanitizedPrompt}-${timestamp}.png`;
    
    // Prompt user for filename
    const filename = prompt('Enter filename for the image:', defaultFilename);
    
    // If user cancels, don't download
    if (!filename) return;
    
    // Ensure filename has .png extension
    const finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
    
    // Create a temporary link element and trigger download
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Display error message
function displayError(message) {
    resultContainer.innerHTML = `
        <div class="error-message">
            <strong>Error:</strong> ${message}
            <br><br>
            <small>Make sure Ollama is running and the models are installed.</small>
        </div>
    `;
}

// Add to history
function addToHistory(prompt, model, result) {
    const historyItem = {
        prompt,
        model,
        result,
        timestamp: new Date().toLocaleString()
    };
    
    generationHistory.unshift(historyItem);
    
    // Keep only last 10 items
    if (generationHistory.length > 10) {
        generationHistory.pop();
    }
    
    updateHistoryDisplay();
}

// Update history display
function updateHistoryDisplay() {
    historyList.innerHTML = '';
    
    if (generationHistory.length === 0) {
        historyList.innerHTML = '<p style="color: #9ca3af; text-align: center;">No generation history yet</p>';
        return;
    }
    
    generationHistory.forEach((item, index) => {
        const historyItemDiv = document.createElement('div');
        historyItemDiv.className = 'history-item';
        historyItemDiv.innerHTML = `
            <div class="history-item-prompt">${item.prompt}</div>
            <div class="history-item-model">${item.model}</div>
            <div class="history-item-time">${item.timestamp}</div>
        `;
        
        historyItemDiv.addEventListener('click', () => {
            promptInput.value = item.prompt;
            modelSelect.value = item.model;
            displayResult({ result: item.result }, item.prompt, item.model);
        });
        
        historyList.appendChild(historyItemDiv);
    });
}

// Allow Enter key to submit (with Shift+Enter for new line)
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateImage();
    }
});

// Made with Bob
