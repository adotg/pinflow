import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * @fileoverview Tutorial: Building a Sequential Research Report Workflow
 *
 * @description
 *
 * > **[View example code](../../tests/workflow.test.ts)**
 *
 * ## What Will Be Built
 *
 * A multi-step workflow will be created that generates a research report by chaining
 * three specialized nodes together. Each node performs a specific task: researching
 * the topic, creating an outline, and writing the final report. The nodes will be
 * connected sequentially, with each node building upon the work of the previous one
 * through a shared store.
 *
 * Input:  "History of quantum computing"
 * Output: Research findings → Outline → Complete report
 *
 * ## Workflow Diagram
 *
 * ```mermaid
 * graph TB
 *     subgraph Store["Shared Store"]
 *         userQuery["userQuery: 'History of quantum computing'"]
 *         researchResults["researchResults"]
 *         outline["outline"]
 *         finalReport["finalReport"]
 *     end
 *
 *     Research["ResearchNode
 *     ―――――――――――――――――
 *     Prompt: 'Research the topic...'
 *     Output: Research findings"]
 *
 *     Outline["OutlineNode
 *     ―――――――――――――――――
 *     Prompt: 'Create outline based on...'
 *     Output: Structured outline"]
 *
 *     Writer["WriterNode
 *     ―――――――――――――――――
 *     Prompt: 'Write report following...'
 *     Output: Final report"]
 *
 *     userQuery -->|read| Research
 *     Research -->|write| researchResults
 *     researchResults -->|read| Outline
 *     Outline -->|write| outline
 *     outline -->|read| Writer
 *     Writer -->|write| finalReport
 *
 *     Research --> Outline
 *     Outline --> Writer
 *
 *     style Research fill:#e1f5ff,stroke:#01579b,stroke-width:2px
 *     style Outline fill:#e1f5ff,stroke:#01579b,stroke-width:2px
 *     style Writer fill:#e1f5ff,stroke:#01579b,stroke-width:2px
 *     style Store fill:#f5f5f5,stroke:#666,stroke-width:2px
 * ```
 *
 * ## Implementation
 *
 * The workflow will be implemented with three nodes that execute sequentially:
 *
 * **ResearchNode**: The initial query will be read from the store, and a prompt
 * will be generated asking the LLM to research the topic. The research findings
 * will be stored in `store.researchResults`, and the next node will be triggered
 * by returning a non-null action.
 *
 * **OutlineNode**: The research results will be read from the store, and a prompt
 * will be generated asking the LLM to create an outline. The outline will be stored
 * in `store.outline`, and the next node will be triggered.
 *
 * **WriterNode**: The outline will be read from the store, and a prompt will be
 * generated asking the LLM to write the final report. The completed report will be
 * stored in `store.finalReport`.
 *
 * ## Node Connections
 *
 * **connect()**: Nodes will be connected using the `connect()` method. When a node
 * completes, the next node in the chain will automatically be executed. The shared
 * store allows each node to access the outputs from previous nodes.
 *
 * @example
 * const store: WorkflowStore = {
 *   userQuery: 'History of quantum computing'
 * };
 *
 * const researchNode = new ResearchNode();
 * const outlineNode = new OutlineNode();
 * const writerNode = new WriterNode();
 *
 * // Connect nodes sequentially
 * researchNode.connect(outlineNode);
 * outlineNode.connect(writerNode);
 *
 * // Execute the workflow starting from the first node
 * await run(researchNode, store);
 *
 * // All results are available in the store
 * console.log(store.researchResults);  // Research findings
 * console.log(store.outline);          // Structured outline
 * console.log(store.finalReport);      // Complete report
 *
 */

interface WorkflowStore {
  userQuery: string;
  researchResults?: string;
  outline?: string;
  finalReport?: string;
}

class ResearchNode extends Node<WorkflowStore, string, string> {
  async *prep(store: WorkflowStore) {
    yield `Research the following topic: ${store.userQuery}`;
  }

  async exec(store: WorkflowStore, prompt: string): Promise<string> {
    return mockLLM.call(prompt);
  }

  async post(
    store: WorkflowStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.researchResults = execResults[0];
    return 'outline';
  }
}

class OutlineNode extends Node<WorkflowStore, string, string> {
  async *prep(store: WorkflowStore) {
    yield `Create an outline based on: ${store.researchResults}`;
  }

  async exec(store: WorkflowStore, prompt: string): Promise<string> {
    return mockLLM.call(prompt);
  }

  async post(
    store: WorkflowStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.outline = execResults[0];
    return 'write';
  }
}

class WriterNode extends Node<WorkflowStore, string, string> {
  async *prep(store: WorkflowStore) {
    yield `Write a report following this outline: ${store.outline}`;
  }

  async exec(store: WorkflowStore, prompt: string): Promise<string> {
    return mockLLM.call(prompt);
  }

  async post(
    store: WorkflowStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.finalReport = execResults[0];
    return null;
  }
}

describe('Workflow Pattern', () => {
  test('chains multiple nodes in sequential workflow', async () => {
    const store: WorkflowStore = {
      userQuery: 'History of quantum computing'
    };

    const researchNode = new ResearchNode();
    const outlineNode = new OutlineNode();
    const writerNode = new WriterNode();

    researchNode.connect(outlineNode);
    outlineNode.connect(writerNode);

    await run(researchNode, store);

    expect(store.researchResults).toBeDefined();
    expect(store.outline).toBeDefined();
    expect(store.finalReport).toBeDefined();
  });
});
