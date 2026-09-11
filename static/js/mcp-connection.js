/* Connection evidence belongs to the server; secrets live only in this view. */
(() => {
  const view = document.querySelector('[data-mcp-onboarding]');
  const ui = window.agentFactoryUI;
  view.classList.add('af-kit');
  const main = view.closest('main');
  const adapters = window.agentFactoryMCPClients;
  const el = name => view.querySelector(`[data-mcp-${name}]`);
  const tabItems = ['overview', 'connection'].map(id => ({
    id,
    button: view.querySelector(`[data-mcp-tab="${id}"]`),
    panel: view.querySelector(`[data-mcp-tab-panel="${id}"]`),
  }));
  for (const [name, label] of [['token-label','토큰 이름'],['token-select','연결 토큰'],['ai-text','파일 전달용 AI 연결 지침']]) {
    const control = el(name), caption = control.parentElement;
    const field = ui.fieldFor({label, control});
    // Keep owner lookup/visibility attributes on the replacement field container.
    for (const attribute of caption.attributes) field.root.setAttribute(attribute.name, attribute.value);
    field.root.classList.add('af-field');
    caption.replaceWith(field.root);
  }
  el('token-refresh').replaceChildren(ui.icon('refresh'));
  el('supported-clients').textContent = `지원 가능 MCP 클라이언트 ${adapters.clients.length}개 · ${adapters.clients.map(client => client.label).join(', ')}`;
  let notifications = null;
  const showNotice = options => {
    notifications ||= window.agentFactoryToasts.createToastManager(document.body,{id:'mcp-notifications'});
    notifications.show(options);
  };
  let current = null, generation = 0, requestVersion = 0, timer = null, verified = false, manual = false;
  let selectedId = '', selectionVersion = 0, busy = false, downloaded = null;
  let selectedTab = 'overview', tabPreference = false;
  const selectionKey = () => `afMcpToken:${current?.userId || 'user'}:${current?.organizationId}:${current?.workspaceId}`;
  const viewKey = () => `afMcpView:${current?.userId}:${current?.organizationId}:${current?.workspaceId}`;
  const rememberView = () => { try { localStorage.setItem(viewKey(), JSON.stringify({manual, tab:selectedTab})); } catch {} };
  const rememberToken = () => { try { localStorage.setItem(selectionKey(), selectedId); } catch { /* Optional preference only. */ } };
  const panelTabs = ui.bindTabs({
    list: el('tabs'),
    items: tabItems,
    onChange: id => { selectedTab = id; tabPreference = true; rememberView(); },
  });
  const tokenDialog = ui.bindNativeDialog(el('token-dialog'));
  const selectPanelTab = (id, notify = false) => {
    const index = tabItems.findIndex(item => item.id === id);
    selectedTab = index >= 0 ? id : 'overview';
    panelTabs.select(index >= 0 ? index : 0, false, notify);
  };
  const invalidateFile = () => { downloaded = null; clearAICopy(); };
  const clearAICopy = () => {
    el('ai-text').value = ''; el('ai-fallback').hidden = true; el('ai-message').textContent = '';
  };
  const display = () => {
    el('copy-ai').textContent = 'AI 지침 복사';
    el('enroll').disabled = busy;
    el('token-submit').disabled = !el('token-label').value.trim() || busy;
    el('token-submit').setAttribute('aria-busy', String(busy));
    el('download').disabled = !selectedId || !el('token').value || busy;
    el('copy-ai').disabled = !selectedId || !el('token').value || busy;
    el('ai-help').textContent = !selectedId
      ? '본인이 사용할 토큰을 발급하거나 선택하세요.'
      : downloaded
        ? '전체 클라이언트 설정 ZIP을 다운로드했습니다. 3단계를 진행하세요.'
        : '선택한 토큰으로 전체 클라이언트 설정 ZIP을 다운로드하세요.';
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
    selectedTab = 'overview'; tabPreference = false; selectPanelTab('overview');
    el('token-select').replaceChildren();
    clearAICopy();
    el('token').value = '';
    el('token-message').textContent = '';
    el('check-message').textContent = '';
    el('token-list-state').textContent = '토큰 목록을 불러오는 중입니다.';
    el('connections').replaceChildren();
    el('token-label').value = '';
    el('token-dialog-message').textContent = '';
    tokenDialog.close();
    display();
  };
  const refresh = async () => {
    if (!current) return false;
    let succeeded = false;
    clearTimeout(timer);
    const version = generation, request = ++requestVersion, context = current;
    try {
      const data = await context.api(context.path);
      if (version !== generation || request !== requestVersion) return;
      if (!['pending', 'verified', 'reauth_required'].includes(data.state) || !Array.isArray(data.connections)) throw new Error('Invalid connection status');
      const rows = data.connections;
      const usable = rows.filter(row => row.retrievable && ['pending', 'verified'].includes(row.state));
      const selection = usable.find(row => row.id === selectedId);
      if (!selection) {
        selectedId = usable[0]?.id || '';
        selectionVersion += 1; invalidateFile(); el('token').value = '';
      }
      el('token-select').replaceChildren(new Option('유효한 토큰 선택', ''), ...usable.map(row => {
        const shortId = row.id.slice(0, 8);
        return new Option(row.name === '작업공간 연결' ? `토큰 · ${shortId}` : `${row.name} · ${shortId}`, row.id);
      }));
      el('token-select').value = selectedId;
      if (current.inputConnectionId !== selectedId) {
        current.inputConnectionId = selectedId;
      }
      const selected = rows.find(row => row.id === selectedId);
      if (selected && (!selected.retrievable || selected.state === 'reauth_required')) {
        el('token').value = ''; invalidateFile();
        el('token-message').textContent = selected.state === 'reauth_required'
          ? '선택한 토큰이 만료되었거나 폐기되었습니다. 유효한 토큰을 선택하세요.'
          : '이전 토큰은 원문이 저장되지 않아 조회할 수 없습니다. 새 토큰을 발급하세요.';
      } else if (selected && !el('token').value) {
        await retrieveToken();
        if (version !== generation || request !== requestVersion) return;
      }
      if (!downloaded && selectedId && el('token').value) {
        try {
          const saved = JSON.parse(localStorage.getItem(selectionKey() + ':download') || 'null');
          if (saved?.tokenId === selectedId && typeof saved.filename === 'string' && typeof saved.instruction === 'string') downloaded = saved;
        } catch { /* Download history is optional and contains no credentials. */ }
      }
      verified = data.state === 'verified';
      if (!tabPreference) {
        selectPanelTab(verified ? 'overview' : 'connection');
        tabPreference = true;
      }
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
            showNotice({id:noticeKey,type:'success',title:'MCP 연결이 확인되었습니다.',duration:4500});
          }
        } catch { /* Optional notification preference. */ }
      }
      el('token-list-state').textContent = !rows.length ? '발급한 연결 토큰이 없습니다.' : !usable.length ? '선택 가능한 유효한 토큰이 없습니다. 원문이 없는 이전 토큰은 새로 발급하세요.' : '';
      el('connections').replaceChildren(...rows.map(row => {
        const li = document.createElement('li');
        if (row.id === selectedId) { li.classList.add('is-selected'); li.setAttribute('aria-current', 'true'); }
        const status = { pending: '연결 대기', verified: /connection-check|diagnostic|verification/i.test(row.client_name || '') ? '서버 통신 확인' : 'MCP 연결됨', reauth_required: row.reason === 'expired' ? '만료' : '폐기됨' }[row.state];
        const details = document.createElement('div'); details.className = 'mcp-token-details';
        const shortId = row.id.slice(0, 8);
        const name = document.createElement('strong'); name.textContent = row.name === '작업공간 연결' ? `토큰 · ${shortId}` : row.name;
        const title = document.createElement('div'); title.className = 'mcp-token-title'; title.append(name);
        if (row.id === selectedId) {
          const selected = ui.badge('선택됨', 'neutral'); selected.classList.add('mcp-token-selected'); title.append(selected);
        }
        const connected = row.state === 'verified' && !/connection-check|diagnostic|verification/i.test(row.client_name || '');
        const state = ui.badge(status, connected ? 'success' : row.state === 'reauth_required' ? 'warning' : 'neutral');
        state.classList.add('mcp-token-state');
        state.dataset.state = row.state === 'verified' && !/connection-check|diagnostic|verification/i.test(row.client_name || '') ? 'connected' : row.state;
        const seen = document.createElement('span'); seen.className = 'mcp-token-seen';
        seen.textContent = row.last_seen_at ? `마지막 요청 · ${new Date(row.last_seen_at).toLocaleString()}` : '마지막 요청 · 없음';
        const identity = document.createElement('span'); identity.textContent = 'ID · ' + shortId;
        details.append(title);
        if (row.name !== '작업공간 연결') details.append(identity);
        details.append(state);
        details.append(seen);
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
                if (selectedId === row.id) { el('token').value = ''; selectionVersion += 1; invalidateFile(); }
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
      succeeded = true;
    } catch (error) {
      if (version !== generation || request !== requestVersion) return;
      verified = false; el('token').value = ''; invalidateFile();
      el('connections').replaceChildren();
      el('token-list-state').textContent = '토큰 목록을 불러오지 못했습니다. 목록 새로고침으로 다시 시도하세요.';
      el('status').textContent = error.status === 401 ? '로그인이 만료되었습니다. 다시 로그인한 후 연결 상태를 확인하세요.' : error.status === 403 || error.status === 404 ? '이 작업공간에 접근할 수 없습니다. 작업공간 목록에서 접근 권한을 확인하세요.' : '연결 상태를 확인하지 못했습니다. 다시 확인해 주세요.';
    } finally {
      if (version === generation && request === requestVersion) { display(); timer = setTimeout(() => { if (!document.hidden) void refresh(); }, verified ? 30000 : 3000); }
    }
    return succeeded;
  };
  const configure = context => {
    const url = `${location.origin}${context.rootPath}/mcp/workspaces/${context.workspaceId}/`;
    el('url').value = url;
    el('url').title = url;
  };
  const open = context => {
    reset(); manual = true; current = { ...context, path: `/api/organizations/${context.organizationId}/workspaces/${context.workspaceId}/mcp-connections` };
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey()) || 'null');
      tabPreference = ['overview', 'connection'].includes(saved?.tab);
      selectPanelTab(tabPreference ? saved.tab : 'overview');
      selectedId = localStorage.getItem(selectionKey()) || '';
    } catch { selectedId = ''; tabPreference = false; selectPanelTab('overview'); }
    configure(current);
    el('workspace').textContent = context.name;
    el('workspace').title = context.name;
    el('status').textContent = '연결 상태를 확인하고 있습니다.';
    display(); void refresh();
  };
  const enroll = async () => {
    const label = el('token-label').value.trim();
    if (!current || el('enroll').disabled || !label) return;
    const version = generation, context = current;
    manual = true;
    busy = true;
    clearAICopy();
    el('token-dialog-message').textContent = '';
    display();
    try {
      const data = await context.api(context.path, { method: 'POST', body: JSON.stringify({ name: label }) });
      if (version !== generation) return;
      selectedId = data.id; selectionVersion += 1; invalidateFile(); rememberToken();
      current.inputConnectionId = data.id;
      el('token').value = data.token;
      el('token-label').value = '';
      tokenDialog.close();
      el('token-message').textContent = `“${data.name}” 토큰을 발급했습니다.`;
      await refresh();
    } catch { if (version === generation) el('token-dialog-message').textContent = '토큰을 발급하지 못했습니다. 권한과 로그인 상태를 확인하세요.'; }
    finally { if (version === generation) { busy = false; display(); } }
  };
  el('token-label').addEventListener('input', display);
  el('enroll').addEventListener('click', () => {
    el('token-label').value = '';
    el('token-dialog-message').textContent = '';
    display();
    tokenDialog.open({ initialFocus: el('token-label') });
  });
  el('token-cancel').addEventListener('click', () => tokenDialog.close());
  el('token-form').addEventListener('submit', event => { event.preventDefault(); void enroll(); });
  const retrieveToken = async () => {
    if (!current || !selectedId) return null;
    const version = generation, choice = selectionVersion, id = selectedId, context = current;
    try {
      const data = await context.api(`${context.path}/${id}/secret`, { method: 'POST' });
      if (version !== generation || choice !== selectionVersion || id !== selectedId) return null;
      if (data.id !== id || !data.token) throw new Error('Invalid secret response');
      el('token').value = data.token;
      return data.token;
    } catch {
      if (version === generation && choice === selectionVersion) {
        el('token').value = ''; invalidateFile();
        el('token-message').textContent = '토큰을 조회하지 못했습니다. 만료·폐기·권한을 확인하고 목록 새로고침으로 다시 시도하세요.';
        display();
      }
      return null;
    }
  };
  el('token-select').addEventListener('change', async () => {
    selectedId = el('token-select').value; selectionVersion += 1; invalidateFile();
    el('token').value = ''; rememberToken();
    el('check-message').textContent = '';
    current.inputConnectionId = selectedId; display();
    await refresh();
  });
  el('download').addEventListener('click', async () => {
    if (!current || !selectedId || busy) return;
    const version = generation, choice = selectionVersion;
    busy = true; invalidateFile(); display();
    try {
      const token = await retrieveToken();
      if (!token || version !== generation || choice !== selectionVersion) return;
      const handoff = window.agentFactoryMCPHandoff.build({
        adapters, context: { ...current, url: el('url').value }, token, tokenId: selectedId,
      });
      const url = URL.createObjectURL(handoff.blob);
      try {
        const link = document.createElement('a'); link.href = url; link.download = handoff.filename;
        document.body.append(link); link.click(); link.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      downloaded = { filename: handoff.filename, instruction: handoff.instruction, tokenId: selectedId };
      try { localStorage.setItem(selectionKey() + ':download', JSON.stringify(downloaded)); } catch { /* Optional download history only. */ }
      el('ai-message').textContent = '';
      showNotice({id:viewKey() + ':download',type:'success',title:'설정 ZIP 다운로드를 시작했습니다.',description:'저장된 ZIP을 연결할 로컬 워크스페이스 루트에 넣으세요.',duration:4500});
    } catch {
      if (version === generation && choice === selectionVersion) el('ai-message').textContent = '설정 파일을 만들지 못했습니다. 다시 다운로드하세요.';
    } finally { if (version === generation) { busy = false; display(); } }
  });
  el('copy-ai').addEventListener('click', async () => {
    if (!current || !selectedId || !el('token').value || busy) return;
    const version = generation, choice = selectionVersion;
    const file = window.agentFactoryMCPHandoff.describe({ adapters, context: current, tokenId: selectedId });
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
      if (version === generation && choice === selectionVersion) {
        el('ai-message').textContent = '';
        showNotice({id:viewKey() + ':instruction-copy',type:'success',title:'AI 지침을 복사했습니다.',duration:3500});
      }
    } catch {
      if (version === generation && choice === selectionVersion) {
        el('ai-text').value = file.instruction; el('ai-fallback').hidden = false; el('ai-text').focus(); el('ai-text').select();
        el('ai-message').textContent = '자동 복사를 사용할 수 없습니다. 선택된 지침을 직접 복사하세요.';
      }
    } finally { if (version === generation) { busy = false; display(); } }
  });
  el('token-refresh').addEventListener('click', () => void refresh());
  el('refresh').addEventListener('click', async () => {
    const button = el('refresh');
    const version = generation;
    button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = '확인 중…';
    el('check-message').textContent = '연결 상태를 확인하고 있습니다.';
    try {
      const succeeded = await refresh();
      if (version === generation) {
        const checkedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el('check-message').textContent = `${el('status').textContent} · ${checkedAt} 확인`;
        const connected = el('status').dataset.state === 'connected';
        showNotice({
          id:viewKey() + ':status-check', type:succeeded ? connected ? 'success' : 'info' : 'error',
          title:succeeded ? connected ? 'MCP 연결을 확인했습니다.' : '연결 상태 확인을 완료했습니다.' : '연결 상태를 확인하지 못했습니다.',
          description:el('status').textContent, duration:succeeded ? 4000 : undefined,
        });
      }
    } finally {
      if (version === generation) { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = '상태 확인'; }
    }
  });
  const dismiss = () => { manual = false; rememberView(); el('token').value = ''; clearAICopy(); display(); };
  el('dismiss').addEventListener('click', dismiss);
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void refresh(); });
  window.addEventListener('pagehide', reset);
  window.agentFactoryMCPConnection = { open, reset, dismiss, rename: name => { if (!current) return; current.name = name; el('workspace').textContent = name; el('workspace').title = name; configure(current); invalidateFile(); display(); }, show: () => { manual = true; rememberView(); display(); void refresh(); } };
})();
