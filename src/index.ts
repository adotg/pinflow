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

export abstract class Node<TStore = any, TPrepItem = any, TExecResult = any> {
  readonly config: Required<NodeConfig>;
  protected params: Params = {};
  private edges: Map<Action, Node> = new Map();

  constructor(config?: NodeConfig) {
    this.config = { ...DEFAULT_NODE_CONFIG, ...config };
  }

  abstract prep(store: TStore): AsyncGenerator<TPrepItem | Promise<TPrepItem>>;

  abstract exec(store: TStore, item: TPrepItem): Promise<TExecResult>;

  abstract post( store: TStore, prepItems: TPrepItem[], execResults: TExecResult[]): Promise<Action | void>;

  execFallback?(store: TStore, item: TPrepItem, error: Error): Promise<TExecResult>;

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
