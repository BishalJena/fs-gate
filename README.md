# 🌾 Agricultural AI MCP Server

A production-ready HTTP server providing crop price data and web search capabilities for agricultural AI chatbots. Built for hackathons and deployed on Render.

## 🚀 Features

- **Crop Price Data**: Real-time agricultural commodity prices from data.gov.in
- **Web Search**: Agricultural news and information via EXA API
- **HTTP API**: RESTful endpoints for easy integration
- **Docker Ready**: Containerized for cloud deployment
- **CORS Enabled**: Web-friendly for frontend integration
- **Health Checks**: Built-in monitoring endpoints

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```bash
export DATAGOVIN_API_KEY=your_datagovin_api_key
export EXA_API_KEY=your_exa_api_key
export DATAGOVIN_RESOURCE_ID=35985678-0d79-46b4-9ed6-6f13308a1d24
export PORT=10000
```

### 3. Build and Run
```bash
npm run build
npm start
```

### 4. Test the API
```bash
# Health check
curl http://localhost:10000/health

# Get crop prices
curl -X POST http://localhost:10000/tools/crop-price \
  -H "Content-Type: application/json" \
  -d '{"state": "Punjab", "commodity": "Wheat", "limit": 5}'

# Search agriculture info
curl -X POST http://localhost:10000/tools/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Indian agriculture news", "num_results": 3}'
```

## 🌐 API Endpoints

### Crop Price Tool
**POST** `/tools/crop-price`

Parameters:
- `state` (optional): State filter (e.g., "Punjab", "Maharashtra")
- `district` (optional): District filter (e.g., "Ludhiana", "Mumbai")
- `commodity` (optional): Commodity filter (e.g., "Wheat", "Rice", "Cotton")
- `limit` (optional): Max records (default: 50, max: 10000)
- `offset` (optional): Records to skip (default: 0)

### Search Tool
**POST** `/tools/search`

Parameters:
- `query` (required): Search query
- `num_results` (optional): Number of results (default: 5, max: 20)
- `include_domains` (optional): Array of domains to include
- `exclude_domains` (optional): Array of domains to exclude

### Other Endpoints
- **GET** `/` - API documentation
- **GET** `/health` - Health check

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t agricultural-ai-mcp .
```

### Run Container
```bash
docker run -p 10000:10000 \
  -e DATAGOVIN_API_KEY=your_key \
  -e EXA_API_KEY=your_key \
  agricultural-ai-mcp
```

## ☁️ Cloud Deployment

### Render (Recommended)
1. Push code to GitHub
2. Connect repo to Render
3. Set environment variables
4. Deploy!

See [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) for detailed instructions.

## 🤖 Chatbot Integration

```javascript
const API_BASE = 'https://your-app.onrender.com';

// Get crop prices
async function getCropPrices(state, commodity) {
  const response = await fetch(`${API_BASE}/tools/crop-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, commodity, limit: 10 })
  });
  return response.json();
}

// Search agriculture info
async function searchAgriculture(query) {
  const response = await fetch(`${API_BASE}/tools/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, num_results: 5 })
  });
  return response.json();
}
```

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "records": [...],
    "total": 150,
    "limit": 10,
    "offset": 0,
    "query": { "state": "Punjab", "commodity": "Wheat" }
  }
}
```

### Error Response
```json
{
  "error": "Configuration error: API key not set"
}
```

## 🔐 Security

- Environment variables for API keys
- Input validation and sanitization
- CORS enabled for web access
- Error handling for API failures
- Rate limiting handled gracefully

## 🎯 Perfect for Hackathons

- ✅ **5-minute deployment** on Render
- ✅ **Real agricultural data** from Indian government
- ✅ **Web search capabilities** for comprehensive answers
- ✅ **Production-ready** infrastructure
- ✅ **Easy integration** with any chatbot framework
- ✅ **Live demo URLs** for judges to test

## 📝 License

MIT License - Perfect for hackathon projects!