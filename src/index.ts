#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Entity, Relation } from './types.js';
import { MarkdownStorageManager } from './storage/MarkdownStorageManager.js';
import { MCPMemoryIndexer } from './index/MCPMemoryIndexer.js';
import { VaultScanner } from './index/VaultScanner.js';
import { UnifiedIndex } from './index/UnifiedIndex.js';
import { VaultDiscovery } from './config/VaultDiscovery.js';
import { getMemoryDir } from './utils/pathUtils.js';
import { UnifiedToolHandler } from './handlers/UnifiedToolHandler.js';

// Create Markdown storage manager
const storageManager = new MarkdownStorageManager();

// Initialize datacore integration
let unifiedIndex: UnifiedIndex | null = null;
let mcpIndex: any | null = null; // Store for index updates

async function initializeDatacore(): Promise<UnifiedIndex> {
  console.error('Initializing datacore integration...');

  const memoryPath = getMemoryDir();
  mcpIndex = await MCPMemoryIndexer.create(memoryPath);
  console.error('✓ MCP memory indexer ready');

  const discovery = new VaultDiscovery();
  const vaults = await discovery.scanForVaults();
  console.error(`Found ${vaults.length} Obsidian vault(s)`);

  let vaultIndex: VaultScanner | null = null;

  if (vaults.length > 0) {
    const selectedPath = await discovery.selectVault(vaults);
    if (selectedPath) {
      vaultIndex = await VaultScanner.create(selectedPath);
      const selectedVault = vaults.find(v => v.path === selectedPath);
      console.error(`✓ Connected to vault: ${selectedVault?.name}`);
    }
  } else {
    console.error('⚠ No external vault found, operating in MCP-only mode');
  }

  const unified = new UnifiedIndex(mcpIndex, vaultIndex);
  console.error('✓ Datacore integration ready');

  return unified;
}

// The server instance
const server = new Server({
  name: "memory-server",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
  },
});

// Single unified tool definition
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "knowledge_graph",
        description: `Unified knowledge graph interface supporting all operations through a single tool.

Operations:
- entity: Create, delete, modify entities with automatic YAML structuring and atomic decomposition
- relation: Create, delete relations with bidirectional auto-generation and semantic normalization
- query: Search, read graph, query external vault
- analytics: Centrality, path finding, link prediction
- workflow: Execute multi-step knowledge workflows

Supports single operations or multi-step workflows in one call.`,
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["entity", "relation", "query", "analytics", "workflow"],
              description: "Operation category to perform"
            },
            subfunction: {
              type: "string",
              description: `Specific function within operation:
- entity: create, delete, add_observations, delete_observations
- relation: create, delete, get_properties
- query: read_graph, search, open, vault
- analytics: centrality, paths, predictions, communities, temporal
- workflow: (not used, workflow steps define their own operations)`
            },
            params: {
              type: "object",
              description: "Operation-specific parameters",
              properties: {
                entities: {
                  type: "array",
                  description: "For entity.create: array of entities to create"
                },
                entityNames: {
                  type: "array",
                  description: "For entity.delete: array of entity names"
                },
                observations: {
                  type: "array",
                  description: "For entity.add_observations: array of observation objects"
                },
                relations: {
                  type: "array",
                  description: "For relation.create/delete: array of relations"
                },
                query: {
                  type: "string",
                  description: "For query.search/vault: search query"
                },
                names: {
                  type: "array",
                  description: "For query.open: array of entity names"
                },
                entityName: {
                  type: "string",
                  description: "For analytics: entity name for path/predictions"
                },
                targetEntity: {
                  type: "string",
                  description: "For analytics.paths: target entity name"
                },
                atomicDecomposition: {
                  type: "boolean",
                  description: "Enable atomic entity extraction (default: true)"
                },
                bidirectional: {
                  type: "boolean",
                  description: "Auto-create inverse relations (default: true)"
                },
                includeContent: {
                  type: "boolean",
                  description: "Include full content in results (default: false)"
                },
                limit: {
                  type: "number",
                  description: "Maximum results to return"
                },
                maxHops: {
                  type: "number",
                  description: "Maximum hops for path finding (default: 5)"
                },
                topK: {
                  type: "number",
                  description: "Top K results for predictions (default: 10)"
                }
              }
            },
            workflow: {
              type: "array",
              description: "Multi-step workflow: array of steps to execute sequentially",
              items: {
                type: "object",
                properties: {
                  operation: {
                    type: "string",
                    enum: ["entity", "relation", "query", "analytics"]
                  },
                  subfunction: {
                    type: "string"
                  },
                  params: {
                    type: "object"
                  },
                  storeAs: {
                    type: "string",
                    description: "Variable name to store result for later steps"
                  }
                },
                required: ["operation", "subfunction"]
              }
            },
            context: {
              type: "object",
              description: "Context variables from previous workflow steps or external data"
            }
          },
          required: ["operation"]
        }
      }
    ]
  };
});

// Unified tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  if (name === "knowledge_graph") {
    const handler = new UnifiedToolHandler(storageManager, unifiedIndex!, mcpIndex);

    const result = await handler.execute({
      operation: args.operation as any,
      subfunction: args.subfunction as string | undefined,
      params: args.params as any,
      workflow: args.workflow as any,
      context: args.context as any
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  unifiedIndex = await initializeDatacore();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server running on stdio (unified tool architecture)");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
