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
import { EntityEnhancer } from './integration/EntityEnhancer.js';
import { RelationEnhancer } from './integration/RelationEnhancer.js';
import { GraphAnalytics } from './analytics/GraphAnalytics.js';

// Create Markdown storage manager
const storageManager = new MarkdownStorageManager();

// Initialize datacore integration
let unifiedIndex: UnifiedIndex | null = null;

async function initializeDatacore(): Promise<UnifiedIndex> {
  console.error('Initializing datacore integration...');

  // 1. Initialize MCP memory indexer
  const memoryPath = getMemoryDir();
  const mcpIndex = await MCPMemoryIndexer.create(memoryPath);
  console.error('✓ MCP memory indexer ready');

  // 2. Discover external vaults
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

  // 3. Create unified index
  const unified = new UnifiedIndex(mcpIndex, vaultIndex);
  console.error('✓ Datacore integration ready');

  return unified;
}


// The server instance and tools exposed to Claude
const server = new Server({
  name: "memory-server",
  version: "0.6.3",
},    {
    capabilities: {
      tools: {},
    },
  },);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                },
                required: ["name", "entityType", "observations"],
              },
            },
          },
          required: ["entities"],
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  contents: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
              },
            },
          },
          required: ["observations"],
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities and their associated relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: { 
              type: "array", 
              items: { type: "string" },
              description: "An array of entity names to delete" 
            },
          },
          required: ["entityNames"],
        },
      },
      {
        name: "delete_observations",
        description: "Delete specific observations from entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
              },
            },
          },
          required: ["deletions"],
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            relations: { 
              type: "array", 
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
              },
              description: "An array of relations to delete" 
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "read_graph",
        description: "Read the entire knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
          },
          required: ["query"],
        },
      },
      {
        name: "open_nodes",
        description: "Open specific nodes in the knowledge graph by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
          },
          required: ["names"],
        },
      },
      {
        name: "get_relation_properties",
        description: "Get all existing relation types and qualifications from the knowledge graph. Use this to check what properties already exist before creating new relations.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "analyze_graph",
        description: "Run graph analytics and return insights about the knowledge graph structure",
        inputSchema: {
          type: "object",
          properties: {
            analysisType: {
              type: "string",
              enum: ["centrality", "communities", "paths", "temporal", "predictions"],
              description: "Type of analysis to perform"
            },
            entityName: {
              type: "string",
              description: "Entity name (required for path/prediction analysis)"
            },
            targetEntity: {
              type: "string",
              description: "Target entity (required for path analysis)"
            },
            options: {
              type: "object",
              description: "Analysis-specific options (maxHops, topK, etc.)"
            }
          },
          required: ["analysisType"]
        }
      },
      {
        name: "query_vault",
        description: "Query external Obsidian vault using search. Returns entities from the vault that match the query.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query to match against vault entity names and types"
            },
            includeContent: {
              type: "boolean",
              description: "Include observations in results (default: false)"
            },
            linkToMCP: {
              type: "boolean",
              description: "Suggest connections to MCP entities (default: true)"
            },
            limit: {
              type: "number",
              description: "Max results to return (default: 50)"
            }
          },
          required: ["query"]
        }
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_entities": {
      const enhancer = new EntityEnhancer(unifiedIndex!);
      const enrichedEntities = await enhancer.enhanceMultiple(args.entities as Entity[]);

      const created = await storageManager.createEntities(args.entities as Entity[]);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            created,
            enriched: enrichedEntities.map(e => ({
              name: e.name,
              extractedMetadata: e.extractedMetadata
            }))
          }, null, 2)
        }]
      };
    }
    case "create_relations": {
      const relationEnhancer = new RelationEnhancer(unifiedIndex!);
      const normalizedRelations = await relationEnhancer.normalizeAndValidateMultiple(args.relations as Relation[]);

      const relationsToCreate = normalizedRelations.map(r => r.normalized);
      const result = await storageManager.createRelations(relationsToCreate);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ...result,
            normalization: normalizedRelations.map(r => ({
              original: r.original,
              normalized: r.normalized,
              suggestions: r.suggestions
            }))
          }, null, 2)
        }]
      };
    }
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await storageManager.addObservations(args.observations as { entityName: string; contents: string[] }[]), null, 2) }] };
    case "delete_entities":
      await storageManager.deleteEntities(args.entityNames as string[]);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    case "delete_observations":
      await storageManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    case "delete_relations":
      await storageManager.deleteRelations(args.relations as Relation[]);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    case "read_graph":
      return { content: [{ type: "text", text: JSON.stringify(await storageManager.readGraph(), null, 2) }] };
    case "search_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await storageManager.searchNodes(args.query as string), null, 2) }] };
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await storageManager.openNodes(args.names as string[]), null, 2) }] };
    case "get_relation_properties": {
      const [mcpTypes, mcpQuals] = await Promise.all([
        storageManager.getExistingRelationTypes(),
        storageManager.getExistingQualifications(),
      ]);

      // TODO: Get vault properties when vault index available
      let vaultTypes: string[] = [];
      let vaultQuals: string[] = [];

      const allTypes = [...new Set([...mcpTypes, ...vaultTypes])];
      const allQuals = [...new Set([...mcpQuals, ...vaultQuals])];

      // Compute frequency statistics
      const typeFreq = new Map<string, number>();
      const qualFreq = new Map<string, number>();

      const graph = await storageManager.readGraph();
      for (const relation of graph.relations) {
        typeFreq.set(relation.relationType, (typeFreq.get(relation.relationType) || 0) + 1);
        qualFreq.set(relation.qualification, (qualFreq.get(relation.qualification) || 0) + 1);
      }

      const typeStats = Array.from(typeFreq.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      const qualStats = Array.from(qualFreq.entries())
        .map(([qual, count]) => ({ qualification: qual, count }))
        .sort((a, b) => b.count - a.count);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            relationTypes: {
              all: allTypes,
              mcp: mcpTypes,
              vault: vaultTypes,
              statistics: typeStats
            },
            qualifications: {
              all: allQuals,
              mcp: mcpQuals,
              vault: vaultQuals,
              statistics: qualStats
            },
            message: "Use these existing properties when creating new relations to maintain consistency.",
            totalRelations: graph.relations.length
          }, null, 2)
        }]
      };
    }
    case "analyze_graph": {
      const analysisType = args.analysisType as string;
      const graph = await storageManager.readGraph();
      const analytics = new GraphAnalytics();

      switch (analysisType) {
        case "centrality": {
          const report = analytics.computeCentrality(graph.entities, graph.relations);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                topEntities: report.topEntities,
                totalEntities: graph.entities.length,
                avgDegree: Array.from(report.metrics.values())
                  .reduce((sum, m) => sum + m.totalDegree, 0) / graph.entities.length
              }, null, 2)
            }]
          };
        }

        case "paths": {
          if (!args.entityName || !args.targetEntity) {
            throw new Error("entityName and targetEntity required for path analysis");
          }

          const maxHops = (args.options as any)?.maxHops || 5;
          const path = analytics.findPath(
            args.entityName as string,
            args.targetEntity as string,
            graph.relations,
            maxHops
          );

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                path: path ? {
                  entities: path.entities,
                  length: path.length,
                  relations: path.relations.map(r => `${r.relationType}.${r.qualification}`)
                } : null,
                found: path !== null
              }, null, 2)
            }]
          };
        }

        case "predictions": {
          if (!args.entityName) {
            throw new Error("entityName required for link prediction");
          }

          const topK = (args.options as any)?.topK || 10;
          const predictions = analytics.predictLinks(
            args.entityName as string,
            graph.entities,
            graph.relations,
            topK
          );

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                predictions,
                totalPredictions: predictions.length
              }, null, 2)
            }]
          };
        }

        default:
          throw new Error(`Unsupported analysis type: ${analysisType}`);
      }
    }
    case "query_vault": {
      if (!unifiedIndex) {
        throw new Error("Unified index not initialized");
      }

      const query = args.query as string;
      const includeContent = (args.includeContent as boolean) ?? false;
      const linkToMCP = (args.linkToMCP as boolean) ?? true;
      const limit = (args.limit as number) ?? 50;

      // Search vault index
      const results = await unifiedIndex.search(query);

      const response: any = {
        results: results.slice(0, limit).map(entity => ({
          name: entity.name,
          entityType: entity.entityType,
          observations: includeContent ? entity.observations : undefined
        })),
        totalResults: results.length,
        vault: true
      };

      if (linkToMCP && results.length > 0) {
        // Suggest links to MCP entities
        const mcpGraph = await storageManager.readGraph();
        const suggestions: any[] = [];

        for (const vaultEntity of results.slice(0, 10)) {
          // Find similar MCP entities
          const similar = mcpGraph.entities.filter(mcpEntity =>
            mcpEntity.name.toLowerCase().includes(vaultEntity.name.toLowerCase()) ||
            vaultEntity.name.toLowerCase().includes(mcpEntity.name.toLowerCase())
          );

          if (similar.length > 0) {
            suggestions.push({
              vaultEntity: vaultEntity.name,
              mcpMatches: similar.map(e => e.name)
            });
          }
        }

        response.suggestedLinks = suggestions;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
        }]
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  // Initialize datacore integration
  unifiedIndex = await initializeDatacore();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server running on stdio (storage: markdown)");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});