const { createDefaultToolRegistry, ToolRuntime, AuditLogger, PathAllowlist } = require('../packages/tools/dist/index');
const path = require('path');

async function main() {
  console.log('=== JARVIS Computer Control v1 Verification (M6) ===\n');

  // Configure Path Allowlist with approved projects including FlowForge
  const allowlist = new PathAllowlist({
    flowforge: path.resolve(__dirname, '../..'), // current workspace or project
    jarvis: path.resolve(__dirname, '..'),
  });

  const registry = createDefaultToolRegistry(allowlist);
  const auditLogger = new AuditLogger();
  const runtime = new ToolRuntime(registry, auditLogger);

  console.log('Approved Application Allowlist: vscode, notepad, terminal, explorer, calculator, chrome, browser');
  console.log('Approved Path Scopes:');
  for (const entry of allowlist.getApprovedList()) {
    console.log(` - ${entry.alias} -> ${entry.absolutePath}`);
  }

  console.log('\n--- Test 1: Open VS Code (Approved Application) ---');
  const appRes = await runtime.executeTool('open_application', { appId: 'vscode' });
  console.log('Success: ', appRes.success);
  console.log('Data:    ', JSON.stringify(appRes.data));
  console.log('Status:  ', appRes.auditEntry.status);

  console.log('\n--- Test 2: Open FlowForge (Approved Project Path) ---');
  const folderRes = await runtime.executeTool('open_folder', { path: 'FlowForge' });
  console.log('Success: ', folderRes.success);
  console.log('Data:    ', JSON.stringify(folderRes.data));
  console.log('Status:  ', folderRes.auditEntry.status);

  console.log('\n--- Test 3: Reject Unapproved Path (C:\\Windows\\System32) ---');
  const unapprovedPathRes = await runtime.executeTool('open_folder', { path: 'C:\\Windows\\System32' });
  console.log('Success: ', unapprovedPathRes.success);
  console.log('Error:   ', unapprovedPathRes.error);
  console.log('Status:  ', unapprovedPathRes.auditEntry.status);

  console.log('\n--- Test 4: Reject Unapproved Application (unauthorized_app.exe) ---');
  const unapprovedAppRes = await runtime.executeTool('open_application', { appId: 'unauthorized_app.exe' });
  console.log('Success: ', unapprovedAppRes.success);
  console.log('Error:   ', unapprovedAppRes.error);
  console.log('Status:  ', unapprovedAppRes.auditEntry.status);

  console.log('\n--- Test 5: Open Web URL (Approved HTTPS) ---');
  const urlRes = await runtime.executeTool('open_url', { url: 'https://github.com' });
  console.log('Success: ', urlRes.success);
  console.log('Data:    ', JSON.stringify(urlRes.data));
  console.log('Status:  ', urlRes.auditEntry.status);

  console.log('\n--- Test 6: Global Kill Switch Immediate Computer-Control Halt ---');
  runtime.setKillSwitch(true);
  const killSwitchRes = await runtime.executeTool('open_application', { appId: 'vscode' });
  console.log('Kill Switch Active: ', runtime.isKillSwitchActive());
  console.log('Success:            ', killSwitchRes.success);
  console.log('Error:              ', killSwitchRes.error);
  console.log('Status:             ', killSwitchRes.auditEntry.status);
  runtime.setKillSwitch(false); // Reset

  console.log('\n============================================================');
  const passedCriteria =
    appRes.success &&
    folderRes.success &&
    !unapprovedPathRes.success &&
    !unapprovedAppRes.success &&
    urlRes.success &&
    !killSwitchRes.success;

  if (passedCriteria) {
    console.log('M6 Acceptance Criteria: PASSED');
    console.log('“Open VS Code” and “open FlowForge” work; unapproved paths/apps are rejected.');
  }
  console.log('============================================================');
}

main();
