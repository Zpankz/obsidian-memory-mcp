# Obsidian Memory MCP

Advanced MCP server that creates an intelligent, atomic knowledge graph with automatic structuring, semantic understanding, and bidirectional relations - stored as Obsidian-compatible Markdown files.

<a href="https://glama.ai/mcp/servers/@YuNaga224/obsidian-memory-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@YuNaga224/obsidian-memory-mcp/badge" alt="Obsidian Memory MCP server" />
</a>

## Features

### 🧠 **Atomic Zettelkasten Architecture**
- **Automatic YAML Structuring**: Converts text observations into queryable structured properties
- **Fractal Decomposition**: Complex entities automatically split into atomic components
- **Peripheral Concept Extraction**: Wikilinks in observations become separate atomic entities
- **Zettelkasten Principles**: Core entity with essential properties, peripheral concepts as linked atomic notes

### 🔄 **Intelligent Relation Management**
- **Bidirectional Auto-Generation**: Create `A influences.increases B` → automatically generates `B influenced_by.increased_by A`
- **Semantic Normalization**: Uses embeddings to find similar relations (e.g., "blocks.completely" matches "inhibits.competitive" at 92%)
- **Property Standardization**: Synonym mapping and similarity matching prevent proliferation
- **Dendron Link Ontology**: Relations stored as `relationType.qualification: ['[[target]]']` in YAML frontmatter

### 📊 **Graph Analytics**
- **ArticleRank Centrality**: Identify influential entities in knowledge graph
- **Path Finding**: Discover connection chains between entities
- **Link Prediction**: Suggest missing relations based on graph structure
- **Metadata Extraction**: Automatic extraction of wikilinks, tags, and structured properties

### 🔗 **Hybrid Indexing**
- **Dual Index System**: MCP memory + external Obsidian vault
- **Vault Integration**: Auto-detects and indexes existing Obsidian vaults
- **Cross-Vault Search**: Query across both MCP-created and vault entities
- **Unified Navigation**: Seamless access to knowledge across sources

## Quick Start

### Installation

```bash
git clone https://github.com/Zpankz/obsidian-memory-mcp.git
cd obsidian-memory-mcp
npm install
npm run build
```

### Configuration

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "obsidian-memory": {
      "command": "node",
      "args": ["/full/path/to/obsidian-memory-mcp/dist/index.js"],
      "env": {
        "MEMORY_DIR": "/path/to/your/obsidian/vault/memory"
      }
    }
  }
}
```

**Note:** The server will auto-detect external Obsidian vaults in common locations (~/Documents/Obsidian, iCloud, etc.)

### Restart Claude Desktop

After configuration, restart Claude Desktop to load the MCP server.

## Usage Examples

### Creating Structured Atomic Entities

```typescript
// Simple text observations...
create_entities({
  entities: [{
    name: "NMDAR",
    entityType: "protein",
    observations: [
      "Tetrameric structure composed of GluN1 and GluN2 subunits",
      "Requires glutamate and glycine for activation",
      "Conductance: 50 pS",
      "Critical for long-term potentiation"
    ]
  }]
})

// ...automatically become structured YAML and atomic entities!
```

**What happens automatically:**

1. **YAML Structuring**: Observations parsed into structured properties
2. **Atomic Extraction**: Peripheral concepts (GluN1, GluN2, glutamate, glycine, LTP) become separate entities
3. **File Creation**: 6 markdown files created (1 core + 5 atomic)
4. **Type Inference**: Each atomic entity assigned appropriate type (protein_component, molecule, process)

**Result - NMDAR.md:**
```yaml
---
entityType: protein
structure:
  components:
    - GluN1
    - GluN2 subunits
activation:
  required_ligands:
    - glutamate
    - glycine
biophysics:
  conductance:
    value: 50
    unit: pS
---

# NMDAR

*Essential structured properties in YAML above. Peripheral concepts as wikilink atomic entities.*
```

**Atomic entities created:**
- `GluN1.md`, `GluN2 subunits.md` (protein components)
- `glutamate.md`, `glycine.md` (ligands)
- `long-term potentiation.md` (process)

### Bidirectional Relations

```typescript
// Create one direction...
create_relations({
  relations: [{
    from: "dopamine",
    to: "reward_processing",
    relationType: "influences",
    qualification: "increases"
  }]
})

// ...get both directions automatically!
```

**Result:**
```yaml
# dopamine.md
---
influences.increases:
  - '[[reward_processing]]'
---

# reward_processing.md
---
influenced_by.increased_by:
  - '[[dopamine]]'
---
```

**18 bidirectional rules** covering influences, modulates, inhibits, binds, regulates, is_a, part_of, requires, and more.

### Graph Analytics

```typescript
// Analyze network structure
analyze_graph({
  analysis_type: "centrality"
})
// Returns: Top entities by ArticleRank, average degree, clustering metrics

// Find connection paths
analyze_graph({
  analysis_type: "paths",
  entityName: "dopamine",
  targetEntity: "learning"
})
// Returns: Shortest path with intermediate entities and relation types

// Predict missing links
analyze_graph({
  analysis_type: "predictions",
  entityName: "NMDAR",
  options: { topK: 10 }
})
// Returns: Top 10 predicted connections based on graph structure
```

### External Vault Queries

```typescript
// Search your existing Obsidian vault
query_vault({
  query: "neuroscience",
  linkToMCP: true
})
// Returns: Vault entities matching query + suggestions for linking to MCP entities
```

## Storage Format

### Core Entity (Structured YAML)

```yaml
---
entityType: protein
structure:
  quaternary: tetrameric
  subunits:
    - name: '[[GluN1]]'
      count: 2
    - name: '[[GluN2]]'
      count: 2
activation:
  required_ligands:
    - '[[glutamate]]'
    - '[[glycine]]'
biophysics:
  conductance:
    value: 50
    unit: pS
  block:
    agent: '[[magnesium]]'
    voltage: -70
    unit: mV
modulates.agonism:
  - '[[long-term potentiation]]'
conducts.permeates:
  - '[[calcium]]'
---

# NMDAR

Essential structured properties in YAML above.
```

### Atomic Entity

```yaml
---
entityType: protein_component
atomic: true
parent_references:
  - NMDAR
structure:
  domains:
    c_terminal:
      length: long
      binding_partners:
        - '[[PSD95]]'
        - '[[CaMKII]]'
---

# GluN2B subunit

Specific subunit properties. Part of [[NMDAR]].
```

## MCP Tools

### Entity Operations
- **`create_entities`**: Create entities with automatic YAML structuring and atomic decomposition
- **`delete_entities`**: Remove entities and their files
- **`add_observations`**: Add observations to existing entities
- **`delete_observations`**: Remove specific observations

### Relation Operations
- **`create_relations`**: Create relations with automatic bidirectional pair generation and normalization
- **`delete_relations`**: Remove relations
- **`get_relation_properties`**: Get all relation types and qualifications with usage statistics

### Query Operations
- **`read_graph`**: Retrieve entire knowledge graph
- **`search_nodes`**: Search entities by query across MCP and vault
- **`open_nodes`**: Get specific entities by name
- **`query_vault`**: Search external Obsidian vault with MCP link suggestions

### Analytics Operations
- **`analyze_graph`**: Run graph analytics
  - `centrality`: ArticleRank centrality analysis
  - `paths`: Find shortest path between entities
  - `predictions`: Predict missing links based on graph structure

## Architecture

### Atomic Decomposition Pipeline

```
User creates entity with observations
    ↓
YAML Parser: text → structured properties
    ↓
Atomic Extractor: wikilinks → atomic entities
    ↓
EntityEnhancer: orchestrates decomposition
    ↓
create_entities: creates core + atomic files
    ↓
generateMarkdown: YAML frontmatter + Dendron relations
    ↓
Result: Fractal Zettelkasten structure
```

### Dual Indexing System

```
┌─────────────────────────────────────────┐
│         Unified Query Engine            │
│  (merges results, resolves cross-links) │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┐
      ↓             ↓
┌──────────┐  ┌─────────────┐
│   MCP    │  │   External  │
│  Memory  │  │   Obsidian  │
│  Index   │  │    Vault    │
└──────────┘  └─────────────┘
```

### Components

- **`src/structuring/`**: YAML parsing and atomic entity extraction
- **`src/inference/`**: Bidirectional relation generation
- **`src/semantic/`**: Semantic embeddings for intelligent matching
- **`src/analytics/`**: ArticleRank, path finding, link prediction
- **`src/index/`**: Dual indexing (MCP memory + vault scanner)
- **`src/integration/`**: Entity and relation enhancement
- **`src/extraction/`**: Metadata extraction (wikilinks, tags)
- **`src/utils/`**: Normalization, markdown generation, path utilities

## Advanced Features

### Semantic Relation Matching

Uses sentence transformers (@xenova/transformers) to find semantically similar relations:

```
User creates: "blocks.completely"
System suggests: "Use existing 'inhibits.competitive' (92% semantically similar)"
```

Prevents property proliferation by understanding meaning, not just strings.

### Property Normalization

- **Synonym mapping**: "affects" → "influences", "controls" → "regulates"
- **Similarity matching**: Levenshtein distance with 85% threshold
- **Semantic embeddings**: Meaning-based matching for intelligent deduplication

### Graph Analytics Metrics

- **ArticleRank**: Improved PageRank variant for knowledge graphs
- **Degree Centrality**: Incoming/outgoing connection counts
- **Common Neighbor**: Link prediction algorithm
- **Path Finding**: BFS shortest path algorithm

## Configuration

### Environment Variables

- `MEMORY_DIR`: Directory for storing memory markdown files (default: `./memory`)

### Optional Features

Atomic decomposition can be disabled per request:

```typescript
create_entities({
  entities: [...],
  atomicDecomposition: false  // Disable if you want monolithic entities
})
```

Bidirectional relations can be disabled:

```typescript
create_relations({
  relations: [...],
  bidirectional: false  // Create only forward relations
})
```

## Development

### Build

```bash
npm run build     # Compile TypeScript
npm run watch     # Watch mode for development
```

### Testing

```bash
npm test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Current test status:** 51 passing tests across 16 test suites

### Project Structure

```
obsidian-memory-mcp/
├── src/
│   ├── analytics/          # Graph analytics engine
│   ├── config/            # Vault discovery
│   ├── extraction/        # Metadata extraction
│   ├── index/             # Dual indexing system
│   ├── inference/         # Bidirectional relations
│   ├── integration/       # Entity/relation enhancement
│   ├── semantic/          # Semantic embeddings
│   ├── storage/           # Markdown storage manager
│   ├── structuring/       # YAML parsing, atomic extraction
│   ├── utils/             # Utilities
│   └── index.ts           # Main MCP server
├── docs/
│   └── plans/             # Design documents and implementation plans
├── test-fixtures/         # Test data
└── dist/                  # Compiled JavaScript
```

## Roadmap

### ✅ Completed
- Dendron link ontology format (relationType.qualification)
- YAML observation structuring
- Atomic entity decomposition
- Bidirectional relation generation
- Semantic relation embeddings (infrastructure)
- Graph analytics (ArticleRank, paths, predictions)
- Dual indexing (MCP + external vault)
- Property normalization and standardization

### 🚧 In Progress
- Semantic weight calculation for relation pruning
- Small-world network optimization
- Entity resolution (duplicate detection across vaults)

### 📋 Planned
- Temporal knowledge versioning
- Self-organizing property taxonomy
- Tool consolidation (MCP optimization)
- Session-based state management
- Dynamic resource templates
- Workflow prompts

See [docs/plans/](docs/plans/) for detailed implementation plans.

## How It Works

### Atomic Zettelkasten in Action

**You create:**
```
"NMDAR is a tetrameric protein requiring glutamate"
```

**System creates:**
1. `NMDAR.md` - Core entity with structured YAML
2. `glutamate.md` - Atomic ligand entity
3. Relation: `NMDAR requires.co_agonist → glutamate`
4. Inverse: `glutamate required_by.co_agonist_for → NMDAR`

**Result:** Fractal knowledge structure with bidirectional navigation!

### Semantic Intelligence

**Old approach (string matching):**
```
"affects" → "influences" (hardcoded synonym)
"blocks" → miss "inhibits" (not in dictionary)
```

**New approach (semantic understanding):**
```
"blocks.completely" → finds "inhibits.competitive" (92% semantic similarity)
"enhances.strongly" → finds "potentiates.allosteric" (88% semantic similarity)
```

Learns from your vault's existing knowledge to guide consistency.

### Small-World Properties

Optimizes graph topology for:
- **High clustering** (0.4-0.6): Dense local neighborhoods
- **Low path length** (3-5 hops): Everything reachable
- **Moderate degree** (5-15): No bloated hub entities
- **Small-worldness > 3**: Significantly better than random graphs

## Credits & Attribution

### Based On
This project is based on [Anthropic's memory server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) from the Model Context Protocol servers collection.

### Key Modifications
- **Storage**: JSON → Individual Markdown files
- **Format**: Dendron link ontology in YAML frontmatter
- **Architecture**: Atomic Zettelkasten structure
- **Intelligence**: Semantic embeddings, bidirectional relations, graph analytics
- **Indexing**: Dual index (MCP + external vault)
- **Structuring**: Automatic YAML parsing and atomic decomposition

### Dependencies
- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **gray-matter**: YAML frontmatter parsing
- **@xenova/transformers**: Semantic embeddings (local, no API calls)
- **luxon**: Temporal analysis and date handling

### Contributors
- Original memory server: Anthropic, PBC
- Obsidian integration: YuNaga224
- Atomic architecture & intelligence: Enhanced by community contributions

## License

MIT License - see [LICENSE](LICENSE) file for details.

Original memory server: Copyright (c) 2024 Anthropic, PBC
Obsidian integration modifications: Copyright (c) 2025 YuNaga224

## Related Projects

- [Datacore](https://github.com/blacksmithgu/datacore) - Reactive data engine for Obsidian
- [Dendron](https://www.dendron.so/) - Note-taking tool with link ontology
- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol for LLM-application integration

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/YuNaga224/obsidian-memory-mcp/issues
- Fork and contribute: https://github.com/Zpankz/obsidian-memory-mcp

---

**Transform your knowledge into an intelligent, self-organizing graph! 🚀**
