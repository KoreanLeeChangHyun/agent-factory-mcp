/* Connection evidence belongs to the server; secrets live only in this view. */
(() => {
  const view = document.querySelector('[data-mcp-onboarding]');
  const ui = window.agentFactoryUI;
  view.classList.add('af-kit');
  const main = view.closest('main');
  const adapters = window.agentFactoryMCPClients;
  const el = name => view.querySelector(`[data-mcp-${name}]`);
  for (const [name, label] of [['client','클라이언트'],['variant','사용 환경'],['token-select','연결 토큰'],['ai-text','파일 전달용 AI 연결 지침']]) {
    const control = el(name), caption = control.parentElement;
    const field = ui.fieldFor({label, control});
    // Keep owner lookup/visibility attributes on the replacement field container.
    for (const attribute of caption.attributes) field.root.setAttribute(attribute.name, attribute.value);
    field.root.classList.add('af-field');
    caption.replaceWith(field.root);
  }
  for (const name of ['command','config','token']) {
    const control = el(name), root = control.parentElement, header = root.firstElementChild;
    ui.bindCodeOperation({root, header, label:header.querySelector('label'), control,
      help:root.querySelector('p')});
  }
  el('token-refresh').replaceChildren(ui.icon('refresh'));
  let notifications = null;
  let current = null, generation = 0, requestVersion = 0, timer = null, verified = false, manual = false;
  let selectedId = '', selectionVersion = 0, busy = false, downloaded = null;
  const selectionKey = () => `afMcpToken:${current?.userId || 'user'}:${current?.organizationId}:${current?.workspaceId}:${clientName()}`;
  const viewKey = () => `afMcpView:${current?.userId}:${current?.organizationId}:${current?.workspaceId}`;
  const rememberClient = () => { try { localStorage.setItem(viewKey(), JSON.stringify({client: el('client').value, variant: el('variant').value, manual})); } catch {} };
  const rememberToken = () => { try { localStorage.setItem(selectionKey(), selectedId); } catch { /* Optional preference only. */ } };
  const invalidateFile = () => { downloaded = null; clearAICopy(); };
  const clearAICopy = () => {
    el('ai-text').value = ''; el('ai-fallback').hidden = true; el('ai-message').textContent = '';
  };
  const display = () => {
    el('copy-ai').textContent = 'AI 지침 복사';
    el('download').disabled = !selectedId || !el('token').value || busy;
    el('copy-ai').disabled = !selectedId || !el('token').value || busy;
    el('ai-help').textContent = !selectedId
      ? '사용할 토큰을 선택하세요. 새 토큰은 오른쪽에서 발급합니다.'
      : downloaded
        ? '설정 파일을 다운로드했습니다. 연결할 프로젝트 디렉터리에 넣고 2단계를 진행하세요.'
        : '선택한 토큰으로 설정 파일을 다운로드하세요.';
    const visible = Boolean(current) && (!verified || manual);
    view.hidden = !visible;
    main.dataset.connectionRequired = String(visible);
    el('dismiss').hidden = !verified || !document.querySelector('[data-activity].is-active');
    const locked = Boolean(current) && !verified;
    document.querySelector('[data-workspace-shell]').dataset.mcpLocked = String(locked);
    document.querySelectorAll('[data-activity]').forEach(button => {
      button.disabled = locked;
      button.setAttribute('aria-disabled', String(locked));
      if (locked && !button.hasAttribute('data-mcp-original-title')) {
        button.dataset.mcpOriginalTitle = button.title;
        button.title = `${button.title || button.textContent.trim()} · MCP 연결 후 사용할 수 있습니다`;
      } else if (!locked && button.hasAttribute('data-mcp-original-title')) {
        button.title = button.dataset.mcpOriginalTitle;
        delete button.dataset.mcpOriginalTitle;
      }
    });
    const sidebar = document.querySelector('.primary-sidebar');
    sidebar?.querySelectorAll('[data-sidebar-view]').forEach(section => {
      section.inert = locked && !['organization', 'workspaces'].includes(section.dataset.sidebarView);
    });

  };
  const reset = () => {
    notifications?.destroy(); notifications = null;
    generation += 1;
    clearTimeout(timer);
    current = null; verified = false; manual = false;
    selectedId = ''; selectionVersion += 1; downloaded = null; busy = false;
    el('token-select').replaceChildren();
    clearAICopy();
    el('token').value = '';
    el('secret').hidden = true;
    el('message').textContent = '';
    el('token-message').textContent = '';
    el('token-list-state').textContent = '토큰 목록을 불러오는 중입니다.';
    el('connections').replaceChildren();
    el('enroll').disabled = false;
    display();
  };
  const refresh = async () => {
    if (!current) return;
    clearTimeout(timer);
    const version = generation, request = ++requestVersion, context = current;
    try {
      const data = await context.api(context.path);
      if (version !== generation || request !== requestVersion) return;
      if (!['pending', 'verified', 'reauth_required'].includes(data.state) || !Array.isArray(data.connections)) throw new Error('Invalid connection status');
      const names = [clientName()];
      if (el('client').value === 'vscode') names.push('VS Code', 'VS Code · Copilot · IDE · Copilot');
      const rows = data.connections.filter(row => names.includes(row.name));
      const usable = rows.filter(row => row.retrievable && ['pending', 'verified'].includes(row.state));
      const selection = usable.find(row => row.id === selectedId);
      if (!selection) {
        selectedId = usable[0]?.id || '';
        selectionVersion += 1; invalidateFile(); el('token').value = ''; el('secret').hidden = true;
      }
      el('token-select').replaceChildren(new Option('유효한 토큰 선택', ''), ...usable.map(row =>
        new Option('토큰 · ' + row.id.slice(0, 8), row.id)));
      el('token-select').value = selectedId;
      if (current.inputConnectionId !== selectedId) {
        current.inputConnectionId = selectedId;
        configure(current, selectedId);
      }
      const selected = rows.find(row => row.id === selectedId);
      if (selected && (!selected.retrievable || selected.state === 'reauth_required')) {
        el('token').value = ''; el('secret').hidden = true; invalidateFile();
        el('token-message').textContent = selected.state === 'reauth_required'
          ? '선택한 토큰이 만료되었거나 폐기되었습니다. 유효한 토큰을 선택하세요.'
          : '이전 토큰은 원문이 저장되지 않아 조회할 수 없습니다. 새 토큰을 발급하세요.';
      } else if (selected && !el('token').value) {
        await retrieveToken(false);
        if (version !== generation || request !== requestVersion) return;
      }
      if (!downloaded && selectedId && el('token').value) {
        try {
          const saved = JSON.parse(localStorage.getItem(selectionKey() + ':download') || 'null');
          if (saved?.tokenId === selectedId && typeof saved.filename === 'string' && typeof saved.instruction === 'string') downloaded = saved;
        } catch { /* Download history is optional and contains no credentials. */ }
      }
      verified = data.state === 'verified';
      rememberToken();
      const diagnostic = /connection-check|diagnostic|verification/i.test(selected?.client_name || '');
      const connected = selected?.state === 'verified' && !diagnostic;
      el('status').dataset.state = connected ? 'connected' : 'pending';
      el('status').textContent = connected ? 'MCP 연결됨' : diagnostic ? '서버 통신 확인 · 클라이언트 연결 확인 필요' : selected ? 'MCP 연결 대기' : '연결 토큰 선택 필요';
      if (connected) {
        const noticeKey = viewKey() + ':confirmed:' + selected.id;
        try {
          if (!localStorage.getItem(noticeKey)) {
            localStorage.setItem(noticeKey, '1');
            notifications ||= window.agentFactoryToasts.createToastManager(document.body,{id:'mcp-notifications'});
            notifications.show({id:noticeKey,type:'success',title:clientName() + ' MCP 연결이 확인되었습니다.',duration:4500});
          }
        } catch { /* Optional notification preference. */ }
      }
      el('token-list-state').textContent = !rows.length ? '발급한 연결 토큰이 없습니다.' : !usable.length ? '선택 가능한 유효한 토큰이 없습니다. 원문이 없는 이전 토큰은 새로 발급하세요.' : '';
      el('connections').replaceChildren(...rows.map(row => {
        const li = document.createElement('li');
        const status = { pending: '연결 대기', verified: /connection-check|diagnostic|verification/i.test(row.client_name || '') ? '서버 통신 확인' : 'MCP 연결됨', reauth_required: row.reason === 'expired' ? '만료' : '폐기됨' }[row.state];
        const details = document.createElement('div'); details.className = 'mcp-token-details';
        const name = document.createElement('strong'); name.textContent = row.name;
        const connected = row.state === 'verified' && !/connection-check|diagnostic|verification/i.test(row.client_name || '');
        const state = ui.badge(status, connected ? 'success' : row.state === 'reauth_required' ? 'warning' : 'neutral');
        state.classList.add('mcp-token-state');
        state.dataset.state = row.state === 'verified' && !/connection-check|diagnostic|verification/i.test(row.client_name || '') ? 'connected' : row.state;
        const seen = document.createElement('span'); seen.className = 'mcp-token-seen';
        seen.textContent = row.last_seen_at ? `마지막 요청 · ${new Date(row.last_seen_at).toLocaleString()}` : '마지막 요청 · 없음';
        const identity = document.createElement('span'); identity.textContent = 'ID · ' + row.id.slice(0, 8);
        details.append(name, identity, state, seen);
        if (row.client_name && row.client_name !== row.name) {
          const client = document.createElement('span'); client.textContent = `확인된 클라이언트 · ${row.client_name}`; details.append(client);
        }
        li.append(details);
        if (row.reason !== 'revoked') {
          const button = ui.button({label:'토큰 폐기',variant:'danger'});
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await context.api(`${context.path}/${row.id}`, { method: 'DELETE' });
              if (version === generation) {
                if (selectedId === row.id) { el('token').value = ''; el('secret').hidden = true; selectionVersion += 1; invalidateFile(); }
                el('token-message').textContent = '토큰을 폐기했습니다.';
                display();
                await refresh();
              }
            }
            catch { if (version === generation) { el('token-message').textContent = '토큰을 폐기하지 못했습니다. 다시 시도하세요.'; button.disabled = false; } }
          });
          li.append(button);
        }
        if (row.reason === 'revoked') {
          const button = ui.button({label:'영구 삭제',variant:'danger'});
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await context.api(`${context.path}/${row.id}/purge`, { method: 'DELETE' });
              if (version === generation) { el('token-message').textContent = '폐기된 토큰을 영구 삭제했습니다.'; await refresh(); }
            } catch { if (version === generation) { button.disabled = false; el('token-message').textContent = '영구 삭제하지 못했습니다. 다시 시도하세요.'; } }
          });
          li.append(button);
        }
        return li;
      }));
    } catch (error) {
      if (version !== generation || request !== requestVersion) return;
      verified = false; el('token').value = ''; el('secret').hidden = true; invalidateFile();
      el('connections').replaceChildren();
      el('token-list-state').textContent = '토큰 목록을 불러오지 못했습니다. 목록 새로고침으로 다시 시도하세요.';
      el('status').textContent = error.status === 401 ? '로그인이 만료되었습니다. 다시 로그인한 후 연결 상태를 확인하세요.' : error.status === 403 || error.status === 404 ? '이 작업공간에 접근할 수 없습니다. 작업공간 목록에서 접근 권한을 확인하세요.' : '연결 상태를 확인하지 못했습니다. 다시 확인해 주세요.';
    } finally {
      if (version === generation && request === requestVersion) { display(); timer = setTimeout(() => { if (!document.hidden) void refresh(); }, verified ? 30000 : 3000); }
    }
  };
  const clientName = () => {
    const client = adapters.clients.find(row => row.id === el('client').value);
    const variant = client.variants?.length > 1 ? client.variants.find(([id]) => id === el('variant').value) : null;
    return variant ? `${client.label} · ${variant[1]}` : client.label;
  };
  const configure = (context, connectionId = '') => {
    const url = `${location.origin}${context.rootPath}/mcp/workspaces/${context.workspaceId}/`;
    const result = adapters.build({ clientId: el('client').value, variant: el('variant').value, workspaceId: context.workspaceId, connectionId, workspaceName: context.name, url });
    el('token-client').textContent = `발급 대상 · ${clientName()}`;
    el('url').value = url;
    el('config').value = result.config;
    const lines = result.config.trimEnd().split('\n');
    el('config').rows = Math.max(2, lines.length);
    el('url').title = url;
    el('config-label').textContent = `설정 위치 · ${result.path}`;
    const authHelp = result.client.auth === 'env'
      ? '설정에 지정된 환경변수에 토큰을 저장하고 클라이언트를 실행하세요. 토큰 변경 후에는 클라이언트를 재시작하세요.'
      : result.authHelp;
    const notes = result.notes.join(' ');
    el('config-help').textContent = [authHelp, notes].filter(Boolean).join(' ');
    el('command-help').textContent = [authHelp, el('client').value === 'codex' && el('variant').value === 'cli'
      ? '등록 명령은 사용자 설정에 서버를 추가합니다.'
      : notes].filter(Boolean).join(' ');
    el('install').hidden = !result.install;
    if (result.install) { el('install').href = result.install; el('install').textContent = `${result.client.label}에서 설정 추가`; }
    else el('install').removeAttribute('href');
    el('command').value = result.command;
    el('command').rows = Math.max(1, result.command.trimEnd().split('\n').length);
    el('command-mode').hidden = !result.command;
    el('config-mode').hidden = Boolean(result.command);
    el('docs').href = result.client.docs;
  };
  const options = rows => rows.map(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; return option; });
  el('client').replaceChildren(...options(adapters.clients.map(row => [row.id, row.label])));
  const variants = () => {
    const client = adapters.clients.find(row => row.id === el('client').value);
    el('variant').replaceChildren(...options(client.variants || [['default', '기본']]));
    el('variant-label').hidden = !client.variants || client.variants.length < 2;
  };
  variants();
  const changeClient = () => {
    if (!current) return;
    rememberClient();
    selectionVersion += 1; requestVersion += 1; invalidateFile();
    el('token').value = ''; el('secret').hidden = true;
    el('connections').replaceChildren(); el('token-select').replaceChildren();
    el('token-message').textContent = ''; el('message').textContent = '';
    try { selectedId = localStorage.getItem(selectionKey()) || ''; } catch { selectedId = ''; }
    configure(current, selectedId); display(); void refresh();
  };
  el('client').addEventListener('change', () => { variants(); changeClient(); });
  el('variant').addEventListener('change', changeClient);
  const open = context => {
    reset(); manual = true; current = { ...context, path: `/api/organizations/${context.organizationId}/workspaces/${context.workspaceId}/mcp-connections` };
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey()) || 'null');
      el('client').value = adapters.clients.some(row => row.id === saved?.client) ? saved.client : adapters.clients[0].id;
      variants();
      if ([...el('variant').options].some(option => option.value === saved?.variant)) el('variant').value = saved.variant;
      selectedId = localStorage.getItem(selectionKey()) || '';
    } catch { selectedId = ''; }
    configure(current, selectedId);
    el('workspace').textContent = context.name;
    el('workspace').title = context.name;
    el('status').textContent = '연결 상태를 확인하고 있습니다.';
    display(); void refresh();
  };
  const enroll = async () => {
    if (!current || el('enroll').disabled) return;
    const version = generation, context = current, requestedClient = clientName();
    manual = true;
    el('enroll').disabled = true;
    clearAICopy();
    el('token-message').textContent = '토큰을 발급하고 있습니다.';
    try {
      const data = await context.api(context.path, { method: 'POST', body: JSON.stringify({ name: requestedClient }) });
      if (version !== generation) return;
      if (requestedClient !== clientName()) { el('token-message').textContent = '발급 중 클라이언트가 변경되어 토큰 표시를 닫았습니다. 필요한 클라이언트의 토큰을 다시 발급하세요.'; await refresh(); return; }
      selectedId = data.id; selectionVersion += 1; invalidateFile(); rememberToken();
      current.inputConnectionId = data.id;
      configure(context, data.id);
      el('token').value = data.token; el('secret').hidden = false;
      el('token-message').textContent = '토큰을 발급했습니다. 선택한 클라이언트의 인증 안내와 새 설정을 적용하세요.';
      await refresh();
    } catch { if (version === generation) el('token-message').textContent = '토큰을 발급하지 못했습니다. 권한과 로그인 상태를 확인하세요.'; }
    finally { if (version === generation) { el('enroll').disabled = false; display(); } }
  };
  el('enroll').addEventListener('click', enroll);
  const retrieveToken = async (report = true) => {
    if (!current || !selectedId) return null;
    const version = generation, choice = selectionVersion, id = selectedId, context = current;
    try {
      const data = await context.api(`${context.path}/${id}/secret`, { method: 'POST' });
      if (version !== generation || choice !== selectionVersion || id !== selectedId) return null;
      if (data.id !== id || !data.token) throw new Error('Invalid secret response');
      el('token').value = data.token; el('secret').hidden = false;
      if (report) el('token-message').textContent = '선택한 토큰을 조회했습니다.';
      return data.token;
    } catch {
      if (version === generation && choice === selectionVersion) {
        el('token').value = ''; el('secret').hidden = true; invalidateFile();
        el('token-message').textContent = '토큰을 조회하지 못했습니다. 만료·폐기·권한을 확인하고 목록 새로고침으로 다시 시도하세요.';
        display();
      }
      return null;
    }
  };
  el('token-select').addEventListener('change', async () => {
    selectedId = el('token-select').value; selectionVersion += 1; invalidateFile();
    el('token').value = ''; el('secret').hidden = true; rememberToken();
    current.inputConnectionId = selectedId; configure(current, selectedId); display();
    await refresh();
  });
  el('download').addEventListener('click', async () => {
    if (!current || !selectedId || busy) return;
    const version = generation, choice = selectionVersion;
    busy = true; invalidateFile(); display();
    try {
      const token = await retrieveToken();
      if (!token || version !== generation || choice !== selectionVersion) return;
      const result = adapters.build({ clientId: el('client').value, variant: el('variant').value,
        workspaceId: current.workspaceId, connectionId: selectedId, workspaceName: current.name, url: el('url').value });
      const handoff = window.agentFactoryMCPHandoff.build({
        result, context: { ...current, url: el('url').value }, token, tokenId: selectedId, clientName: clientName(), variant: el('variant').value,
      });
      const url = URL.createObjectURL(handoff.blob);
      try {
        const link = document.createElement('a'); link.href = url; link.download = handoff.filename;
        document.body.append(link); link.click(); link.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      downloaded = { filename: handoff.filename, instruction: handoff.instruction, tokenId: selectedId };
      try { localStorage.setItem(selectionKey() + ':download', JSON.stringify(downloaded)); } catch { /* Optional download history only. */ }
      el('ai-message').textContent = handoff.filename + ' 다운로드를 시작했습니다. 파일을 AI에게 첨부하세요.';
    } catch {
      if (version === generation && choice === selectionVersion) el('ai-message').textContent = '설정 파일을 만들지 못했습니다. 다시 다운로드하세요.';
    } finally { if (version === generation) { busy = false; display(); } }
  });
  el('copy-ai').addEventListener('click', async () => {
    if (!current || !selectedId || !el('token').value || busy) return;
    const version = generation, choice = selectionVersion;
    const result = adapters.build({ clientId: el('client').value, variant: el('variant').value,
      workspaceId: current.workspaceId, connectionId: selectedId, workspaceName: current.name, url: el('url').value });
    const file = window.agentFactoryMCPHandoff.describe({ result, context: current, tokenId: selectedId, variant: el('variant').value });
    clearAICopy();
    busy = true; display();
    try {
      let copied = false;
      const previousFocus = document.activeElement;
      const clipboardField = document.createElement('textarea');
      clipboardField.value = file.instruction;
      clipboardField.readOnly = true;
      clipboardField.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;';
      document.body.append(clipboardField);
      try {
        clipboardField.focus({ preventScroll: true }); clipboardField.select();
        copied = document.execCommand('copy');
      } catch { /* Try the Clipboard API next. */ }
      finally { clipboardField.remove(); previousFocus?.focus({ preventScroll: true }); }
      if (!copied) {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        let deadline;
        try {
          await Promise.race([
            navigator.clipboard.writeText(file.instruction),
            new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Clipboard timeout')), 1500); }),
          ]);
        } finally { clearTimeout(deadline); }
      }
      if (version === generation && choice === selectionVersion) el('ai-message').textContent = '클립보드에 복사되었습니다.';
    } catch {
      if (version === generation && choice === selectionVersion) {
        el('ai-text').value = file.instruction; el('ai-fallback').hidden = false; el('ai-text').focus(); el('ai-text').select();
        el('ai-message').textContent = '자동 복사를 사용할 수 없습니다. 선택된 지침을 직접 복사하세요.';
      }
    } finally { if (version === generation) { busy = false; display(); } }
  });
  for (const [button, field] of [['copy-token', 'token'], ['copy-config', 'config'], ['copy-command', 'command']]) {
    el(button).addEventListener('click', async () => {
      const version = generation, choice = selectionVersion;
      if (field === 'token' && !await retrieveToken(false)) return;
      if (version !== generation || choice !== selectionVersion) return;
      const message = el(field === 'token' ? 'token-message' : 'message');
      try { await navigator.clipboard.writeText(el(field).value); if (version === generation) message.textContent = '복사했습니다.'; }
      catch { if (version === generation) { el(field).focus(); el(field).select(); message.textContent = '자동 복사를 사용할 수 없습니다. 선택된 내용을 직접 복사하세요.'; } }
    });
  }
  el('token-refresh').addEventListener('click', () => void refresh());
  el('refresh').addEventListener('click', async () => {
    const button = el('refresh');
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { await refresh(); }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  });
  const dismiss = () => { manual = false; rememberClient(); el('token').value = ''; el('secret').hidden = true; clearAICopy(); display(); };
  el('dismiss').addEventListener('click', dismiss);
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void refresh(); });
  window.addEventListener('pagehide', reset);
  window.agentFactoryMCPConnection = { open, reset, dismiss, rename: name => { if (!current) return; current.name = name; el('workspace').textContent = name; el('workspace').title = name; configure(current, selectedId); invalidateFile(); display(); }, show: () => { manual = true; rememberClient(); display(); void refresh(); } };
})();
