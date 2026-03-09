/**
 * Fix BPMN XSD element ordering: move <bpmn:incoming> and <bpmn:outgoing>
 * before any *EventDefinition elements within the same parent.
 * 
 * BPMN 2.0 XSD requires: incoming, outgoing, then eventDefinition.
 * Many modelers place outgoing after eventDefinition, causing parse errors.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const BPMN_DIR = resolve(import.meta.dirname, '..', 'processes');

// Regex to match a BPMN element block that contains both an eventDefinition and outgoing/incoming in wrong order
// We need to find elements where outgoing/incoming appears AFTER eventDefinition

async function fixBpmnFile(filePath) {
  let content = await readFile(filePath, 'utf8');
  const original = content;

  // Normalize to LF for regex processing, restore CRLF at end if needed
  const hadCRLF = content.includes('\r\n');
  if (hadCRLF) content = content.replace(/\r\n/g, '\n');

  // Fix pattern: <bpmn:*EventDefinition .../> followed by <bpmn:outgoing> or <bpmn:incoming>
  // These need to be swapped so outgoing/incoming comes first
  
  // Match: (eventDefinition line(s)) followed by (outgoing/incoming lines)
  // Pattern 1: Single-line eventDefinition followed by one or more outgoing/incoming
  content = content.replace(
    /(<bpmn:\w*EventDefinition[^>]*\/>\s*\n)((?:\s*<bpmn:(?:outgoing|incoming)>[^<]+<\/bpmn:(?:outgoing|incoming)>\s*\n)+)/g,
    '$2$1'
  );

  // Pattern 2: Multi-line eventDefinition block followed by one or more outgoing/incoming  
  content = content.replace(
    /(<bpmn:\w*EventDefinition[^\/]*>\s*\n(?:.*\n)*?\s*<\/bpmn:\w*EventDefinition>\s*\n)((?:\s*<bpmn:(?:outgoing|incoming)>[^<]+<\/bpmn:(?:outgoing|incoming)>\s*\n)+)/g,
    '$2$1'
  );

  // Restore CRLF if original had it
  if (hadCRLF) content = content.replace(/\n/g, '\r\n');

  if (content !== original) {
    await writeFile(filePath, content, 'utf8');
    return true;
  }
  return false;
}

async function main() {
  const allEntries = await readdir(BPMN_DIR, { recursive: true });
  const bpmnFiles = allEntries.filter(f => f.endsWith('.bpmn'));
  
  let fixed = 0;
  for (const relPath of bpmnFiles) {
    const fullPath = join(BPMN_DIR, relPath);
    const changed = await fixBpmnFile(fullPath);
    if (changed) {
      console.log(`Fixed: ${relPath}`);
      fixed++;
    }
  }
  console.log(`\nDone: ${fixed}/${bpmnFiles.length} files fixed`);
}

main().catch(console.error);
