export type Store<T = Record<string, any>> = T;
export const KILL = Symbol('KILL');
export type Action = string | typeof KILL | undefined | null;
export type Params = Record<string, any>;

export interface NodeConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export const DEFAULT_NODE_CONFIG: Required<NodeConfig> = {
  maxRetries: 3,
  retryDelay: 2000,
  timeout: 60000,
};

/**
 * Base class for defining workflow nodes in the prep-exec-post pipeline.
 *
 * Each node operates in three phases:
 * 1. **prep**: Generate items to process (supports streaming via AsyncGenerator)
 * 2. **exec**: Process each item concurrently with automatic retry logic
 * 3. **post**: Aggregate results and determine the next action/node
 *
 * @template TStore - Type of the shared state object passed through the workflow
 * @template TPrepItem - Type of items yielded by prep() and processed by exec()
 * @template TExecResult - Type of results returned by exec()
 *
 * @example
 * ```typescript
 * class FetchUsers extends Node<AppStore, string, User> {
 *   async *prep(store: AppStore) {
 *     for (const userId of store.userIds) {
 *       yield userId;
 *     }
 *   }
 *
 *   async exec(store: AppStore, userId: string) {
 *     return await api.fetchUser(userId);
 *   }
 *
 *   async post(store: AppStore, userIds: string[], users: User[]) {
 *     store.users = users;
 *     return users.length > 0 ? 'process' : 'empty';
 *   }
 * }
 * ```
 */
export abstract class Node<TStore = any, TPrepItem = any, TExecResult = any> {
  readonly config: Required<NodeConfig>;
  protected params: Params = {};
  private edges: Map<Action, Node> = new Map();

  constructor(config?: NodeConfig) {
    this.config = { ...DEFAULT_NODE_CONFIG, ...config };
  }

  /**
   * Generates items to be processed by exec().
   *
   * **Single item processing**: Yield a single value to process just one item.
   *
   * **Batch processing**: Yield multiple values to process multiple items. Each yielded item
   * triggers an exec() call, and all exec() calls run in parallel.
   *
   * You can yield either direct values or Promises. Promises will be awaited before being
   * passed to exec(), allowing you to start asynchronous preparation work early.
   */
  abstract prep(store: TStore): AsyncGenerator<TPrepItem | Promise<TPrepItem>>;

  /**
   * Processes a single item yielded by prep(). Called once for each yielded item,
   * with all calls executing in parallel.
   *
   * Automatically retried on failure according to the configured retry policy
   * (maxRetries and retryDelay). If all retries are exhausted and execFallback()
   * is defined, the fallback is invoked instead of throwing.
   *
   * @throws Error if processing fails after all retries and no fallback is defined
   */
  abstract exec(store: TStore, item: TPrepItem): Promise<TExecResult>;

  /**
   * Aggregates all prep items and exec results, then determines the next workflow step.
   *
   * **Return value controls flow**:
   * - Named action (string): Follow the edge registered with connect(action, node)
   * - undefined/null: Follow the default edge registered with connect(node)
   * - KILL symbol: Stop workflow execution immediately
   *
   * If no matching edge exists for the returned action, the workflow stops.
   */
  abstract post( store: TStore, prepItems: TPrepItem[], execResults: TExecResult[]): Promise<Action | void>;

  /**
   * Optional fallback handler invoked when exec() fails after exhausting all retry attempts.
   * Allows graceful degradation instead of throwing an error that would terminate the workflow.
   *
   * The retry mechanism (number of attempts and delay between retries) can be customized
   * by passing a NodeConfig object to the constructor with maxRetries and retryDelay properties.
   */
  execFallback?(store: TStore, item: TPrepItem, error: Error): Promise<TExecResult>;

  /**
   * Connects this node to the next node in the workflow graph.
   *
   * **Two usage patterns**:
   * 1. `connect(node)`: Sets the default edge (used when post() returns undefined/null)
   * 2. `connect(action, node)`: Sets a named edge (used when post() returns the action string)
   *
   * Use named edges when you need conditional execution paths. For example, if post() can
   * return either 'success' or 'retry', you can register different nodes for each outcome
   * to create branching logic in your workflow.
   *
   * @returns this for method chaining
   *
   * @example
   * ```typescript
   * const fetch = new FetchNode();
   * const process = new ProcessNode();
   * const retry = new RetryNode();
   *
   * fetch
   *   .connect(process)           // Default: when post() returns undefined
   *   .connect('retry', retry);   // Named: when post() returns 'retry'
   * ```
   */
  connect(action: Action | Node, target?: Node): this {
    if (target === undefined) {
      this.edges.set('default', action as Node);
    } else {
      this.edges.set(action as Action, target);
    }
    return this;
  }

  getEdge(action: Action): Node | undefined {
    return this.edges.get(action);
  }

  /**
   * Called when exec() encounters an error before a retry attempt.
   * Override to customize error logging or implement backoff strategies.
   *
   * @param attempt - Current attempt number (1-indexed)
   * @param maxRetries - Total number of retry attempts configured
   */
  onError(error: Error, attempt: number, maxRetries: number): void {
    console.error(`Error [${attempt}/${maxRetries}] Node [${this.constructor.name}]: ${error.stack}`);
  }

  setParams(params: Params): this {
    this.params = { ...params };
    return this;
  }
}


async function executeWithRetry<TStore, TPrepItem, TExecResult>(
  node: Node<TStore, TPrepItem, TExecResult>,
  store: TStore,
  item: TPrepItem
): Promise<TExecResult> {
  const maxRetries = node.config.maxRetries;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await node.exec(store, item);
    } catch (error) {
      if (attempt === maxRetries - 1) { // All retries exhausted
        if (node.execFallback) {
          return await node.execFallback(store, item, error as Error);
        }
        throw error;
      }

      node.onError(error as Error, attempt + 1, maxRetries);
      const retryDelay = Math.max(node.config.retryDelay, 0)
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('Unreachable');
}

/**
 * Executes a workflow starting from the given node with the provided store.
 *
 * Orchestrates the prep-exec-post pipeline for each node in the workflow graph:
 * 1. Calls prep() to generate items, starting exec() calls immediately as items are yielded
 * 2. Waits for all exec() calls to complete in parallel
 * 3. Calls post() with aggregated prep items and exec results
 * 4. Determines the next node based on post()'s return value:
 *    - KILL: Terminates workflow immediately
 *    - Named action: Follows the corresponding named edge (if exists)
 *    - undefined/null: Follows the default edge (if exists)
 * 5. Recursively executes the next node if found, otherwise terminates
 *
 * The store object is shared across all nodes in the workflow, allowing state to be
 * accumulated and passed through the entire execution chain.
 */
export async function run<TStore>(node: Node<TStore>, store: TStore): Promise<void> {
  const prepItems: any[] = [];
  const execResults: any[] = [];
  const execPromises: Promise<void>[] = [];
  const generator = node.prep(store);

  let result = await generator.next();
  while (true) {
    if (result.done) break;

    let item = result.value instanceof Promise ? result.value : Promise.resolve(result.value);
    const execPromise = (async () => {
      prepItems.push(await item);

      const execValue = await executeWithRetry(node, store, await item);
      execResults.push(execValue);
    })();

    execPromises.push(execPromise);
    result = await generator.next(item);
  }

  await Promise.all(execPromises);
  const action = await node.post(store, prepItems, execResults);
  if (action === KILL) return;
  const nextNode = node.getEdge(action ?? 'default') || node.getEdge('default');
  if (nextNode) {
    await run(nextNode, store);
  }
}
