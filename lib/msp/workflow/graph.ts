import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isMockModeEnabled } from "@/lib/env";
import {
  completeResearchRun,
  createResearchRun,
  failResearchRun,
} from "@/lib/msp/repository";
import { normalizeSearchFilters } from "@/lib/msp/schemas";
import { SearchFiltersInput, SearchPipelineState, SearchRunResult } from "@/lib/msp/types";
import {
  candidateExtractionNode,
  confidenceScoringNode,
  entityResolutionNode,
  exportReadyNode,
  intakeNode,
  persistenceNode,
  searchPlanNode,
  seedResearchNode,
  verificationNode,
  webResearchNode,
} from "@/lib/msp/workflow/nodes";

const replaceReducer = <T>(_: T, value: T) => value;

const SearchStateAnnotation = Annotation.Root({
  runId: Annotation<string>({
    reducer: replaceReducer,
    default: () => "",
  }),
  userId: Annotation<string | null>({
    reducer: replaceReducer,
    default: () => null,
  }),
  mockMode: Annotation<boolean>({
    reducer: replaceReducer,
    default: () => false,
  }),
  filters: Annotation<SearchPipelineState["filters"]>({
    reducer: replaceReducer,
    default: () => normalizeSearchFilters({}),
  }),
  searchQueries: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  researchPayloads: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  extractedCandidates: Annotation<SearchPipelineState["extractedCandidates"]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  dedupedCandidates: Annotation<SearchPipelineState["dedupedCandidates"]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  evaluatedCandidates: Annotation<SearchPipelineState["evaluatedCandidates"]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  persistedCompanyIds: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
});

type SearchGraph = {
  invoke: (state: SearchPipelineState) => Promise<unknown>;
};

let compiledGraph: SearchGraph | null = null;

function getCompiledSearchGraph() {
  if (!compiledGraph) {
    const graph = new StateGraph(SearchStateAnnotation)
      .addNode("intake_node", intakeNode)
      .addNode("search_plan_node", searchPlanNode)
      .addNode("web_research_node", webResearchNode)
      .addNode("seed_research_node", seedResearchNode)
      .addNode("candidate_extraction_node", candidateExtractionNode)
      .addNode("entity_resolution_node", entityResolutionNode)
      .addNode("verification_node", verificationNode)
      .addNode("confidence_scoring_node", confidenceScoringNode)
      .addNode("persistence_node", persistenceNode)
      .addNode("export_ready_node", exportReadyNode)
      .addEdge(START, "intake_node")
      .addEdge("intake_node", "search_plan_node")
      .addEdge("search_plan_node", "web_research_node")
      .addEdge("web_research_node", "seed_research_node")
      .addEdge("seed_research_node", "candidate_extraction_node")
      .addEdge("candidate_extraction_node", "entity_resolution_node")
      .addEdge("entity_resolution_node", "verification_node")
      .addEdge("verification_node", "confidence_scoring_node")
      .addEdge("confidence_scoring_node", "persistence_node")
      .addEdge("persistence_node", "export_ready_node")
      .addEdge("export_ready_node", END);

    compiledGraph = graph.compile();
  }

  return compiledGraph;
}

function buildInitialState(params: {
  runId: string;
  userId: string | null;
  filters: SearchFiltersInput;
  mockMode?: boolean;
}): SearchPipelineState {
  return {
    runId: params.runId,
    userId: params.userId,
    mockMode: params.mockMode ?? isMockModeEnabled(),
    filters: normalizeSearchFilters(params.filters),
    searchQueries: [],
    researchPayloads: [],
    extractedCandidates: [],
    dedupedCandidates: [],
    evaluatedCandidates: [],
    persistedCompanyIds: [],
    errors: [],
  };
}

export async function runSearchWorkflow(params: {
  userId?: string | null;
  filters: SearchFiltersInput;
}): Promise<SearchRunResult> {
  const normalizedFilters = normalizeSearchFilters(params.filters);
  console.log("[workflow] starting search | states:", JSON.stringify(normalizedFilters.states), "| mockMode:", isMockModeEnabled());
  const mockMode = isMockModeEnabled();
  const runId = await createResearchRun({
    userId: params.userId ?? null,
    filters: normalizedFilters,
    mockMode,
  });

  try {
    const graph = getCompiledSearchGraph();
    const finalState = (await graph.invoke(
      buildInitialState({
        runId,
        userId: params.userId ?? null,
        filters: normalizedFilters,
        mockMode,
      }),
    )) as SearchPipelineState;

    const verifiedCount = finalState.evaluatedCandidates.filter(
      (candidate) => candidate.verificationStatus === "verified",
    ).length;
    const needsReviewCount = finalState.evaluatedCandidates.filter(
      (candidate) => candidate.verificationStatus === "needs_review",
    ).length;
    const rejectedCount = finalState.evaluatedCandidates.filter(
      (candidate) => candidate.verificationStatus === "rejected",
    ).length;

    await completeResearchRun({
      runId,
      totalCandidates: finalState.evaluatedCandidates.length,
      totalVerified: verifiedCount,
      totalNeedsReview: needsReviewCount,
      totalRejected: rejectedCount,
    });

    return {
      runId,
      persistedCount: finalState.persistedCompanyIds.length,
      verifiedCount,
      needsReviewCount,
      rejectedCount,
    };
  } catch (error) {
    await failResearchRun(
      runId,
      error instanceof Error ? error.message : "Unknown workflow error",
    );
    throw error;
  }
}
