import { Node, run } from 'pinflow';
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
    let dots = 0;
    const thinkingInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      process.stdout.write(`\rThinking${'.'.repeat(dots)}${' '.repeat(3 - dots)}`);
    }, 500);

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
      });
      return response.choices[0].message.content;
    } finally {
      clearInterval(thinkingInterval);
      process.stdout.write('\r' + ' '.repeat(12) + '\r'); // Clear the thinking line
    }
  }

  async post(store, prepItems, execResults) {
    let response = execResults[0];
    // Remove <think>...</think> tags and their content
    response = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

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
  console.log('Terminal Chat Agent - Powered by PinFlow');
  console.log('='.repeat(80));
  console.log(`API Endpoint: ${API_BASE_URL}`);
  console.log(`Model: ${MODEL}`);
  console.log('Press ctrl+c to exit');
  console.log('='.repeat(80));

  const rl = createInterface();

  const store = {
    messages: [ ]
  };

  const chatNode = new ChatNode(rl);
  chatNode.connect(chatNode);

  await run(chatNode, store);
}

main().catch(console.error);
