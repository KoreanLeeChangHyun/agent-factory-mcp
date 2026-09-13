// Configuration contracts from each client's official schema, independent of the UI.
const assert = require('node:assert/strict');
const { clients, build } = require('../../static/js/mcp-clients.js');
const context = { workspaceId: '84c210bf-848c-4c1d-b615-33178c750cd5', workspaceName: '작업공간 "검증"', connectionId: 'test-connection', url: 'https://example.test/factory/mcp/workspaces/84c210bf-848c-4c1d-b615-33178c750cd5/' };
assert.equal(clients.length, 13);
const results = new Map();
for (const client of clients) {
  for (const [variant] of client.variants || [['default']]) {
    const result = build({ ...context, clientId: client.id, variant });
    results.set(`${client.id}:${variant}`, result);
    assert(result.config.includes(context.url));
    assert(result.path && result.authHelp && result.client.docs.startsWith('https://'));
    assert(!result.command.includes('PASTE_TOKEN_HERE'));
    if (!['continue', 'codex'].includes(client.id)) JSON.parse(result.config);
  }
}
const get = (id, variant='default') => results.get(`${id}:${variant}`);
const key = `agent-factory-${context.workspaceId}`;
const vs = JSON.parse(get('vscode','ide').config);
assert.equal(vs.servers[key].type, 'http');
assert(vs.inputs[0].password && vs.inputs[0].id.includes(context.connectionId));
assert.equal(JSON.parse(decodeURIComponent(get('vscode','ide').install.split('?')[1])).url, context.url);
const cursorInstall = new URL(get('cursor').install);
const cursorConfig = JSON.parse(Buffer.from(cursorInstall.searchParams.get('config'), 'base64'));
assert.equal(cursorConfig.url, context.url);
assert(cursorConfig.headers.Authorization.startsWith('Bearer ${env:'));
assert.equal(JSON.parse(get('windsurf').config).mcpServers[key].serverUrl, context.url);
assert.equal(JSON.parse(get('antigravity','ide').config).mcpServers[key].serverUrl, context.url);
assert.equal(get('antigravity','ide').path, '~/.gemini/config/mcp_config.json');
assert.equal(get('antigravity','cli').path, '.agents/mcp_config.json');
assert.equal(JSON.parse(get('zed').config).context_servers[key].url, context.url);
assert.equal(JSON.parse(get('jetbrains').config).mcpServers[key].url, context.url);
assert.equal(JSON.parse(get('cline','ide').config).mcpServers[key].type, 'streamableHttp');
assert.equal(get('cline','cli').path, '~/.cline/data/settings/cline_mcp_settings.json');
assert(get('continue').config.includes('type: streamable-http\n'));
assert(get('continue').config.includes('requestOptions:\n      headers:'));
assert(get('codex','cli').config.includes('bearer_token_env_var ='));
assert(get('codex','cli').command.includes('--bearer-token-env-var'));
assert.equal(JSON.parse(get('claude','cli').config).mcpServers[key].type, 'http');
assert(get('claude','cli').command.includes('--scope project'));
assert.equal(JSON.parse(get('gemini').config).mcpServers[key].httpUrl, context.url);
assert(get('gemini').notes.some(note => note.includes('신뢰')));
// Separate client tokens must coexist in the same inherited process environment.
assert.notEqual(get('cursor').envName, get('windsurf').envName);
assert.notEqual(get('codex','cli').envName, get('codex','ide').envName);
assert.equal(build({ ...context, connectionId: 'renewed', clientId: 'cursor', variant: 'default' }).envName, get('cursor').envName);
assert(JSON.parse(get('opencode','v2').config).mcp.servers[key]);
assert(JSON.parse(get('opencode','v1').config).mcp[key]);
assert.throws(() => build({ ...context, clientId: 'unknown', variant:'default' }));
assert.throws(() => build({ ...context, clientId: 'codex', variant:'unknown' }));
console.log(`PASS: ${clients.length} clients, ${results.size} variants, transport/config/auth/install/command contracts`);
