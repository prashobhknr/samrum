/**
 * Deploy all BPMN files from processes/ to Operaton (Camunda 7 REST API).
 * Uses deploy-changed-only so restarts don't create duplicate versions.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CAMUNDA_BASE = process.env.CAMUNDA_BASE || 'http://localhost:8080/engine-rest';
const BPMN_DIR = resolve(__dirname, '../../..', 'processes');

export async function deployAllBpmns() {
  const allEntries = await readdir(BPMN_DIR, { recursive: true });
  const bpmnRelPaths = allEntries.filter(f => f.endsWith('.bpmn'));

  if (bpmnRelPaths.length === 0) {
    throw new Error(`No .bpmn files found in ${BPMN_DIR}`);
  }

  let deployed = 0;
  let skipped = 0;
  const failures = [];

  for (const relPath of bpmnRelPaths) {
    const fullPath = join(BPMN_DIR, relPath);
    const content = await readFile(fullPath);

    const form = new FormData();
    form.append('deployment-name', `doorman-${relPath.replace(/[\\/]/g, '-').replace('.bpmn', '')}`);
    form.append('enable-duplicate-filtering', 'true');
    form.append('deploy-changed-only', 'true');
    form.append('deployment-source', 'doorman-backend');

    const blob = new Blob([content], { type: 'application/xml' });
    form.append(relPath.replace(/[\\/]/g, '_'), blob, relPath);

    try {
      const res = await fetch(`${CAMUNDA_BASE}/deployment/create`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        failures.push({ file: relPath, error: text.slice(0, 200) });
        skipped++;
      } else {
        const result = await res.json();
        const newDefs = Object.keys(result.deployedProcessDefinitions || {}).length;
        if (newDefs > 0) deployed++;
      }
    } catch (err) {
      failures.push({ file: relPath, error: err.message });
      skipped++;
    }
  }

  if (failures.length > 0) {
    console.warn(`[Operaton] ${failures.length} BPMN files failed to deploy:`);
    for (const f of failures) {
      console.warn(`  - ${f.file}: ${f.error.slice(0, 120)}`);
    }
  }

  console.log(`[Operaton] BPMN deployment complete: ${bpmnRelPaths.length} files, ${deployed} new, ${skipped} failed`);
  return { total: bpmnRelPaths.length, deployed, skipped, failures };
}
