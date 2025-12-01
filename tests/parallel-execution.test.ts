import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * # Tutorial: Processing Multiple Queries Concurrently
 *
 * > **[View example code](../../tests/parallel-execution.test.ts)**
 *
 * ## What Will Be Built
 *
 * A batch processing workflow that takes multiple independent queries and processes
 * them concurrently to maximize throughput. Five queries will be sent to an LLM
 * simultaneously, and all responses will be collected while maintaining their original
 * order.
 *
 * Input:  ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5']
 * Output: ['Response 1', 'Response 2', 'Response 3', 'Response 4', 'Response 5']
 *
 * Processing time: ~500ms (vs 2500ms if processed sequentially)
 *
 * ## Workflow Diagram
 *
 * ```mermaid
 * graph TB
 *     Store1["Store State (before)
 *     ―――――――――――――――――
 *     queries: ['Query 1', ...]"]
 *
 *     subgraph ParallelExecution["Parallel Execution (all concurrent)"]
 *         direction TB
 *         PE1["prep() yield 'Query 1'
 *         ↓
 *         exec('Query 1') → LLM"]
 *         PE2["prep() yield 'Query 2'
 *         ↓
 *         exec('Query 2') → LLM"]
 *         PE3["prep() yield 'Query 3'
 *         ↓
 *         exec('Query 3') → LLM"]
 *         PE4["prep() yield 'Query 4'
 *         ↓
 *         exec('Query 4') → LLM"]
 *         PE5["prep() yield 'Query 5'
 *         ↓
 *         exec('Query 5') → LLM"]
 *     end
 *
 *     Post["post()
 *     ―――――――――――――――――――――――――
 *     Collect all results
 *     Store in store.results"]
 *
 *     Store2["Store State (after)
 *     ―――――――――――――――――
 *     queries: ['Query 1', ...]
 *     results: ['Response 1', ...]"]
 *
 *     Store1 --> ParallelExecution
 *     ParallelExecution -->|"All responses
 *     (order preserved)"| Post
 *     Post --> Store2
 * ```
 *
 * ## Implementation
 *
 * The workflow is divided into three phases:
 *
 * **prep**: Each query from the store will be yielded individually. As soon as a query
 * is yielded, it will be dispatched to `exec()` without waiting for other queries.
 *
 * **exec**: All five exec calls will run concurrently. Each query will be sent to the
 * LLM independently, with responses collected as they complete. The order of results
 * will match the order of queries regardless of completion time.
 *
 * **post**: All responses will be received as an array and stored in the store. The
 * `execResults` array will maintain the same ordering as the original queries array.
 *
 * @example
 * const store: ParallelStore = {
 *   queries: ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5']
 * };
 *
 * const node = new ParallelNode();
 * // The `run()` function will execute all queries concurrently,
 * // wait for all responses, and store them in `store.results`.
 * await run(node, store);
 *
 * // Access the collected results (order preserved)
 * console.log(store.results);
 * // ['Response 1', 'Response 2', 'Response 3', 'Response 4', 'Response 5']
 */

interface ParallelStore {
  queries: string[];
  results?: string[];
}

class ParallelNode extends Node<ParallelStore, string, string> {
  async *prep(store: ParallelStore) {
    for (const query of store.queries) {
      yield query;
    }
  }

  async exec(store: ParallelStore, query: string): Promise<string> {
    return mockLLM.call(query, 5);
  }

  async post(
    store: ParallelStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.results = execResults;
    return null;
  }
}

describe('Parallel Execution', () => {
  test('executes multiple prep items in parallel', async () => {
    const store: ParallelStore = {
      queries: ['Query 1', 'Query 2', 'Query 3', 'Query 4', 'Query 5']
    };

    const node = new ParallelNode();
    const startTime = Date.now();

    await run(node, store);

    const elapsed = Date.now() - startTime;

    expect(store.results).toHaveLength(5);
    expect(elapsed).toBeLessThan(40);
  });
});
