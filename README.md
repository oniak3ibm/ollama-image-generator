# Ollama Image Generator

A graphical web application for generating images using local Ollama models.

## Features

- 🎨 Clean and modern user interface
- 🤖 Support for multiple Ollama models:
  - x/flux2-klein:4b (High quality)
  - x/z-image-turbo:fp8 (Fast generation)
- 📝 Text prompt input with real-time generation
- ⬇️ **Download generated images** with custom filenames
- 📊 Generation history tracking
- 🔄 Connection status monitoring
- 💾 Local processing (no cloud required)

## Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running locally
- Required Ollama models installed:
  ```bash
  ollama pull x/flux-klein:9b
  ollama pull x/z-image-turbo:fp8
  ```

**Note:** These models are image generation models and work via CLI commands:
```bash
ollama run x/flux-klein:9b "a cat holding a sign that says hello world"
ollama run x/z-image-turbo:fp8 "a cat holding a sign that says hello world"
```

## Installation

1. Navigate to the project directory:
   ```bash
   cd /Users/alainairom/Devs/ollama-image-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Quick Start with Scripts

1. Make sure Ollama is running on your system (default: http://localhost:11434)

2. Start the application:
   ```bash
   ./start.sh
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

4. Enter a prompt, select a model, and click "Generate Image"

5. Once the image is generated, click the **"⬇️ Download Image"** button below the image

6. Enter a custom filename when prompted (or use the auto-generated name)
   - Default format: `{sanitized-prompt}-{date}.png`
   - Example: `beautiful-sunset-over-mountains-2026-01-23.png`

7. The image will be saved to your browser's default download location

8. Stop the application:
   ```bash
   ./stop.sh
   ```

### Manual Start

Alternatively, you can start manually:
```bash
npm start
```

## How It Works

### High-Level Overview

- **Frontend**: HTML, CSS, and vanilla JavaScript for a responsive UI
- **Backend**: Node.js with Express server
- **AI Engine**: Local Ollama instance for image generation
- **Communication**: REST API between frontend and backend

### Technical Implementation Details

#### Ollama Image Generation API

The application uses Ollama's HTTP API (`/api/generate` endpoint) to generate images programmatically. Here's how it works internally:

**1. API Request Format**
```javascript
POST http://localhost:11434/api/generate
Content-Type: application/json

{
  "model": "x/flux2-klein:4b",
  "prompt": "a cat holding a sign that says hello world",
  "stream": false
}
```

**2. Response Format**

Ollama returns a **newline-delimited JSON** response. Each line is a separate JSON object representing generation progress:

```json
{"model":"x/flux2-klein:4b","created_at":"2026-01-23T07:24:18.081432Z","response":"","done":false,"total":4}
{"model":"x/flux2-klein:4b","created_at":"2026-01-23T07:24:28.481095Z","response":"","done":false}
...
{"model":"x/flux2-klein:4b","created_at":"2026-01-23T07:24:38.123456Z","response":"","done":true,"done_reason":"stop","total_duration":20000000000,"load_duration":5000000000,"image":"iVBORw0KGgoAAAANSUhEUgAA..."}
```

**3. Key Response Fields**

- `image` (string): Base64-encoded PNG image data (only in final response when `done: true`)
- `response` (string): Empty for image models (used for text generation)
- `done` (boolean): Indicates if generation is complete
- `done_reason` (string): Reason for completion ("stop", "length", etc.)

**4. Critical Implementation Details**

The server implementation ([`server.js`](server.js:40-75)) handles several important aspects:

```javascript
// Parse newline-delimited JSON response
const lines = response.data.trim().split('\n');
const lastLine = lines[lines.length - 1];
const parsed = JSON.parse(lastLine);

// Extract image from the 'image' field (singular, not 'images' array)
if (parsed.image) {
    imageData = `data:image/png;base64,${parsed.image}`;
}
```

**Important Notes:**
- Image data is in the **singular `image` field**, not an `images` array
- The response is **newline-delimited JSON**, not a single JSON object
- Only the **last line** contains the complete image data
- Image data is **base64-encoded PNG** format
- The `response` field is empty for image generation models

**5. Frontend Display**

The frontend ([`public/app.js`](public/app.js:88-118)) receives the base64 data URI and displays it:

```javascript
// Check if result contains image data
if (data.result && data.result.startsWith('data:image')) {
    const img = document.createElement('img');
    img.src = data.result;  // data:image/png;base64,...
    img.alt = 'Generated image';
    resultContent.appendChild(img);
}
```

**6. Model-Specific Behavior**

Different Ollama image models may have slight variations:
- **x/flux2-klein:4b**: Returns `image` field with base64 PNG
- **x/z-image-turbo:fp8**: Returns `image` field with base64 PNG
- Both use the same API format but may differ in generation speed and quality

## API Endpoints

- `POST /api/generate` - Generate image from prompt
- `GET /api/models` - List available Ollama models
- `GET /api/health` - Check Ollama connection status

## Troubleshooting

### Connection Issues

If you see "Ollama not connected":
1. Ensure Ollama is running: `ollama serve` (or check if it's running as a service)
2. Verify Ollama API is accessible: `curl http://localhost:11434/api/tags`
3. Check models are installed: `ollama list`
4. Test model execution: `ollama run x/flux2-klein:4b "test prompt"`

### Image Not Displaying

If images aren't generating or displaying:
1. Check server logs: `tail -f server.log`
2. Look for "✓ Found image in parsed response" in logs
3. Verify the model supports image generation (not text-only models)
4. Ensure sufficient system resources (image generation is memory-intensive)

### Common Issues

**Issue**: "Response length: 0" in logs
- **Cause**: Model returned empty response
- **Solution**: Verify model is properly installed and loaded

**Issue**: "No image data found in response"
- **Cause**: Response format doesn't match expected structure
- **Solution**: Check if you're using a text model instead of an image model

**Issue**: Generation takes too long
- **Cause**: FLUX models are computationally intensive
- **Solution**: Use faster model (x/z-image-turbo:fp8) or upgrade hardware

### Debug Mode

Enable detailed logging by checking server.log:
```bash
tail -f server.log
```

Look for these key log messages:
- `✓ Found image in parsed response` - Image successfully extracted
- `Response data type: string` - Correct response format received
- `Parsed response keys: [...]` - Shows available fields in response

## Automation Scripts

### Start Script (`start.sh`)
Launches the application with automatic dependency checking:
- Verifies Node.js and npm installation
- Installs dependencies if needed
- Checks Ollama connection
- Starts server in background
- Creates PID file for process management

```bash
./start.sh
```

### Stop Script (`stop.sh`)
Gracefully stops the running application:
- Finds and terminates the server process
- Cleans up PID files
- Verifies port 3000 is freed

```bash
./stop.sh
```

### GitHub Push Script (`push-to-github.sh`)
Automates Git operations:
- Stages all changes
- Prompts for commit message
- Pushes to GitHub repository
- Handles remote configuration

```bash
./push-to-github.sh
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t ollama-image-generator:latest .
```

### Run with Docker

```bash
docker run -d \
  --name ollama-image-generator \
  -p 3000:3000 \
  -e OLLAMA_URL=http://host.docker.internal:11434 \
  ollama-image-generator:latest
```

### Docker Compose (Optional)

Create a `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_URL=http://ollama:11434
    depends_on:
      - ollama
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

volumes:
  ollama-data:
```

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (minikube, kind, or cloud provider)
- kubectl configured
- Docker image built and pushed to registry

### Deploy to Kubernetes

1. **Update ConfigMap** (if needed):
   Edit `k8s/configmap.yaml` to set your Ollama service URL

2. **Apply Kubernetes manifests**:
   ```bash
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

3. **Check deployment status**:
   ```bash
   kubectl get pods
   kubectl get services
   ```

4. **Access the application**:
   ```bash
   # Get the external IP (for LoadBalancer)
   kubectl get service ollama-image-generator
   
   # Or use port-forward for testing
   kubectl port-forward service/ollama-image-generator 3000:80
   ```

### Kubernetes Resources

- **ConfigMap** (`k8s/configmap.yaml`): Environment configuration
- **Deployment** (`k8s/deployment.yaml`): Application deployment with 2 replicas
- **Service** (`k8s/service.yaml`): LoadBalancer service exposing port 80

### Scaling

Scale the deployment:
```bash
kubectl scale deployment ollama-image-generator --replicas=3
```

### Monitoring

View logs:
```bash
kubectl logs -f deployment/ollama-image-generator
```

Check health:
```bash
kubectl get pods
kubectl describe pod <pod-name>
```

## Architecture

For detailed architecture diagrams and system design, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

The architecture includes:
- System architecture flowchart
- Component interaction sequence
- Kubernetes deployment topology
- API endpoint structure
- Security layers
- Scaling strategy

## Project Structure

```
ollama-image-generator/
├── public/
│   ├── index.html           # Main HTML file
│   ├── styles.css           # Styling
│   └── app.js               # Frontend JavaScript
├── k8s/
│   ├── configmap.yaml       # Kubernetes ConfigMap
│   ├── deployment.yaml      # Kubernetes Deployment
│   └── service.yaml         # Kubernetes Service
├── server.js                # Express server
├── package.json             # Dependencies
├── Dockerfile               # Docker image definition
├── .dockerignore            # Docker ignore rules
├── start.sh                 # Start script
├── stop.sh                  # Stop script
├── push-to-github.sh        # GitHub push automation
├── ARCHITECTURE.md          # Architecture documentation
└── README.md                # This file
```

## Development Workflow

1. **Local Development**:
   ```bash
   ./start.sh
   # Make changes
   ./stop.sh
   ```

2. **Test Changes**:
   ```bash
   npm start
   # Test in browser
   ```

3. **Commit and Push**:
   ```bash
   ./push-to-github.sh
   ```

4. **Build and Deploy**:
   ```bash
   docker build -t ollama-image-generator:latest .
   kubectl apply -f k8s/
   ```

## License

MIT