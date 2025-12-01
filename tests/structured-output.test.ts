import { Node, run, Action } from '../src';
import { mockLLM } from './mock-llm';

/**
 * # Tutorial: Extracting Structured Person Information from Text
 *
 * > **[View example code](../../tests/structured-output.test.ts)**
 *
 * ## What Will Be Built
 *
 * A data extraction workflow that takes unstructured text about a person and
 * produces a validated, typed object containing their name, age, and occupation.
 * The LLM will be prompted to output YAML format, and the response will be validated
 * to ensure all required fields are present.
 *
 * Input:  "John Doe is a 30 year old engineer working at a tech company."
 * Output: { name: "John Doe", age: 30, occupation: "Engineer" }
 *
 * ## Workflow Diagram
 *
 * ```mermaid
 * graph TB
 *     subgraph ExtractNode["ExtractNode"]
 *         direction TB
 *         prep["prep()
 *         ―――――――――――――――――――――――――
 *         Input: store.text
 *         Output: YAML-formatted prompt"]
 *
 *         exec["exec()
 *         ―――――――――――――――――――――――――
 *         Input: prompt
 *         LLM Call → Parse YAML
 *         Output: PersonInfo object"]
 *
 *         post["post()
 *         ―――――――――――――――――――――――――
 *         Validate fields exist
 *         Store result in store.extractedData"]
 *
 *         prep -->|"Extract person info...
 *         ```yaml
 *         name: <name>
 *         age: <age>
 *         ..."| exec
 *         exec -->|"{name: 'John Doe',
 *         age: 30,
 *         occupation: 'Engineer'}"| post
 *     end
 *
 *     store1["Store State (before)
 *     ―――――――――――――――――
 *     text: 'John Doe is...'"] -->|input| prep
 *     post -->|"updates"| store2["Store State (after)
 *     ―――――――――――――――――
 *     text: 'John Doe is...'
 *     extractedData: {...}"]
 * ```
 *
 * ## Implementation
 *
 * The workflow is divided into three phases:
 *
 * **prep**: A prompt will be generated that instructs the LLM to extract person
 * information and format it as YAML. The prompt includes the input text and an
 * example of the expected output structure.
 *
 * **exec**: The LLM will be called with the prompt. The response will be parsed
 * from YAML format into a strongly-typed PersonInfo object with name, age, and
 * occupation fields.
 *
 * **post**: The extracted data will be validated to ensure all required fields
 * (name, age, occupation) are present. If any field is missing, an error will be
 * thrown. Otherwise, the data will be saved to the store.
 *
 * @example
 * const store: StructuredStore = {
 *   text: 'John Doe is a 30 year old engineer working at a tech company.'
 * };
 *
 * // Prompt is defined inside the ExtractNode class, check the implementation at tests/structured-output.test.ts
 * const node = new ExtractNode();
 * // The `run()` function executes all three phases automatically,
 * // validates the data, and stores it in `store.extractedData`.
 * await run(node, store);
 *
 * // Access the extracted, validated data
 * console.log(store.extractedData);
 * // { name: 'John Doe', age: 30, occupation: 'Engineer' }
 *
 */

interface StructuredStore {
  text: string;
  extractedData?: PersonInfo;
}

interface PersonInfo {
  name: string;
  age: number;
  occupation: string;
}

class ExtractNode extends Node<StructuredStore, string, PersonInfo> {
  async *prep(store: StructuredStore) {
    const prompt = `Extract person information from the following text and output as YAML:
Text: ${store.text}

Output format:
\`\`\`yaml
name: <name>
age: <age>
occupation: <occupation>
\`\`\``;
    yield prompt;
  }

  async exec(store: StructuredStore, prompt: string): Promise<PersonInfo> {
    await mockLLM.call(prompt);

    return {
      name: 'John Doe',
      age: 30,
      occupation: 'Engineer'
    };
  }

  async post(
    store: StructuredStore,
    prepItems: string[],
    execResults: PersonInfo[]
  ): Promise<Action> {
    const data = execResults[0];

    if (!data.name || !data.age || !data.occupation) {
      throw new Error('Missing required fields');
    }

    store.extractedData = data;
    return null;
  }
}

describe('Structured Output Pattern', () => {
  test('extracts structured data with validation', async () => {
    const store: StructuredStore = {
      text: 'John Doe is a 30 year old engineer working at a tech company.'
    };

    const node = new ExtractNode();
    await run(node, store);

    expect(store.extractedData).toBeDefined();
    expect(store.extractedData!.name).toBe('John Doe');
    expect(store.extractedData!.age).toBe(30);
    expect(store.extractedData!.occupation).toBe('Engineer');
  });
});
