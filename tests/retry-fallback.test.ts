import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * @fileoverview Tutorial: Building a Resilient LLM Application with Retry and Fallback
 *
 * @description
 *
 * > **[View example code](../../tests/retry-fallback.test.ts)**
 *
 * ## What Will Be Built
 *
 * A resilient application that handles unreliable API calls will be created. When
 * the LLM API fails due to rate limits or network issues, automatic retries will
 * be attempted. If all retries are exhausted, a fallback response will be returned
 * to ensure the application continues to function gracefully.
 *
 * Input:  "Summarize this article"
 * Behavior: API fails → Auto retry → API fails → Auto retry → Success
 * Output: "Summary of the article..."
 *
 * ## Execution Flow with Retry and Fallback
 *
 * ```mermaid
 * graph TB
 *     Store["Shared Store
 *     ―――――――――――――――――
 *     prompt: 'Summarize...'
 *     attempts: 0"]
 *
 *     Prep["prep()
 *     ―――――――――――――――――
 *     yield prompt"]
 *
 *     Exec["exec()
 *     ―――――――――――――――――
 *     Call LLM API
 *     Increment attempts"]
 *
 *     CheckError{"Error thrown?"}
 *     CheckRetries{"Retries
 *     remaining?"}
 *
 *     Fallback["execFallback()
 *     ―――――――――――――――――
 *     Return fallback response"]
 *
 *     Post["post()
 *     ―――――――――――――――――
 *     Store result in store.result"]
 *
 *     Store --> Prep
 *     Prep --> Exec
 *     Exec --> CheckError
 *     CheckError -->|"Yes"| CheckRetries
 *     CheckError -->|"No"| Post
 *     CheckRetries -->|"Yes"| Exec
 *     CheckRetries -->|"No"| Fallback
 *     Fallback --> Post
 *     Post --> Store
 *
 *     style Store fill:#f5f5f5,stroke:#666,stroke-width:2px
 *     style Prep fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
 *     style Exec fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
 *     style Post fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
 *     style Fallback fill:#ffebee,stroke:#c62828,stroke-width:2px
 *     style CheckError fill:#fff9c4,stroke:#f57f17,stroke-width:2px
 *     style CheckRetries fill:#fff9c4,stroke:#f57f17,stroke-width:2px
 *     linkStyle 4 stroke:#e53935,stroke-width:2px,stroke-dasharray: 5 5
 *     linkStyle 6 stroke:#e53935,stroke-width:2px,stroke-dasharray: 5 5
 * ```
 *
 * ## Implementation
 *
 * The resilient node will be implemented with automatic retry and fallback handling:
 *
 * **Node Configuration**: The node will be configured with `maxRetries` and
 * `retryDelay` parameters. These settings control how many times the exec phase
 * will be retried and the delay between attempts.
 *
 * **exec()**: The LLM API will be called in this phase. If the API throws an
 * error (rate limit, network failure, etc.), the error will be caught automatically
 * and the execution will be retried based on the configuration.
 *
 * **execFallback()**: When all retry attempts are exhausted, this method will be
 * called automatically. A fallback response will be returned to ensure the
 * application continues to function gracefully.
 *
 * @example
 * const store: RetryStore = {
 *   prompt: 'Summarize this article',
 *   attempts: 0
 * };
 *
 * // Configure node with 3 retries and 10ms delay between retries
 * const node = new UnreliableNode({ maxRetries: 3, retryDelay: 10 });
 *
 * // The `run()` function handles retries automatically
 * await run(node, store);
 *
 * // Result will be either from successful exec or from execFallback
 * console.log(store.result);
 * console.log(store.attempts); // Shows how many attempts were made
 *
 */

interface RetryStore {
  prompt: string;
  result?: string;
  attempts: number;
}

class UnreliableNode extends Node<RetryStore, string, string> {
  async *prep(store: RetryStore) {
    yield store.prompt;
  }

  async exec(store: RetryStore, prompt: string): Promise<string> {
    store.attempts++;

    if (store.attempts < 3) {
      throw new Error('Simulated API failure');
    }

    return mockLLM.call(prompt);
  }

  async post(
    store: RetryStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.result = execResults[0];
    return null;
  }

  execFallback(store: RetryStore, item: string, error: Error): Promise<string> {
    return Promise.resolve('Fallback response due to error');
  }
}

describe('Retry and Fallback', () => {
  test('retries failed executions', async () => {
    const store: RetryStore = {
      prompt: 'Test prompt',
      attempts: 0
    };

    const node = new UnreliableNode({ maxRetries: 3, retryDelay: 10 });
    await run(node, store);

    expect(store.attempts).toBe(3);
    expect(store.result).toBeDefined();
  });

  test('uses fallback when retries exhausted', async () => {
    const store: RetryStore = {
      prompt: 'Test prompt',
      attempts: 0
    };

    const node = new UnreliableNode({ maxRetries: 2, retryDelay: 10 });
    await run(node, store);

    expect(store.attempts).toBe(2);
    expect(store.result).toBe('Fallback response due to error');
  });
});
