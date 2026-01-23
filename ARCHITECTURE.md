# Ollama Image Generator - Architecture

## System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Web Browser"]
        UI["User Interface<br/>(HTML/CSS/JS)"]
    end

    subgraph Application["Application Layer"]
        Express["Express Server<br/>(Node.js)"]
        API["REST API Endpoints"]
        Static["Static File Server"]
    end

    subgraph AI["AI Layer"]
        Ollama["Ollama HTTP API<br/>(localhost:11434)"]
        Models["AI Models<br/>- flux2-klein:4b<br/>- z-image-turbo:fp8"]
    end

    Browser --> UI
    UI -->|HTTP Requests| Express
    Express --> API
    Express --> Static
    API -->|POST /api/generate| Ollama
    Ollama --> Models
    Models -->|Generate Image| Ollama
    Ollama -->|Newline-delimited JSON| API
    API -->|Base64 Image Data| UI
    Static -->|Serve Files| UI

    style Client fill:#e1f5ff
    style Application fill:#fff3e0
    style AI fill:#f3e5f5
```

## Component Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant S as Express Server
    participant O as Ollama API
    participant M as AI Model

    U->>B: Enter prompt & select model
    B->>S: POST /api/generate with prompt and model
    S->>S: Validate request
    S->>O: POST /api/generate with model, prompt, stream false
    O->>M: Load model & process prompt
    M->>M: Generate image (10-30s)
    M->>O: Return base64 PNG
    O->>S: Newline-delimited JSON with image field
    S->>S: Parse response & extract base64 data
    S->>B: JSON response with base64 image data URI
    B->>B: Create img element with data URI
    B->>U: Display generated image
```

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users["Users"]
    end

    subgraph K8s["Kubernetes Cluster"]
        subgraph Ingress["Ingress Layer"]
            LB["Load Balancer<br/>(Service)"]
        end

        subgraph App["Application Pods"]
            Pod1["Pod 1<br/>ollama-image-generator"]
            Pod2["Pod 2<br/>ollama-image-generator"]
        end

        subgraph Config["Configuration"]
            CM["ConfigMap<br/>(Environment Variables)"]
        end

        subgraph AI_Service["AI Service"]
            OllamaService["Ollama Service<br/>(External/Internal)"]
        end
    end

    Users -->|HTTPS| LB
    LB -->|Route Traffic| Pod1
    LB -->|Route Traffic| Pod2
    Pod1 -->|Read Config| CM
    Pod2 -->|Read Config| CM
    Pod1 -->|API Calls| OllamaService
    Pod2 -->|API Calls| OllamaService

    style Internet fill:#e3f2fd
    style Ingress fill:#fff3e0
    style App fill:#f1f8e9
    style Config fill:#fce4ec
    style AI_Service fill:#f3e5f5
```

## API Endpoints

```mermaid
flowchart LR
    subgraph Endpoints["API Endpoints"]
        Generate["/api/generate<br/>(POST)"]
        Models["/api/models<br/>(GET)"]
        Health["/api/health<br/>(GET)"]
    end

    subgraph Actions["Actions"]
        GenImage["Generate Image<br/>from Prompt"]
        ListModels["List Available<br/>Models"]
        CheckHealth["Check Ollama<br/>Connection"]
    end

    Generate --> GenImage
    Models --> ListModels
    Health --> CheckHealth

    style Endpoints fill:#e1f5ff
    style Actions fill:#fff3e0
```

## Data Flow

```mermaid
flowchart LR
    subgraph Input["Input"]
        Prompt["User Prompt"]
        Model["Selected Model"]
    end

    subgraph Processing["Processing"]
        Validate["Validation"]
        Transform["Transform Request"]
        Call["API Call"]
    end

    subgraph Output["Output"]
        Response["Generated Image"]
        Metadata["Model Info"]
        Status["Success/Error"]
    end

    Prompt --> Validate
    Model --> Validate
    Validate --> Transform
    Transform --> Call
    Call --> Response
    Call --> Metadata
    Call --> Status

    style Input fill:#e8f5e9
    style Processing fill:#fff3e0
    style Output fill:#e1f5ff
```

## Technology Stack

```mermaid
mindmap
  root((Ollama Image<br/>Generator))
    Frontend
      HTML5
      CSS3
      Vanilla JavaScript
    Backend
      Node.js
      Express.js
      Axios HTTP Client
      CORS
    AI/ML
      Ollama HTTP API
      flux2-klein:4b
      z-image-turbo:fp8
    DevOps
      Docker
      Kubernetes
      Bash Scripts
    Infrastructure
      Load Balancer
      ConfigMap
      Health Checks
```

## Security Architecture

```mermaid
flowchart TB
    subgraph Security["Security Layers"]
        subgraph Container["Container Security"]
            NonRoot["Non-root User<br/>(UID 1001)"]
            ReadOnly["Read-only Filesystem"]
            Capabilities["Dropped Capabilities"]
        end

        subgraph Network["Network Security"]
            CORS["CORS Policy"]
            Validation["Input Validation"]
            Timeout["Request Timeout"]
        end

        subgraph K8s_Security["Kubernetes Security"]
            SecurityContext["Security Context"]
            ResourceLimits["Resource Limits"]
            HealthProbes["Health Probes"]
        end
    end

    Container --> Network
    Network --> K8s_Security

    style Container fill:#ffebee
    style Network fill:#e8f5e9
    style K8s_Security fill:#e3f2fd
```

## Scaling Strategy

```mermaid
flowchart TB
    subgraph Scaling["Horizontal Scaling"]
        HPA["Horizontal Pod<br/>Autoscaler"]
        Replicas["Multiple Replicas<br/>(Default: 2)"]
        LB["Load Balancer<br/>Distribution"]
    end

    subgraph Resources["Resource Management"]
        Requests["Resource Requests<br/>CPU: 100m<br/>Memory: 128Mi"]
        Limits["Resource Limits<br/>CPU: 500m<br/>Memory: 512Mi"]
    end

    subgraph Monitoring["Health Monitoring"]
        Liveness["Liveness Probe<br/>/api/health"]
        Readiness["Readiness Probe<br/>/api/health"]
    end

    HPA --> Replicas
    Replicas --> LB
    Requests --> Limits
    Liveness --> Readiness

    style Scaling fill:#e8f5e9
    style Resources fill:#fff3e0
    style Monitoring fill:#e1f5ff
```

## Key Features

- **HTTP API Integration**: Uses Ollama's HTTP API (`/api/generate`) for programmatic access
- **Stateless Design**: Application pods are stateless for easy scaling
- **Health Monitoring**: Liveness and readiness probes ensure reliability
- **Resource Management**: CPU and memory limits prevent resource exhaustion
- **Security**: Non-root containers with minimal privileges
- **High Availability**: Multiple replicas with load balancing
- **Configuration Management**: External configuration via ConfigMap
- **Graceful Degradation**: Health checks detect Ollama API availability

## Implementation Notes

### HTTP API Communication

The application uses Ollama's HTTP API for image generation:

**Request Format:**
```javascript
POST http://localhost:11434/api/generate
Content-Type: application/json

{
  "model": "x/flux2-klein:4b",
  "prompt": "a cat holding a sign that says hello world",
  "stream": false
}
```

**Response Format:**
- **Type**: Newline-delimited JSON (NDJSON)
- **Structure**: Multiple JSON objects, one per line
- **Final Response**: Contains `image` field with base64-encoded PNG

```json
{"model":"x/flux2-klein:4b","created_at":"...","response":"","done":false}
{"model":"x/flux2-klein:4b","created_at":"...","response":"","done":true,"image":"iVBORw0KGgo..."}
```

**Key Implementation Details:**
1. **Response Parsing**: Split by newlines, parse last line as JSON
2. **Image Field**: Singular `image` field (not `images` array)
3. **Base64 Encoding**: Image data is base64-encoded PNG
4. **Data URI**: Converted to `data:image/png;base64,{image}` for browser display
5. **Timeout**: 3 minutes (180 seconds) for generation
6. **Max Content Length**: 50MB to handle large images

**Supported Models:**
- `x/flux2-klein:4b` - High-quality image generation (slower)
- `x/z-image-turbo:fp8` - Fast image generation (faster)

**Error Handling:**
- Connection errors: Ollama service not running
- Timeout errors: Generation took too long
- Parse errors: Invalid response format
- Empty response: Model failed to generate