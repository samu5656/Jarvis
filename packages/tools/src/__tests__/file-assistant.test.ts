import { describe, it } from 'node:test';
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
} from '../index';

describe('Milestone M10 - File Assistant', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis_m10_test_'));
  const approvedDir = path.join(tmpBase, 'approved_project');
  const outsideDir = path.join(tmpBase, 'forbidden_system');

  fs.mkdirSync(approvedDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });

  const testDocPath = path.join(approvedDir, 'spec.txt');
  fs.writeFileSync(
    testDocPath,
    'JARVIS Architecture Overview.\n\nJARVIS is a modular AI assistant built with TypeScript and Node.js.\n\nAll tools run inside a strictly enforced runtime sandbox.\n'
  );

  const outsideDocPath = path.join(outsideDir, 'secret_passwords.txt');
  fs.writeFileSync(outsideDocPath, 'super_secret_admin_credentials_123');

  const allowlist = new PathAllowlist({
    project: approvedDir,
  });

  it('M10 Acceptance: Can search files within approved directory scope', async () => {
    const registry = new ToolRegistry();
    registry.register(new SearchFilesTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('search_files', {
      query: 'spec',
      directoryScope: 'project',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].name, 'spec.txt');
  });

  it('M10 Acceptance: Can extract document text inside approved directory', async () => {
    const registry = new ToolRegistry();
    registry.register(new ExtractDocumentTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('extract_document', {
      filePath: testDocPath,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.fileName, 'spec.txt');
    assert.match(res.data.content, /JARVIS Architecture Overview/);
  });

  it('M10 Acceptance: Can summarize document from approved directory', async () => {
    const registry = new ToolRegistry();
    registry.register(new SummarizeDocumentTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('summarize_document', {
      filePath: testDocPath,
      maxBullets: 3,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.bulletPoints.length > 0);
    assert.ok(res.data.summaryText.length > 0);
  });

  it('M10 Acceptance CRITICAL: Files outside configured scopes CANNOT be accessed (document extraction)', async () => {
    const registry = new ToolRegistry();
    registry.register(new ExtractDocumentTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('extract_document', {
      filePath: outsideDocPath,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /outside the approved directory scopes|access denied/i);
    assert.strictEqual(res.auditEntry.status, 'FAILED');
  });

  it('M10 Acceptance CRITICAL: Directory traversal (../../) to outside scopes CANNOT be accessed', async () => {
    const registry = new ToolRegistry();
    registry.register(new ExtractDocumentTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const traversalPath = path.join(approvedDir, '..', 'forbidden_system', 'secret_passwords.txt');
    const res = await runtime.executeTool('extract_document', {
      filePath: traversalPath,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /outside the approved directory scopes/i);
  });

  it('M10 Acceptance CRITICAL: Files outside configured scopes CANNOT be searched', async () => {
    const registry = new ToolRegistry();
    registry.register(new SearchFilesTool(allowlist));
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('search_files', {
      query: 'secret',
      directoryScope: outsideDir,
    });

    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /outside the approved directory scopes|access denied/i);
  });
});
