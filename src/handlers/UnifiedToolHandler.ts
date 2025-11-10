/**
 * Unified Tool Handler
 * Single tool interface supporting all knowledge graph operations + workflows
 * Inspired by thoughtbox pattern: one tool, multiple operations, workflow support
 */

import { Entity, Relation, KnowledgeGraph } from '../types.js';
import { MarkdownStorageManager } from '../storage/MarkdownStorageManager.js';
import { UnifiedIndex } from '../index/UnifiedIndex.js';
import { EntityEnhancer } from '../integration/EntityEnhancer.js';
import { RelationEnhancer } from '../integration/RelationEnhancer.js';
import { GraphAnalytics } from '../analytics/GraphAnalytics.js';
import { BidirectionalEngine } from '../inference/BidirectionalEngine.js';

/**
 * Operation categories
 */
export type OperationType = 'entity' | 'relation' | 'query' | 'analytics' | 'workflow';

/**
 * Subfunctions within each operation category
 */
export type EntitySubfunction = 'create' | 'delete' | 'add_observations' | 'delete_observations';
export type RelationSubfunction = 'create' | 'delete' | 'get_properties';
export type QuerySubfunction = 'read_graph' | 'search' | 'open' | 'vault';
export type AnalyticsSubfunction = 'centrality' | 'paths' | 'predictions' | 'communities' | 'temporal';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  operation: OperationType;
  subfunction: string;
  params: any;
  storeAs?: string; // Store result for later steps
}

/**
 * Unified tool parameters
 */
export interface UnifiedToolParams {
  operation: OperationType;
  subfunction?: string;
  params?: any;
  workflow?: WorkflowStep[]; // For multi-step execution
  context?: { [key: string]: any }; // Stored results from previous steps
}

/**
 * Operation result
 */
export interface OperationResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    operation: string;
    subfunction?: string;
    executionTime?: number;
  };
}

/**
 * Workflow result
 */
export interface WorkflowResult {
  success: boolean;
  steps: Array<{
    step: number;
    operation: string;
    subfunction: string;
    result: OperationResult;
  }>;
  context: { [key: string]: any };
  error?: string;
}

export class UnifiedToolHandler {
  constructor(
    private storageManager: MarkdownStorageManager,
    private unifiedIndex: UnifiedIndex,
    private mcpIndex?: any // Optional: for index updates
  ) {}

  /**
   * Main entry point for unified tool
   */
  async execute(params: UnifiedToolParams): Promise<OperationResult | WorkflowResult> {
    // Workflow mode: execute multiple steps
    if (params.workflow && params.workflow.length > 0) {
      return await this.executeWorkflow(params.workflow, params.context || {});
    }

    // Single operation mode
    if (!params.subfunction) {
      throw new Error(`Subfunction required for operation: ${params.operation}`);
    }

    return await this.executeOperation(
      params.operation,
      params.subfunction,
      params.params || {},
      params.context || {}
    );
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(
    operation: OperationType,
    subfunction: string,
    params: any,
    context: { [key: string]: any }
  ): Promise<OperationResult> {
    const startTime = Date.now();

    try {
      let data: any;

      switch (operation) {
        case 'entity':
          data = await this.handleEntityOperation(subfunction as EntitySubfunction, params, context);
          break;

        case 'relation':
          data = await this.handleRelationOperation(subfunction as RelationSubfunction, params, context);
          break;

        case 'query':
          data = await this.handleQueryOperation(subfunction as QuerySubfunction, params, context);
          break;

        case 'analytics':
          data = await this.handleAnalyticsOperation(subfunction as AnalyticsSubfunction, params, context);
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        success: true,
        data,
        metadata: {
          operation,
          subfunction,
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          operation,
          subfunction,
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Execute workflow (multiple steps)
   */
  private async executeWorkflow(steps: WorkflowStep[], initialContext: { [key: string]: any }): Promise<WorkflowResult> {
    const context = { ...initialContext };
    const results: WorkflowResult['steps'] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Resolve params from context (support variable substitution)
      const resolvedParams = this.resolveParams(step.params, context);

      // Execute step
      const result = await this.executeOperation(
        step.operation,
        step.subfunction,
        resolvedParams,
        context
      );

      // Store result if requested
      if (step.storeAs && result.success) {
        context[step.storeAs] = result.data;
      }

      results.push({
        step: i + 1,
        operation: step.operation,
        subfunction: step.subfunction,
        result
      });

      // Stop on error
      if (!result.success) {
        return {
          success: false,
          steps: results,
          context,
          error: `Workflow failed at step ${i + 1}: ${result.error}`
        };
      }
    }

    return {
      success: true,
      steps: results,
      context
    };
  }

  /**
   * Resolve parameters from context (variable substitution)
   */
  private resolveParams(params: any, context: { [key: string]: any }): any {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    if (Array.isArray(params)) {
      return params.map(p => this.resolveParams(p, context));
    }

    const resolved: any = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$context.')) {
        // Variable substitution: $context.variableName
        const contextKey = value.substring(9); // Remove '$context.'
        resolved[key] = context[contextKey];
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveParams(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Handle entity operations
   */
  private async handleEntityOperation(
    subfunction: EntitySubfunction,
    params: any,
    context: { [key: string]: any }
  ): Promise<any> {
    const enhancer = new EntityEnhancer(this.unifiedIndex);
    const enableAtomic = params.atomicDecomposition ?? true;

    switch (subfunction) {
      case 'create': {
        const entities = params.entities as Entity[];
        const enriched = await enhancer.enhanceMultiple(entities, { enableAtomicDecomposition: enableAtomic });

        const created = await this.storageManager.createEntities(entities);

        // Update index with new entities
        if (this.mcpIndex && 'addEntity' in this.mcpIndex) {
          for (const entity of created) {
            this.mcpIndex.addEntity(entity);
          }
        }

        // Track duplicates
        const duplicates = entities.filter(e => !created.find(c => c.name === e.name));
        const warnings: string[] = [];

        if (duplicates.length > 0) {
          warnings.push(`${duplicates.length} duplicate entities not created: ${duplicates.map(d => d.name).join(', ')}`);
        }

        const allAtomicEntities: Entity[] = [];
        if (enableAtomic) {
          for (const enrichedEntity of enriched) {
            if (enrichedEntity.atomicDecomposition?.atomicEntities.length) {
              const createdAtomic = await this.storageManager.createEntities(
                enrichedEntity.atomicDecomposition.atomicEntities
              );
              allAtomicEntities.push(...createdAtomic);
            }
          }
        }

        return {
          created: created.map(e => ({
            name: e.name,
            entityType: e.entityType,
            observations: e.observations, // Return full observations, not just count
            metadata: e.metadata
          })),
          atomicEntitiesCreated: allAtomicEntities.map(e => ({
            name: e.name,
            entityType: e.entityType,
            parentReferences: e.metadata?.parent_references || [],
            observations: e.observations
          })),
          enriched: enriched.map((e, idx) => {
            const decomp = e.atomicDecomposition;
            return {
              name: e.name,
              extractedMetadata: {
                links: e.extractedMetadata.links,
                tags: e.extractedMetadata.tags,
                suggestedRelations: e.extractedMetadata.suggestedRelations.map(sr => ({
                  to: sr.to,
                  type: sr.relationType,
                  qualification: sr.qualification,
                  confidence: sr.confidence,
                  reason: sr.reason
                }))
              },
              yamlProperties: decomp?.yamlProperties || null,
              atomicCandidates: decomp?.atomicCandidates || [],
              atomicDecompositionApplied: !!decomp,
              debug: enableAtomic ? {
                observationsProvided: entities[idx].observations.length,
                propertiesParsed: decomp ? Object.keys(decomp.yamlProperties).length : 0,
                candidatesFound: decomp?.atomicCandidates.length || 0,
                atomicEntitiesCreated: decomp?.atomicEntities.length || 0
              } : undefined
            };
          }),
          summary: {
            entitiesCreated: created.length,
            entitiesRequested: entities.length,
            duplicatesSkipped: duplicates.length,
            atomicEntitiesCreated: allAtomicEntities.length,
            atomicDecompositionEnabled: enableAtomic,
            note: enableAtomic ?
              `Atomic decomposition: ${allAtomicEntities.length} atomic entities extracted` :
              `Atomic decomposition disabled`
          },
          warnings: warnings.length > 0 ? warnings : undefined
        };
      }

      case 'delete': {
        const entityNames = params.entityNames as string[];
        // Check which entities actually exist
        const existing: string[] = [];
        const notFound: string[] = [];

        for (const name of entityNames) {
          const entity = await this.unifiedIndex.getEntity(name);
          if (entity) {
            existing.push(name);
          } else {
            notFound.push(name);
          }
        }

        await this.storageManager.deleteEntities(entityNames);

        // Update index: remove deleted entities
        if (this.mcpIndex && 'removeEntity' in this.mcpIndex) {
          for (const name of existing) {
            this.mcpIndex.removeEntity(name);
          }
        }

        return {
          deleted: existing,
          notFound: notFound.length > 0 ? notFound : undefined,
          summary: {
            deletedCount: existing.length,
            notFoundCount: notFound.length,
            requestedCount: entityNames.length
          }
        };
      }

      case 'add_observations': {
        const result = await this.storageManager.addObservations(
          params.observations as { entityName: string; contents: string[] }[]
        );

        // Update index with modified entities
        if (this.mcpIndex && 'updateEntity' in this.mcpIndex) {
          for (const obs of result) {
            const entity = await this.unifiedIndex.getEntity(obs.entityName);
            if (entity) {
              this.mcpIndex.updateEntity(entity);
            }
          }
        }

        return result;
      }

      case 'delete_observations':
        // Support both 'observations' (consistent) and 'deletions' (legacy) parameter names
        const deletionData = params.observations || params.deletions;
        if (!deletionData) {
          throw new Error('Parameter "observations" required: array of {entityName, observations}');
        }
        await this.storageManager.deleteObservations(
          deletionData as { entityName: string; observations: string[] }[]
        );
        return { deleted: true };

      default:
        throw new Error(`Unknown entity subfunction: ${subfunction}`);
    }
  }

  /**
   * Handle relation operations
   */
  private async handleRelationOperation(
    subfunction: RelationSubfunction,
    params: any,
    context: { [key: string]: any }
  ): Promise<any> {
    const relationEnhancer = new RelationEnhancer(this.unifiedIndex);
    const bidirectionalEngine = new BidirectionalEngine();

    switch (subfunction) {
      case 'create': {
        const relations = params.relations as Relation[];
        const enableBidirectional = params.bidirectional ?? true;

        // Normalize
        const normalized = await relationEnhancer.normalizeAndValidateMultiple(relations);

        // Create pairs
        let toCreate = normalized.map(r => r.normalized);
        const originalCount = toCreate.length;

        // Track which relations are forward vs inverse
        const relationDirections: string[] = [];

        if (enableBidirectional) {
          const pairs = bidirectionalEngine.createMultiplePairs(toCreate);
          // Mark directions: first half are forward (original), second half are inverse
          for (let i = 0; i < pairs.length; i++) {
            relationDirections.push(i < originalCount ? 'forward' : 'inverse');
          }
          toCreate = pairs;
        } else {
          relationDirections.push(...toCreate.map(() => 'forward'));
        }

        const result = await this.storageManager.createRelations(toCreate);

        // Update index with new relations
        if (this.mcpIndex && 'addRelation' in this.mcpIndex) {
          for (const relation of result.created) {
            this.mcpIndex.addRelation(relation);
          }
        }

        // Count actual forward vs inverse created
        let forwardCount = 0;
        let inverseCount = 0;
        for (let i = 0; i < result.created.length && i < relationDirections.length; i++) {
          if (relationDirections[i] === 'forward') forwardCount++;
          else inverseCount++;
        }

        return {
          created: result.created.map((r, idx) => ({
            from: r.from,
            to: r.to,
            relationType: r.relationType,
            qualification: r.qualification,
            direction: idx < relationDirections.length ? relationDirections[idx] : 'unknown'
          })),
          summary: {
            totalCreated: result.created.length,
            forwardRelations: forwardCount,
            inverseRelations: inverseCount,
            bidirectionalEnabled: enableBidirectional,
            note: enableBidirectional ?
              `Bidirectional mode: ${forwardCount} forward + ${inverseCount} inverse relations created` :
              `Single direction: ${result.created.length} relations created`
          },
          normalization: normalized.map(n => ({
            original: { type: n.original.relationType, qual: n.original.qualification },
            normalized: { type: n.normalized.relationType, qual: n.normalized.qualification },
            changed: n.original.relationType !== n.normalized.relationType ||
                    n.original.qualification !== n.normalized.qualification,
            suggestions: n.suggestions
          }))
        };
      }

      case 'delete':
        await this.storageManager.deleteRelations(params.relations as Relation[]);
        return { deleted: true };

      case 'get_properties': {
        const [types, quals] = await Promise.all([
          this.storageManager.getExistingRelationTypes(),
          this.storageManager.getExistingQualifications()
        ]);

        const graph = await this.storageManager.readGraph();
        const typeFreq = new Map<string, number>();
        const qualFreq = new Map<string, number>();

        for (const rel of graph.relations) {
          typeFreq.set(rel.relationType, (typeFreq.get(rel.relationType) || 0) + 1);
          qualFreq.set(rel.qualification, (qualFreq.get(rel.qualification) || 0) + 1);
        }

        return {
          relationTypes: {
            all: types,
            statistics: Array.from(typeFreq.entries())
              .map(([type, count]) => ({ type, count }))
              .sort((a, b) => b.count - a.count)
          },
          qualifications: {
            all: quals,
            statistics: Array.from(qualFreq.entries())
              .map(([qual, count]) => ({ qualification: qual, count }))
              .sort((a, b) => b.count - a.count)
          },
          totalRelations: graph.relations.length
        };
      }

      default:
        throw new Error(`Unknown relation subfunction: ${subfunction}`);
    }
  }

  /**
   * Handle query operations
   */
  private async handleQueryOperation(
    subfunction: QuerySubfunction,
    params: any,
    context: { [key: string]: any }
  ): Promise<any> {
    const includeContent = params.includeContent ?? true; // Default: include content

    switch (subfunction) {
      case 'read_graph': {
        const graph = await this.storageManager.readGraph();
        if (!includeContent) {
          // Strip observations if not requested
          graph.entities = graph.entities.map(e => ({ ...e, observations: [] }));
        }
        return graph;
      }

      case 'search': {
        const graph = await this.storageManager.searchNodes(params.query as string);
        if (!includeContent) {
          graph.entities = graph.entities.map(e => ({ ...e, observations: [] }));
        }
        return graph;
      }

      case 'open': {
        const graph = await this.storageManager.openNodes(params.names as string[]);
        if (!includeContent) {
          graph.entities = graph.entities.map(e => ({ ...e, observations: [] }));
        }
        return graph;
      }

      case 'vault': {
        if (!this.unifiedIndex) {
          throw new Error('Unified index not initialized');
        }

        const query = params.query as string;
        const includeContent = params.includeContent ?? false;
        const linkToMCP = params.linkToMCP ?? true;
        const limit = params.limit ?? 50;

        const results = await this.unifiedIndex.search(query);

        const response: any = {
          results: results.slice(0, limit).map(entity => ({
            name: entity.name,
            entityType: entity.entityType,
            observations: includeContent ? entity.observations : undefined
          })),
          totalResults: results.length
        };

        if (linkToMCP && results.length > 0) {
          const mcpGraph = await this.storageManager.readGraph();
          const suggestions: any[] = [];

          for (const vaultEntity of results.slice(0, 10)) {
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

        return response;
      }

      default:
        throw new Error(`Unknown query subfunction: ${subfunction}`);
    }
  }

  /**
   * Handle analytics operations
   */
  private async handleAnalyticsOperation(
    subfunction: AnalyticsSubfunction,
    params: any,
    context: { [key: string]: any }
  ): Promise<any> {
    const graph = await this.storageManager.readGraph();
    const analytics = new GraphAnalytics();

    switch (subfunction) {
      case 'centrality': {
        const report = analytics.computeCentrality(graph.entities, graph.relations);
        return {
          topEntities: report.topEntities,
          totalEntities: graph.entities.length,
          avgDegree: Array.from(report.metrics.values())
            .reduce((sum, m) => sum + m.totalDegree, 0) / graph.entities.length
        };
      }

      case 'paths': {
        if (!params.entityName || !params.targetEntity) {
          throw new Error('entityName and targetEntity required for path analysis');
        }

        const maxHops = params.maxHops || 5;
        const path = analytics.findPath(
          params.entityName as string,
          params.targetEntity as string,
          graph.relations,
          maxHops
        );

        return {
          path: path ? {
            entities: path.entities,
            length: path.length,
            relations: path.relations.map(r => `${r.relationType}.${r.qualification}`)
          } : null,
          found: path !== null
        };
      }

      case 'predictions': {
        if (!params.entityName) {
          throw new Error('entityName required for link prediction');
        }

        const topK = params.topK || 10;
        const predictions = analytics.predictLinks(
          params.entityName as string,
          graph.entities,
          graph.relations,
          topK
        );

        return {
          predictions,
          totalPredictions: predictions.length
        };
      }

      case 'communities':
        // TODO: Implement community detection
        throw new Error('Community detection not yet implemented');

      case 'temporal':
        // TODO: Implement temporal analysis
        throw new Error('Temporal analysis not yet implemented');

      default:
        throw new Error(`Unknown analytics subfunction: ${subfunction}`);
    }
  }
}
