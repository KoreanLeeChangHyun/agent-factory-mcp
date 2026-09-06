/* Client configuration adapters. Sources and verified versions: config/mcp-clients.md. */
(() => {
  const clients = [
    { id: 'vscode', label: 'VS Code · Copilot', variants: [['ide', 'IDE · Copilot']], path: '.vscode/mcp.json', docs: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers', auth: 'prompt' },
    { id: 'cursor', label: 'Cursor', path: '.cursor/mcp.json', docs: 'https://prod.cursor.com/docs/mcp', auth: 'env' },
    { id: 'windsurf', label: 'Windsurf · Cascade', path: '~/.codeium/windsurf/mcp_config.json', docs: 'https://docs.windsurf.com/windsurf/cascade/mcp', auth: 'env' },
    { id: 'jetbrains', label: 'JetBrains · AI Assistant', path: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add → HTTP', docs: 'https://www.jetbrains.com/help/ai-assistant/mcp.html', auth: 'paste' },
    { id: 'zed', label: 'Zed', path: '사용자 settings.json → context_servers', docs: 'https://zed.dev/docs/ai/mcp', auth: 'paste' },
    { id: 'kiro', label: 'Kiro', path: '.kiro/settings/mcp.json', docs: 'https://kiro.dev/docs/mcp/configuration/', auth: 'env' },
    { id: 'antigravity', label: 'Antigravity', variants: [['ide', 'IDE'], ['cli', 'CLI']], path: '~/.gemini/config/mcp_config.json', docs: 'https://www.antigravity.google/docs/mcp', auth: 'paste' },
    { id: 'cline', label: 'Cline', variants: [['ide', 'IDE 확장'], ['cli', 'CLI']], path: 'Cline → MCP Servers → Configure → Configure MCP Servers', docs: 'https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx', auth: 'paste' },
    { id: 'continue', label: 'Continue', path: '.continue/mcpServers/agent-factory.yaml', docs: 'https://docs.continue.dev/reference', auth: 'paste' },
    { id: 'codex', label: 'Codex', variants: [['ide', 'IDE 확장'], ['cli', 'CLI']], path: '.codex/config.toml (신뢰한 프로젝트)', docs: 'https://developers.openai.com/codex/mcp/', auth: 'env' },
    { id: 'claude', label: 'Claude Code', variants: [['cli', 'CLI'], ['ide', 'IDE 확장']], path: '.mcp.json', docs: 'https://code.claude.com/docs/en/mcp', auth: 'env' },
    { id: 'gemini', label: 'Gemini CLI', path: '.gemini/settings.json', docs: 'https://geminicli.com/docs/tools/mcp-server/', auth: 'env' },
    { id: 'opencode', label: 'OpenCode', variants: [['v1', 'V1'], ['v2', 'V2 · 베타']], path: 'opencode.json', docs: 'https://opencode.ai/v2/docs/mcp-servers', auth: 'env' },
  ];
  const json = value => JSON.stringify(value, null, 2);
  const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
  const build = ({ clientId, variant, workspaceId, connectionId = '', workspaceName, url }) => {
    const client = clients.find(row => row.id === clientId);
    if (!client) throw new Error('Unknown MCP client');
    const variants = client.variants || [['default', '기본']];
    if (!variants.some(([id]) => id === variant)) throw new Error('Unknown client variant');
    const key = `agent-factory-${workspaceId}`;
    const envName = `AF_MCP_${workspaceId.replaceAll('-', '_').toUpperCase()}_${clientId.toUpperCase()}_${variant.toUpperCase()}`;
    const inputId = `agentFactoryToken-${workspaceId}${connectionId ? `-${connectionId}` : ''}`;
    let auth = 'Bearer PASTE_TOKEN_HERE';
    if (['cursor', 'windsurf'].includes(clientId)) auth = `Bearer \${env:${envName}}`;
    if (['kiro', 'claude', 'gemini'].includes(clientId)) auth = `Bearer \${${envName}}`;
    if (clientId === 'opencode') auth = `Bearer {env:${envName}}`;
    const headers = { Authorization: auth };
    let value = { mcpServers: { [key]: { url, headers } } };
    let install = null, command = '', path = client.path;
    if (clientId === 'vscode') {
      const server = { type: 'http', url, headers: { Authorization: `Bearer \${input:${inputId}}` } };
      const inputs = [{ id: inputId, type: 'promptString', description: `${workspaceName} MCP 연결용 토큰`, password: true }];
      value = { servers: { [key]: server }, inputs };
      install = `vscode:mcp/install?${encodeURIComponent(json({ name: key, ...server, inputs }))}`;
    } else if (clientId === 'cursor') {
      const bytes = new TextEncoder().encode(json({ url, headers }));
      const base64 = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
      install = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(key)}&config=${encodeURIComponent(base64)}`;
    } else if (['windsurf', 'antigravity'].includes(clientId)) {
      value = { mcpServers: { [key]: { serverUrl: url, headers } } };
      if (clientId === 'antigravity' && variant === 'cli') path = '.agents/mcp_config.json';
    } else if (clientId === 'zed') {
      value = { context_servers: { [key]: { url, headers } } };
    } else if (clientId === 'cline') {
      value = { mcpServers: { [key]: { type: 'streamableHttp', url, headers, disabled: false, autoApprove: [] } } };
      if (variant === 'cli') path = '~/.cline/data/settings/cline_mcp_settings.json';
    } else if (clientId === 'continue') {
      value = `name: Agent Factory\nversion: 1.0.0\nschema: v1\nmcpServers:\n  - name: ${key}\n    type: streamable-http\n    url: ${json(url)}\n    requestOptions:\n      headers:\n        Authorization: ${json(auth)}\n`;
    } else if (clientId === 'codex') {
      value = `[mcp_servers.${key}]\nurl = ${json(url)}\nbearer_token_env_var = ${json(envName)}\n`;
      if (variant === 'cli') command = `codex mcp add ${shellQuote(key)} --url ${shellQuote(url)} --bearer-token-env-var ${shellQuote(envName)}`;
    } else if (clientId === 'claude') {
      value = { mcpServers: { [key]: { type: 'http', url, headers } } };
      if (variant === 'cli') command = `claude mcp add-json --scope project ${shellQuote(key)} ${shellQuote(json(value.mcpServers[key]))}`;
    } else if (clientId === 'gemini') {
      value = { mcpServers: { [key]: { httpUrl: url, headers } } };
    } else if (clientId === 'opencode') {
      const server = { type: 'remote', url, oauth: false, headers };
      value = variant === 'v2' ? { mcp: { servers: { [key]: server } } } : { mcp: { [key]: server } };
    }
    const authHelp = client.auth === 'prompt'
      ? '서버를 시작하면 열리는 비밀번호 입력창에 발급된 토큰을 입력하세요. 재발급 시 서버 설정과 inputs를 함께 갱신하면 새 입력창이 열립니다.'
      : client.auth === 'env'
        ? `${envName} 환경변수에 발급된 토큰을 저장하고, 해당 변수를 읽을 수 있는 환경에서 클라이언트를 실행하세요. 재발급 시 환경변수를 갱신하고 클라이언트를 다시 시작하세요.`
        : '개인 설정에서 PASTE_TOKEN_HERE를 발급된 토큰으로 바꾸세요. 토큰을 넣은 파일은 저장소에 커밋하지 마세요. 재발급 시 토큰 값을 교체하고 서버를 다시 시작하세요.';
    const notes = [];
    if (clientId === 'vscode') notes.push('이 설정은 Copilot의 VS Code MCP 연결용입니다. Agent Host는 대화형 inputs 설정을 전달하지 않으므로 같은 설정으로 연결됐다고 간주하지 마세요.');
    if (clientId === 'kiro') notes.push('환경변수 참조는 Kiro의 Mcp Approved Env Vars 설정에서 해당 변수 사용을 승인해야 합니다.');
    if (clientId === 'gemini') notes.push('Gemini CLI에서 이 프로젝트를 신뢰해야 MCP 서버가 활성화됩니다. 연결 목록에 Disabled로 표시되면 프로젝트 신뢰 설정을 확인하세요.');
    if (clientId === 'jetbrains') notes.push('현재 프로젝트에 연결하려면 Server level을 Project로 선택하고 Apply를 누르세요. 설정은 프로젝트의 .ai/mcp/mcp.json에 저장됩니다.');
    if (clientId === 'antigravity' && variant === 'cli') notes.push('프로젝트 설정은 로그인 후 대화형 /mcp에서 확인하세요. CLI 1.1.27의 mcp list는 전역 설정 목록을 표시하며, enabled는 연결 성공 상태를 뜻하지 않습니다.');
    if (clientId === 'opencode' && variant === 'v2') notes.push('V2는 opencode2로 실행하는 베타 버전입니다. 기존 opencode를 사용한다면 V1 설정을 선택하세요. 토큰 환경변수를 바꾼 뒤에는 백그라운드 서버도 다시 시작하세요.');
    if (clientId === 'cursor') notes.push('원격 MCP 설정은 envFile을 지원하지 않습니다. Cursor 프로세스가 환경변수를 읽을 수 있어야 합니다.');
    if (clientId === 'codex' && variant === 'cli') notes.push('아래 등록 명령은 사용자 설정에 서버를 추가합니다. 프로젝트에만 적용하려면 위 프로젝트 설정 파일을 사용하세요.');
    return { client, key, path, envName, config: typeof value === 'string' ? value : json(value), install, command, authHelp, notes };
  };
  const api = { clients, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.agentFactoryMCPClients = api;
})();
