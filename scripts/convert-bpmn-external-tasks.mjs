/**
 * Convert BPMN service tasks from Java delegateExpression pattern
 * to External Task pattern for use with the Node.js worker.
 * 
 * Before: camunda:delegateExpression="${delegateName}"
 * After:  camunda:type="external" camunda:topic="delegateName"
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const BPMN_DIR = resolve(import.meta.dirname, '..', 'processes');

async function convertFile(filePath) {
  let content = await readFile(filePath, 'utf8');
  const original = content;

  // Replace camunda:delegateExpression="${name}" with camunda:type="external" camunda:topic="name"
  content = content.replace(
    /camunda:delegateExpression="\$\{(\w+)\}"/g,
    'camunda:type="external" camunda:topic="$1"'
  );

  if (content !== original) {
    await writeFile(filePath, content, 'utf8');
    const count = (original.match(/delegateExpression/g) || []).length;
    return count;
  }
  return 0;
}

async function main() {
  const allEntries = await readdir(BPMN_DIR, { recursive: true });
  const bpmnFiles = allEntries.filter(f => f.endsWith('.bpmn'));
  
  let totalConverted = 0;
  let filesChanged = 0;
  
  for (const relPath of bpmnFiles) {
    const fullPath = join(BPMN_DIR, relPath);
    const count = await convertFile(fullPath);
    if (count > 0) {
      console.log(`Converted ${count} delegates in: ${relPath}`);
      totalConverted += count;
      filesChanged++;
    }
  }
  console.log(`\nDone: ${totalConverted} delegate references converted in ${filesChanged}/${bpmnFiles.length} files`);
}

main().catch(console.error);
