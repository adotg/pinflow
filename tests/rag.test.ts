import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * # Building an Intelligent RAG System with Query Classification
 *
 * > **[View example code](../../tests/rag.test.ts)**
 *
 * ## What Will Be Built
 *
 * A Retrieval-Augmented Generation (RAG) system that intelligently routes queries
 * based on their type. Documents will be indexed offline, and incoming queries will
 * be classified to determine the optimal answering strategy:
 * - **Factual queries** → Full RAG pipeline with document retrieval
 * - **Conversational queries** → Direct LLM response (no retrieval)
 * - **Unknown queries** → Clarification request
 *
 * This demonstrates conditional routing using named edges to optimize performance
 * by avoiding unnecessary retrieval operations.
 *
 * Input:  "What is the capital of France?" → RAG with retrieval
 * Input:  "Hello, how are you?" → Direct answer
 * Input:  "xyzabc nonsense" → Clarification
 *
 * ## Workflow Diagram
 *
 * ```mermaid
 * graph TB
 *     subgraph Indexing["Offline Indexing (Run Once)"]
 *         ChunkNode["ChunkNode
 *         Split documents into chunks"]
 *         EmbedNode["EmbedNode
 *         Convert chunks to embeddings"]
 *         ChunkNode --> EmbedNode
 *     end
 *
 *     subgraph Query["Query Processing (Runtime)"]
 *         ClassifyNode["QueryClassificationNode
 *         Analyze query type"]
 *
 *         QueryEmbedNode["QueryEmbedNode
 *         Embed factual query"]
 *         RetrieveNode["RetrieveNode
 *         Search indexed chunks"]
 *         RAGAnswerNode["RAGAnswerNode
 *         Generate answer with context"]
 *
 *         DirectAnswerNode["DirectAnswerNode
 *         Generate answer directly"]
 *
 *         ClarificationNode["ClarificationNode
 *         Request clarification"]
 *
 *         ClassifyNode -->|"'factual'"| QueryEmbedNode
 *         QueryEmbedNode --> RetrieveNode
 *         RetrieveNode --> RAGAnswerNode
 *
 *         ClassifyNode -->|"'conversational'"| DirectAnswerNode
 *         ClassifyNode -->|"'unknown'"| ClarificationNode
 *     end
 * ```
 *
 * ## Implementation
 *
 * The system is divided into two stages:
 *
 * **Stage 1: Offline Indexing**
 *
 * Documents will be preprocessed and stored for fast retrieval:
 * - **ChunkNode** breaks raw documents into manageable pieces (sentences/paragraphs)
 * - **EmbedNode** converts each chunk into vector embeddings using an embedding model
 *
 * These nodes are chained sequentially, with each stage storing results in the shared store.
 *
 * **Stage 2: Query Processing with Classification**
 *
 * Incoming queries will be analyzed by **QueryClassificationNode**, which determines
 * the query type and returns it as an action. This action routes to different paths
 * using named edges:
 *
 * - **'factual' edge**: Queries requiring document context are routed through the full
 *   RAG pipeline (QueryEmbedNode → RetrieveNode → RAGAnswerNode)
 * - **'conversational' edge**: Simple greetings or conversational queries skip retrieval
 *   and are handled by DirectAnswerNode
 * - **'unknown' edge**: Unclassifiable queries are routed to ClarificationNode, which
 *   requests rephrasing
 *
 * Named edges enable conditional routing based on the classification result, avoiding
 * expensive retrieval operations when they're not needed.
 *
 * @example
 * // Stage 1: Index documents offline
 * const indexStore: RAGStore = {
 *   documents: [
 *     'Paris is the capital of France. It has the Eiffel Tower.',
 *     'London is the capital of England. It has Big Ben.'
 *   ]
 * };
 *
 * const chunkNode = new ChunkNode();
 * const embedNode = new EmbedNode();
 * chunkNode.connect(embedNode);
 * await run(chunkNode, indexStore);
 *
 * // Stage 2: Query with classification
 * const queryStore: RAGStore = {
 *   chunks: indexStore.chunks,
 *   embeddings: indexStore.embeddings,
 *   query: 'What is the capital of France?'
 * };
 *
 * const classifyNode = new QueryClassificationNode();
 * const queryEmbedNode = new QueryEmbedNode();
 * const retrieveNode = new RetrieveNode();
 * const answerNode = new RAGAnswerNode();
 * const directAnswerNode = new DirectAnswerNode();
 * const clarificationNode = new ClarificationNode();
 *
 * // Setup conditional routing with named edges
 * classifyNode.connect('factual', queryEmbedNode);
 * queryEmbedNode.connect(retrieveNode);
 * retrieveNode.connect(answerNode);
 *
 * classifyNode.connect('conversational', directAnswerNode);
 * classifyNode.connect('unknown', clarificationNode);
 *
 * await run(classifyNode, queryStore);
 *
 * // The query was classified as 'factual', so the full RAG pipeline was executed
 * console.log(queryStore.queryType); // 'factual'
 * console.log(queryStore.answer); // Answer generated with retrieved context
 */

interface RAGStore {
  documents?: string[];
  chunks?: string[];
  embeddings?: number[][];
  query?: string;
  queryType?: string;
  queryEmbedding?: number[];
  retrievedChunk?: string;
  answer?: string;
}

class ChunkNode extends Node<RAGStore, string, string[]> {
  async *prep(store: RAGStore) {
    for (const doc of store.documents!) {
      yield doc;
    }
  }

  async exec(store: RAGStore, doc: string): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return doc.split('.').filter(s => s.trim());
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: string[][]
  ): Promise<Action> {
    store.chunks = execResults.flat();
    return 'default';
  }
}

class EmbedNode extends Node<RAGStore, string, number[]> {
  async *prep(store: RAGStore) {
    for (const chunk of store.chunks!) {
      yield chunk;
    }
  }

  async exec(store: RAGStore, chunk: string): Promise<number[]> {
    return mockLLM.embed(chunk);
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: number[][]
  ): Promise<Action> {
    store.embeddings = execResults;
    return null;
  }
}

class QueryEmbedNode extends Node<RAGStore, string, number[]> {
  async *prep(store: RAGStore) {
    yield store.query!;
  }

  async exec(store: RAGStore, query: string): Promise<number[]> {
    return mockLLM.embed(query);
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: number[][]
  ): Promise<Action> {
    store.queryEmbedding = execResults[0];
    return 'default';
  }
}

class RetrieveNode extends Node<RAGStore, number, string> {
  async *prep(store: RAGStore) {
    yield 0;
  }

  async exec(store: RAGStore, index: number): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return store.chunks![index];
  }

  async post(
    store: RAGStore,
    prepItems: number[],
    execResults: string[]
  ): Promise<Action> {
    store.retrievedChunk = execResults[0];
    return 'default';
  }
}

class RAGAnswerNode extends Node<RAGStore, string, string> {
  async *prep(store: RAGStore) {
    yield `Question: ${store.query}\nContext: ${store.retrievedChunk}\nAnswer:`;
  }

  async exec(store: RAGStore, prompt: string): Promise<string> {
    return mockLLM.call(prompt);
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.answer = execResults[0];
    return null;
  }
}

class QueryClassificationNode extends Node<RAGStore, string, string> {
  async *prep(store: RAGStore) {
    yield store.query!;
  }

  async exec(store: RAGStore, query: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));

    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('what') || lowerQuery.includes('where') ||
        lowerQuery.includes('who') || lowerQuery.includes('which')) {
      return 'factual';
    }
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') ||
        lowerQuery.includes('how are you') || lowerQuery.includes('tell me about yourself')) {
      return 'conversational';
    }

    return 'unknown';
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    const queryType = execResults[0];
    store.queryType = queryType;
    return queryType as Action; // Return the classification as the action
  }
}

class DirectAnswerNode extends Node<RAGStore, string, string> {
  async *prep(store: RAGStore) {
    yield store.query!;
  }

  async exec(store: RAGStore, query: string): Promise<string> {
    return mockLLM.call(query);
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.answer = execResults[0];
    return null;
  }
}

class ClarificationNode extends Node<RAGStore, string, string> {
  async *prep(store: RAGStore) {
    yield store.query!;
  }

  async exec(store: RAGStore, query: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return `I'm not sure how to answer that. Could you please rephrase your question?`;
  }

  async post(
    store: RAGStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.answer = execResults[0];
    return null;
  }
}

describe('RAG Pattern with Query Classification', () => {
  let indexedStore: RAGStore;

  beforeAll(async () => {
    const indexStore: RAGStore = {
      documents: [
        'Paris is the capital of France. It has the Eiffel Tower.',
        'London is the capital of England. It has Big Ben.'
      ]
    };

    const chunkNode = new ChunkNode();
    const embedNode = new EmbedNode();
    chunkNode.connect(embedNode);

    await run(chunkNode, indexStore);

    indexedStore = {
      chunks: indexStore.chunks,
      embeddings: indexStore.embeddings
    };
  });

  test('routes factual queries through full RAG pipeline', async () => {
    const queryStore: RAGStore = {
      ...indexedStore,
      query: 'What is the capital of France?'
    };

    const classifyNode = new QueryClassificationNode();
    const queryEmbedNode = new QueryEmbedNode();
    const retrieveNode = new RetrieveNode();
    const answerNode = new RAGAnswerNode();
    const directAnswerNode = new DirectAnswerNode();
    const clarificationNode = new ClarificationNode();

    // Connect 'factual' edge to RAG pipeline
    classifyNode.connect('factual', queryEmbedNode);
    queryEmbedNode.connect(retrieveNode);
    retrieveNode.connect(answerNode);

    // Connect 'conversational' edge to direct answer
    classifyNode.connect('conversational', directAnswerNode);

    // Connect 'unknown' edge to clarification
    classifyNode.connect('unknown', clarificationNode);

    await run(classifyNode, queryStore);

    expect(queryStore.queryType).toBe('factual');
    expect(queryStore.retrievedChunk).toBeDefined();
    expect(queryStore.answer).toBeDefined();
  });

  test('routes conversational queries to direct LLM (skips retrieval)', async () => {
    const queryStore: RAGStore = {
      ...indexedStore,
      query: 'Hello, how are you today?'
    };

    const classifyNode = new QueryClassificationNode();
    const queryEmbedNode = new QueryEmbedNode();
    const retrieveNode = new RetrieveNode();
    const answerNode = new RAGAnswerNode();
    const directAnswerNode = new DirectAnswerNode();
    const clarificationNode = new ClarificationNode();

    classifyNode.connect('factual', queryEmbedNode);
    queryEmbedNode.connect(retrieveNode);
    retrieveNode.connect(answerNode);

    classifyNode.connect('conversational', directAnswerNode);
    classifyNode.connect('unknown', clarificationNode);

    await run(classifyNode, queryStore);

    expect(queryStore.queryType).toBe('conversational');
    expect(queryStore.retrievedChunk).toBeUndefined();
    expect(queryStore.answer).toBeDefined();
  });

  test('routes unknown queries to clarification', async () => {
    const queryStore: RAGStore = {
      ...indexedStore,
      query: 'xyzabc nonsense query'
    };

    const classifyNode = new QueryClassificationNode();
    const queryEmbedNode = new QueryEmbedNode();
    const retrieveNode = new RetrieveNode();
    const answerNode = new RAGAnswerNode();
    const directAnswerNode = new DirectAnswerNode();
    const clarificationNode = new ClarificationNode();

    classifyNode.connect('factual', queryEmbedNode);
    queryEmbedNode.connect(retrieveNode);
    retrieveNode.connect(answerNode);

    classifyNode.connect('conversational', directAnswerNode);
    classifyNode.connect('unknown', clarificationNode);

    await run(classifyNode, queryStore);

    expect(queryStore.queryType).toBe('unknown');
    expect(queryStore.retrievedChunk).toBeUndefined();
    expect(queryStore.answer).toContain('rephrase');
  });
});
