import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  ToolRegistry,
  ToolRuntime,
  SearchFilesTool,
  ExtractDocumentTool,
  SummarizeDocumentTool,
  PathAllowlist,
} from '../packages/tools/dist/index.js';

async function testFileAssistant() {
  console.log('Testing M10: File Assistant (Search, Extraction, Summarization, Scope Boundaries)...');

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis_m10_verifier_'));
  const approvedDir = path.join(tmpBase, 'approved_project');
  const forbiddenDir = path.join(tmpBase, 'forbidden_system');

  fs.mkdirSync(approvedDir, { recursive: true });
  fs.mkdirSync(forbiddenDir, { recursive: true });

  const testFile = path.join(approvedDir, 'guide.md');
  fs.writeFileSync(
    testFile,
    '# Getting Started with Jarvis\n\nJarvis is your personal AI workstation assistant.\n\nIt enforces strict boundary sandboxing across all tools and local files.\n\nEnsure external calls are guarded with user confirmation.'
  );

  const outsideFile = path.join(forbiddenDir, 'system_shadow.db');
  fs.writeFileSync(outsideFile, 'CRITICAL_SYSTEM_SECRETS_NOT_ACCESSIBLE');

  const allowlist = new PathAllowlist({
    project: approvedDir,
  });

  const registry = new ToolRegistry();
  registry.register(new SearchFilesTool(allowlist));
  registry.register(new ExtractDocumentTool(allowlist));
  registry.register(new SummarizeDocumentTool(allowlist));
  const runtime = new ToolRuntime(registry);

  // 1. Search Files inside approved scope
  const searchRes = await runtime.executeTool('search_files', {
    query: 'guide',
    directoryScope: 'project',
  });
  assert.strictEqual(searchRes.success, true);
  assert.strictEqual(searchRes.data.length, 1);
  assert.strictEqual(searchRes.data[0].name, 'guide.md');
  console.log('✔ Search within approved directory succeeded');

  // 2. Extract Document inside approved scope
  const extractRes = await runtime.executeTool('extract_document', {
    filePath: testFile,
  });
  assert.strictEqual(extractRes.success, true);
  assert.match(extractRes.data.content, /Getting Started with Jarvis/);
  console.log('✔ Document extraction inside approved directory succeeded');

  // 3. Summarize Document
  const sumRes = await runtime.executeTool('summarize_document', {
    filePath: testFile,
  });
  assert.strictEqual(sumRes.success, true);
  assert.ok(sumRes.data.bulletPoints.length > 0);
  assert.ok(sumRes.data.summaryText.length > 0);
  console.log('✔ Document summarization succeeded');

  // 4. M10 ACCEPTANCE CRITICAL: Files outside configured scopes CANNOT be accessed
  const forbiddenExtract = await runtime.executeTool('extract_document', {
    filePath: outsideFile,
  });
  assert.strictEqual(forbiddenExtract.success, false);
  assert.match(forbiddenExtract.error || '', /outside the approved directory scopes/i);
  console.log('✔ ACCEPTANCE: Access to unauthorized file strictly rejected');

  // 5. M10 ACCEPTANCE CRITICAL: Traversal attack to outside scopes CANNOT be accessed
  const traversalFile = path.join(approvedDir, '..', 'forbidden_system', 'system_shadow.db');
  const traversalExtract = await runtime.executeTool('extract_document', {
    filePath: traversalFile,
  });
  assert.strictEqual(traversalExtract.success, false);
  assert.match(traversalExtract.error || '', /outside the approved directory scopes/i);
  console.log('✔ ACCEPTANCE: Directory traversal (..) to outside scopes strictly rejected');

  // 6. Search in unauthorized directory scope rejected
  const forbiddenSearch = await runtime.executeTool('search_files', {
    query: 'shadow',
    directoryScope: forbiddenDir,
  });
  assert.strictEqual(forbiddenSearch.success, false);
  console.log('✔ ACCEPTANCE: Search in unapproved directory scope strictly rejected');

  console.log('\nAll M10 File Assistant acceptance tests passed successfully!');
}

testFileAssistant().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
