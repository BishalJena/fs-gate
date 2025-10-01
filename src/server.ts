// src/server.ts - Agricultural AI MCP Server for Docker MCP Gateway
import { config } from "dotenv";
config(); // Load .env file

import fetch from "node-fetch";
import { createServer } from 'http';

// MCP Protocol Types
interface MCPRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: any;
}

interface MCPResponse {
    jsonrpc: "2.0";
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

const PORT = process.env.PORT || 10000;

/**
 * Crop Price Tool Handler
 */
const cropPriceHandler = async (params: any) => {
    try {
        const API_KEY = process.env.DATAGOVIN_API_KEY;
        const RESOURCE_ID = process.env.DATAGOVIN_RESOURCE_ID ?? "35985678-0d79-46b4-9ed6-6f13308a1d24";

        if (!API_KEY) {
            return {
                error: "Configuration error: DATAGOVIN_API_KEY not set in environment."
            };
        }

        const { state, district, commodity } = params;
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;

        // Build URL with filters[...] parameters
        const base = `https://api.data.gov.in/resource/${encodeURIComponent(RESOURCE_ID)}`;
        const urlParams = new URLSearchParams();
        urlParams.set("api-key", API_KEY);
        urlParams.set("format", "json");
        urlParams.set("limit", String(limit));
        urlParams.set("offset", String(offset));

        if (state) urlParams.append("filters[State]", state);
        if (district) urlParams.append("filters[District]", district);
        if (commodity) urlParams.append("filters[Commodity]", commodity);

        const url = `${base}?${urlParams.toString()}`;

        // Fetch data
        const res = await fetch(url, { method: "GET" });
        const text = await res.text();

        if (!res.ok) {
            return {
                error: `HTTP ${res.status} fetching data.gov.in: ${text}`
            };
        }

        // parse JSON (defensive)
        let json;
        try {
            json = JSON.parse(text);
        } catch (err) {
            return { error: `Invalid JSON response: ${text}` };
        }

        // Format response for better readability
        const records = json.records || [];
        const total = json.total || records.length;

        return {
            success: true,
            data: {
                records,
                total,
                limit,
                offset,
                query: { state, district, commodity }
            }
        };
    } catch (err) {
        return { error: `Server error: ${String(err)}` };
    }
};

/**
 * EXA Search Tool Handler
 */
const searchHandler = async (params: any) => {
    try {
        const API_KEY = process.env.EXA_API_KEY;

        if (!API_KEY) {
            return {
                error: "Configuration error: EXA_API_KEY not set in environment."
            };
        }

        const { query, num_results = 5, include_domains, exclude_domains, start_crawl_date, end_crawl_date } = params;

        // Build EXA API request
        const requestBody: any = {
            query,
            num_results,
            use_autoprompt: true,
            contents: {
                text: true
            }
        };

        if (include_domains) requestBody.include_domains = include_domains;
        if (exclude_domains) requestBody.exclude_domains = exclude_domains;
        if (start_crawl_date) requestBody.start_crawl_date = start_crawl_date;
        if (end_crawl_date) requestBody.end_crawl_date = end_crawl_date;

        const res = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        const text = await res.text();

        if (!res.ok) {
            return {
                error: `HTTP ${res.status} fetching EXA API: ${text}`
            };
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (err) {
            return { error: `Invalid JSON response from EXA: ${text}` };
        }

        // Format response
        const results = json.results || [];

        return {
            success: true,
            data: {
                results: results.map((result: any) => ({
                    title: result.title,
                    url: result.url,
                    text: result.text?.substring(0, 500) + (result.text?.length > 500 ? '...' : ''),
                    score: result.score,
                    published_date: result.published_date
                })),
                total_results: results.length,
                query
            }
        };
    } catch (err) {
        return { error: `Server error: ${String(err)}` };
    }
};

// Store tool handlers
const toolHandlers = new Map();
toolHandlers.set('crop-price', cropPriceHandler);
toolHandlers.set('search', searchHandler);

// MCP Tool Definitions
const mcpTools: MCPTool[] = [
    {
        name: "crop-price",
        description: "Fetch crop price data from data.gov.in with state/district/commodity filters",
        inputSchema: {
            type: "object",
            properties: {
                state: {
                    type: "string",
                    description: "State filter (e.g., Punjab, Maharashtra)"
                },
                district: {
                    type: "string", 
                    description: "District filter (e.g., Ludhiana, Mumbai)"
                },
                commodity: {
                    type: "string",
                    description: "Commodity filter (e.g., Wheat, Rice, Cotton)"
                },
                limit: {
                    type: "number",
                    description: "Max records to return (default: 50)",
                    default: 50
                },
                offset: {
                    type: "number", 
                    description: "Records to skip (default: 0)",
                    default: 0
                }
            }
        }
    },
    {
        name: "search",
        description: "Search the web for agricultural information using EXA API",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query for agricultural information"
                },
                num_results: {
                    type: "number",
                    description: "Number of results to return (default: 5)",
                    default: 5
                },
                include_domains: {
                    type: "array",
                    items: { type: "string" },
                    description: "Domains to include in search"
                },
                exclude_domains: {
                    type: "array", 
                    items: { type: "string" },
                    description: "Domains to exclude from search"
                }
            },
            required: ["query"]
        }
    }
];

// MCP Protocol Handlers
const handleMCPRequest = async (request: MCPRequest): Promise<MCPResponse> => {
    try {
        switch (request.method) {
            case "initialize":
                return {
                    jsonrpc: "2.0",
                    id: request.id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: "agricultural-ai-mcp",
                            version: "1.0.0"
                        }
                    }
                };

            case "tools/list":
                return {
                    jsonrpc: "2.0",
                    id: request.id,
                    result: {
                        tools: mcpTools
                    }
                };

            case "tools/call":
                const { name, arguments: args } = request.params;
                const handler = toolHandlers.get(name);
                
                if (!handler) {
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        error: {
                            code: -32601,
                            message: `Tool '${name}' not found`,
                            data: { availableTools: Array.from(toolHandlers.keys()) }
                        }
                    };
                }

                const result = await handler(args);
                
                if (result.error) {
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        error: {
                            code: -32603,
                            message: result.error
                        }
                    };
                }

                return {
                    jsonrpc: "2.0",
                    id: request.id,
                    result: {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(result.data, null, 2)
                            }
                        ]
                    }
                };

            default:
                return {
                    jsonrpc: "2.0",
                    id: request.id,
                    error: {
                        code: -32601,
                        message: `Method '${request.method}' not found`
                    }
                };
        }
    } catch (error) {
        return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
                code: -32603,
                message: `Internal error: ${String(error)}`
            }
        };
    }
};

// Hybrid Server: HTTP + MCP Protocol Support
const httpServer = createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // MCP Protocol Endpoint (for Docker MCP Gateway)
    if (req.url === '/mcp' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const mcpRequest: MCPRequest = JSON.parse(body);
                const mcpResponse = await handleMCPRequest(mcpRequest);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(mcpResponse));
            } catch (error) {
                const errorResponse: MCPResponse = {
                    jsonrpc: "2.0",
                    id: 0,
                    error: {
                        code: -32700,
                        message: `Parse error: ${String(error)}`
                    }
                };
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(errorResponse));
            }
        });
        return;
    }

    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            server: 'agricultural-ai-mcp',
            protocols: ['http', 'mcp'],
            tools: ['crop-price', 'search'],
            timestamp: new Date().toISOString(),
            environment: {
                datagovin_key_set: !!process.env.DATAGOVIN_API_KEY,
                exa_key_set: !!process.env.EXA_API_KEY,
                port: PORT
            },
            mcp: {
                endpoint: '/mcp',
                protocol_version: '2024-11-05',
                capabilities: ['tools']
            }
        }));
        return;
    }

    // Root endpoint with API info
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            name: 'Agricultural AI MCP Server',
            version: '1.0.0',
            description: 'Hybrid server: HTTP API + MCP Protocol for Docker MCP Gateway integration',
            protocols: {
                http: 'Direct HTTP API access',
                mcp: 'Model Context Protocol via /mcp endpoint'
            },
            tools: [
                {
                    name: 'crop-price',
                    description: 'Fetch crop price data from data.gov.in',
                    endpoint: '/tools/crop-price',
                    method: 'POST',
                    parameters: {
                        state: 'string (optional) - State filter (e.g., Punjab, Maharashtra)',
                        district: 'string (optional) - District filter (e.g., Ludhiana, Mumbai)',
                        commodity: 'string (optional) - Commodity filter (e.g., Wheat, Rice, Cotton)',
                        limit: 'number (optional) - Max records to return (default: 50)',
                        offset: 'number (optional) - Records to skip (default: 0)'
                    }
                },
                {
                    name: 'search',
                    description: 'Search the web for agricultural information',
                    endpoint: '/tools/search',
                    method: 'POST',
                    parameters: {
                        query: 'string (required) - Search query',
                        num_results: 'number (optional) - Number of results (default: 5)',
                        include_domains: 'array (optional) - Domains to include',
                        exclude_domains: 'array (optional) - Domains to exclude'
                    }
                }
            ],
            usage: {
                http: 'POST to /tools/{tool-name} with JSON body containing tool parameters',
                mcp: 'POST to /mcp with MCP protocol JSON-RPC requests'
            },
            examples: {
                'crop-price': {
                    url: '/tools/crop-price',
                    method: 'POST',
                    body: { state: 'Punjab', commodity: 'Wheat', limit: 10 }
                },
                'search': {
                    url: '/tools/search',
                    method: 'POST',
                    body: { query: 'Indian agriculture news 2024', num_results: 5 }
                }
            }
        }));
        return;
    }

    // Tool endpoints
    if (req.url?.startsWith('/tools/') && req.method === 'POST') {
        const toolName = req.url.split('/tools/')[1];

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const params = JSON.parse(body || '{}');
                const handler = toolHandlers.get(toolName);

                if (!handler) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: `Tool '${toolName}' not found`,
                        available_tools: Array.from(toolHandlers.keys())
                    }));
                    return;
                }

                const result = await handler(params);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Invalid request: ${error}` }));
            }
        });
        return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start HTTP server
httpServer.listen(PORT, () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction ? 'https://fs-gate.onrender.com' : `http://localhost:${PORT}`;

    console.log(`🚀 Agricultural AI MCP Server running on port ${PORT}`);
    console.log(`🌾 HTTP: Crop price tool: ${baseUrl}/tools/crop-price`);
    console.log(`🔍 HTTP: Search tool: ${baseUrl}/tools/search`);
    console.log(`🤖 MCP: Protocol endpoint: ${baseUrl}/mcp`);
    console.log(`❤️  Health check: ${baseUrl}/health`);
    console.log(`📖 API docs: ${baseUrl}/`);

    if (isProduction) {
        console.log(`🎯 Live with Docker MCP Gateway support! Ready for hackathon!`);
    } else {
        console.log(`🎯 Ready for Docker MCP Gateway integration and cloud deployment!`);
    }
});