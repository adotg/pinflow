import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * # Configuring Nodes with Custom Parameters and Retry Behavior
 *
 * > **[View example code](../../tests/node-configuration.test.ts)**
 *
 * ## What Will Be Built
 *
 * A reusable prompt formatter node that can be configured with different prefixes
 * and retry behaviors. The same node class will be instantiated multiple times with
 * different configurations, demonstrating how nodes can be customized without
 * creating new classes.
 *
 * Example configurations:
 * - Node with "Say: " prefix and 5 retries for critical operations
 * - Node with "Prompt: " prefix and 2 retries for less critical operations
 * - Node with default settings and custom timeout
 *
 * ## Implementation
 *
 * **Custom Parameters**: A prefix parameter will be set using `setParams()` and
 * accessed via `this.params` in the prep method. This allows the same node class
 * to format prompts differently based on configuration.
 *
 * **Retry Configuration**: Retry settings will be passed to the constructor to
 * control how the node handles failures. Different node instances can have
 * different reliability guarantees:
 * - `maxRetries`: Number of retry attempts on failure
 * - `retryDelay`: Milliseconds between retries
 * - `timeout`: Maximum execution time
 *
 * **Method Chaining**: Configuration methods will be chained together for fluent
 * setup. Both `setParams()` and `connect()` return the node instance, allowing
 * multiple configurations in a single expression.
 */

interface ConfigStore {
  input: string;
  output?: string;
}

class ConfigurableNode extends Node<ConfigStore, string, string> {
  async *prep(store: ConfigStore) {
    const prefix = this.params.prefix || '';
    yield `${prefix}${store.input}`;
  }

  async exec(store: ConfigStore, prompt: string): Promise<string> {
    return mockLLM.call(prompt);
  }

  async post(
    store: ConfigStore,
    prepItems: string[],
    execResults: string[]
  ): Promise<Action> {
    store.output = execResults[0];
    return null;
  }
}

describe('Node Configuration', () => {
  test('nodes can be configured with custom parameters', async () => {
    const store: ConfigStore = {
      input: 'Hello'
    };

    const node = new ConfigurableNode()
      .setParams({ prefix: 'Say: ' });

    await run(node, store);

    expect(store.output).toBeDefined();
  });

  test('nodes can be configured with retry settings', async () => {
    const store: ConfigStore = {
      input: 'Test'
    };

    const node = new ConfigurableNode({
      maxRetries: 5,
      retryDelay: 100,
      timeout: 30000
    });

    expect(node.config.maxRetries).toBe(5);
    expect(node.config.retryDelay).toBe(100);
    expect(node.config.timeout).toBe(30000);
  });

  test('configuration supports method chaining', async () => {
    const store: ConfigStore = {
      input: 'Test'
    };

    const nextNode = new ConfigurableNode();

    const node = new ConfigurableNode({ maxRetries: 2 })
      .setParams({ prefix: 'Prompt: ' })
      .connect(nextNode);

    expect(node.config.maxRetries).toBe(2);
    expect(node.getEdge('default')).toBe(nextNode);
  });
});
