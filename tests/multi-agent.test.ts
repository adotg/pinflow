import { Node, run, Action, KILL } from '../src';
import { mockLLM } from './mock-llm';

/**
 * # Tutorial: Building a Word-Guessing Game with Coordinating Agents
 *
 * > **[View example code](../../tests/multi-agent.test.ts)**
 *
 * ## What Will Be Built
 *
 * A collaborative word-guessing game where two agents work together through iterative
 * communication. A Hinter agent provides clues about a target word, and a Guesser agent
 * attempts to identify it. The agents exchange messages through a shared queue until
 * the word is guessed or a maximum number of rounds is reached.
 *
 * Input:  { targetWord: 'computer', messages: [], rounds: 0 }
 * Output: { guessed: true, messages: [hinter clues & guesses], rounds: 3 }
 *
 * ## Workflow Diagram
 *
 * ```mermaid
 * graph LR
 *     Store["Shared Store
 *     ―――――――――――――
 *     messages: []
 *     targetWord: 'computer'
 *     rounds: 0"]
 *
 *     Hinter["HinterNode
 *     ―――――――――――――
 *     Read target & history
 *     Generate clue
 *     Append to messages"]
 *
 *     Guesser["GuesserNode
 *     ―――――――――――――
 *     Read message history
 *     Make guess
 *     Check if correct"]
 *
 *     Result["Result
 *     ―――――――――――――
 *     guessed: true
 *     rounds: 3"]
 *
 *     Store --> Hinter
 *     Hinter --> Guesser
 *     Guesser -->|"incorrect guess"| Hinter
 *     Guesser -->|"correct or max rounds"| Result
 * ```
 *
 * ## Implementation
 *
 * The workflow consists of two nodes that alternate execution:
 *
 * **HinterNode**: The target word and recent message history will be read from the
 * store. A clue will be generated and appended to the shared message queue. The
 * default edge will transition control to the GuesserNode.
 *
 * **GuesserNode**: The complete message history will be read from the store. A guess
 * will be made and added to the message queue. If the guess matches the target word
 * or the maximum rounds are reached, the workflow will terminate by returning KILL.
 * Otherwise, the default edge will return control to the HinterNode.
 *
 * **Communication**: Both agents communicate through a message array in the shared
 * store. Each message contains the sender's name and content, allowing agents to
 * understand the conversation context.
 *
 * @example
 * const store: MultiAgentStore = {
 *   messages: [],
 *   targetWord: 'computer',
 *   guessed: false,
 *   rounds: 0
 * };
 *
 * const hinterNode = new HinterNode();
 * const guesserNode = new GuesserNode();
 *
 * // Nodes are connected to form a coordination loop
 * hinterNode.connect(guesserNode);
 * guesserNode.connect(hinterNode);
 *
 * // The workflow will alternate between agents until completion
 * await run(hinterNode, store);
 *
 * // Final state after coordination
 * console.log(store.guessed); // true
 * console.log(store.rounds);  // 3
 */

interface MultiAgentStore {
  messages: Array<{ from: string; content: string }>;
  targetWord?: string;
  guessed?: boolean;
  rounds: number;
}

class HinterNode extends Node<MultiAgentStore, string, string> {
  async *prep(store: MultiAgentStore) {
    const history = store.messages.slice(-3).map(m => `${m.from}: ${m.content}`).join('\n');
    yield `Target word: ${store.targetWord}
Previous messages: ${history}
Give a one-word clue (don't say the target word).`;
  }

  async exec(store: MultiAgentStore, prompt: string): Promise<string> {
    await mockLLM.call(prompt, 100);
    return 'related-clue';
  }

  async post(
    store: MultiAgentStore,
    prepItems: string[],
    execResults: string[]
  ) {
    const clue = execResults[0];
    store.messages.push({ from: 'Hinter', content: clue });
  }
}

class GuesserNode extends Node<MultiAgentStore, string, string> {
  async *prep(store: MultiAgentStore) {
    const history = store.messages.map(m => `${m.from}: ${m.content}`).join('\n');
    yield `Messages: ${history}\nGuess the target word (one word):`;
  }

  async exec(store: MultiAgentStore, prompt: string): Promise<string> {
    await mockLLM.call(prompt, 100);

    if (store.rounds >= 2) {
      return store.targetWord!;
    }
    return 'wrong-guess';
  }

  async post(
    store: MultiAgentStore,
    prepItems: string[],
    execResults: string[]
  ) {
    const guess = execResults[0];
    store.messages.push({ from: 'Guesser', content: guess });
    store.rounds++;

    if (guess === store.targetWord) {
      store.guessed = true;
      return KILL;
    }

    if (store.rounds >= 3) {
      return KILL;
    }
  }
}

describe('Multi-Agent Pattern', () => {
  test('two agents coordinate via shared message queue', async () => {
    const store: MultiAgentStore = {
      messages: [],
      targetWord: 'computer',
      guessed: false,
      rounds: 0
    };

    const hinterNode = new HinterNode();
    const guesserNode = new GuesserNode();

    hinterNode.connect(guesserNode);
    guesserNode.connect(hinterNode);

    await run(hinterNode, store);

    expect(store.messages.length).toBeGreaterThan(0);
    expect(store.rounds).toBeGreaterThan(0);
    expect(store.guessed).toBe(true);
  });
});
