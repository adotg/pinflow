# Terminal Chat Agent Example

This example demonstrates how to build an interactive terminal-based chat agent using MicroFlow and OpenAI-compatible APIs.

## Features

- **Interactive terminal interface**: Real-time conversation with readline prompts
- **OpenAI-compatible API**: Works with local models (LM Studio, Ollama, etc.) or OpenAI/compatible APIs
- **Conversation history**: Maintains full conversation context across all turns
- **Agent greeting**: Starts with the agent introducing itself
- **Error handling**: Gracefully handles API errors with user-friendly messages

## Architecture

The agent uses a simple single-node workflow:

- **ChatNode**: Handles the entire conversation flow using MicroFlow's prep-exec-post pattern
  - `prep()`: Yields the full conversation history
  - `exec()`: Calls the OpenAI-compatible API with the messages
  - `post()`: Updates the conversation history with the response

## Setup

### Prerequisites

You need an OpenAI-compatible API endpoint. Options include:

1. **Local Models** (Recommended for testing):
   - [LM Studio](https://lmstudio.ai/) - Easy local model hosting
   - [Ollama](https://ollama.ai/) - Command-line local model server
   - [LocalAI](https://localai.io/) - Self-hosted OpenAI-compatible server

2. **Cloud APIs**:
   - OpenAI API
   - Any OpenAI-compatible API service

### Environment Variables

Configure the agent with environment variables:

- `OPENAI_API_BASE`: API endpoint URL (default: `http://localhost:1234/v1`)
- `OPENAI_API_KEY`: API key (default: `not-needed` for local models)
- `MODEL`: Model name (default: `local-model`)

## Running the Example

### From the monorepo root:

```bash
# Build the library first
npm install
npm run build

# Run the chat agent
cd examples/chat-agent
npm start
```

### With custom configuration:

```bash
# Using LM Studio (default port 1234)
npm start

# Using Ollama (default port 11434)
OPENAI_API_BASE=http://localhost:11434/v1 npm start

# Using OpenAI
OPENAI_API_BASE=https://api.openai.com/v1 OPENAI_API_KEY=sk-... MODEL=gpt-4 npm start
```

## Sample Session

```
================================================================================
Terminal Chat Agent - Powered by MicroFlow
================================================================================

API Endpoint: http://localhost:1234/v1
Model: local-model

Type "exit" or "quit" to end the conversation

================================================================================

Starting conversation...