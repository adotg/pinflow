#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testFiles = [
  'single-node.test.ts',
  'workflow.test.ts',
  'parallel-execution.test.ts',
  'agent.test.ts',
  'map-reduce.test.ts',
  'multi-agent.test.ts',
  'rag.test.ts',
  'retry-fallback.test.ts',
  'structured-output.test.ts',
  'node-configuration.test.ts'
];

const testsDir = path.join(__dirname, '../tests');
const docsDir = path.join(__dirname, '../docs/examples');

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

function extractJSDocComment(content) {
  // Match the first JSDoc comment block
  const jsdocRegex = /\/\*\*\s*\n([\s\S]*?)\*\//;
  const match = content.match(jsdocRegex);

  if (!match) {
    return null;
  }

  // Extract the content and clean it up
  let docContent = match[1];

  // Remove leading asterisks and spaces
  docContent = docContent
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, ''))
    .join('\n');

  // Remove @fileoverview, @description tags - keep only the content
  docContent = docContent.replace(/@fileoverview\s+/g, '# ');
  docContent = docContent.replace(/@description\s+/g, '');

  // Remove @example tags but keep the content
  docContent = docContent.replace(/@example\s*/g, '\n## Example\n\n```typescript\n');

  // Close any open code blocks from examples
  const lines = docContent.split('\n');
  let inExample = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('## Example')) {
      inExample = true;
    }

    processedLines.push(line);

    // Close example code block before next section
    if (inExample && i < lines.length - 1) {
      const nextLine = lines[i + 1];
      if (nextLine.startsWith('#') && !nextLine.includes('Example')) {
        processedLines.push('```\n');
        inExample = false;
      }
    }
  }

  // If still in example at end, close it
  if (inExample) {
    processedLines.push('```');
  }

  return processedLines.join('\n').trim();
}

function generateDocs() {
  console.log('Generating documentation from JSDoc comments...\n');

  for (const file of testFiles) {
    const inputPath = path.join(testsDir, file);
    const outputFile = file.replace('.test.ts', '.md');
    const outputPath = path.join(docsDir, outputFile);

    console.log(`Processing ${file}...`);

    try {
      const content = fs.readFileSync(inputPath, 'utf8');
      const markdown = extractJSDocComment(content);

      if (markdown) {
        fs.writeFileSync(outputPath, markdown);
        console.log(`  ✓ Generated ${outputFile}`);
      } else {
        console.log(`  ⚠ No JSDoc comment found in ${file}`);
      }
    } catch (error) {
      console.error(`  ✗ Error generating ${outputFile}:`, error.message);
    }
  }

  console.log('\nDocumentation generation complete!');
}

generateDocs();
