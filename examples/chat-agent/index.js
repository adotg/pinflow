import { Node, run } from 'microflow';
import OpenAI from 'openai';
import * as readline from 'readline';

const API_BASE_URL = process.env.OPENAI_API_BASE || 'http://localhost:11434/v1';
const API_KEY = process.env.OPENAI_API_KEY || 'ollama';
const MODEL = process.env.MODEL || 'qwen3:1.7b';

const client = new OpenAI({
  baseURL: API_BASE_URL,
  apiKey: API_KEY,
});

class ChatNode extends Node {
  constructor(rl) {
    super();
    this.rl = rl;
  }

  async *prep(store) {
    // Wait for user input inside prep
    const userInput = await getUserInput(this.rl);

    if (userInput) {
      store.messages.push({
        role: 'user',
        content: userInput
      });
    }

    yield store.messages;
  }

  async exec(store, messages) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  }

  async post(store, prepItems, execResults) {
    const response = execResults[0];

    store.messages.push({
      role: 'assistant',
      content: response
    });

    console.log(`\nAssistant: ${response}\n`);
  }
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
  });
}

async function getUserInput(rl) {
  return new Promise((resolve) => {
    rl.prompt();
    rl.once('line', (line) => {
      resolve(line.trim());
    });
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('Terminal Chat Agent - Powered by MicroFlow');
  console.log('='.repeat(80));
  console.log(`\nAPI Endpoint: ${API_BASE_URL}`);
  console.log(`Model: ${MODEL}`);
  console.log('\nPress ctrl+c to exit\n');
  console.log('='.repeat(80) + '\n');

  const rl = createInterface();

  const store = {
    messages: [ ]
  };

  const chatNode = new ChatNode(rl);
  chatNode.connect(chatNode);

  await run(chatNode, store);
}

main().catch(console.error);
