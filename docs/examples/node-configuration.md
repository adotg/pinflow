# Configuring Nodes with Custom Parameters and Retry Behavior

> **[View example code](../../tests/node-configuration.test.ts)**

## What Will Be Built

A reusable prompt formatter node that can be configured with different prefixes
and retry behaviors. The same node class will be instantiated multiple times with
different configurations, demonstrating how nodes can be customized without
creating new classes.

Example configurations:
- Node with "Say: " prefix and 5 retries for critical operations
- Node with "Prompt: " prefix and 2 retries for less critical operations
- Node with default settings and custom timeout

## Implementation

**Custom Parameters**: A prefix parameter will be set using `setParams()` and
accessed via `this.params` in the prep method. This allows the same node class
to format prompts differently based on configuration.

**Retry Configuration**: Retry settings will be passed to the constructor to
control how the node handles failures. Different node instances can have
different reliability guarantees:
- `maxRetries`: Number of retry attempts on failure
- `retryDelay`: Milliseconds between retries
- `timeout`: Maximum execution time

**Method Chaining**: Configuration methods will be chained together for fluent
setup. Both `setParams()` and `connect()` return the node instance, allowing
multiple configurations in a single expression.