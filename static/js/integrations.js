(() => {
  "use strict";
  const ui = window.agentFactoryUI;
  const host = document.querySelector('[data-workspace-view="integrations"]');
  host.classList.add('af-kit');
  let confirmation;
  const clearConfirmation = () => { confirmation?.destroy(); confirmation = null; };
  const confirmAction = async (message) => {
    if (confirmation) return false;
    const dialog = ui.createNativeConfirm(host, {message, destructive:true});
    confirmation = dialog;
    try { return await dialog.ask(); }
    finally { dialog.destroy(); if (confirmation === dialog) confirmation = null; }
  };

  const listState = document.querySelector("[data-integration-list-state]");
  const list = document.querySelector("[data-integration-list]");
  const empty = document.querySelector("[data-integration-empty]");
  const catalog = document.querySelector("[data-integration-catalog]");
  const detail = document.querySelector("[data-integration-detail]");
  const status = document.querySelector("[data-integration-status]");
  const errorBox = document.querySelector("[data-integration-error]");
  const scopeError = document.querySelector("[data-scope-error]");
  const folderState = document.querySelector("[data-drive-state]");
  const folderList = document.querySelector("[data-drive-folders]");
  const scopeForm = document.querySelector("[data-scope-form]");
  const scopeName = scopeForm?.elements.name;
  if (scopeName) {
    const caption = scopeName.closest('label');
    const field = ui.fieldFor({label:'범위 이름',control:scopeName});
    caption.replaceWith(field.root);
  }
  const collectionList = document.querySelector("[data-collection-list]");
  const state = { context: null, providers: [], connections: [], collections: [], selected: null,
    selectedCollection: null, selectedFolder: null, folders: [], nextFolderPage: null, generation: 0,
    preferredConnectionId: null, preferredCollectionId: null, catalogOpen: false };
  const rememberState = (patch = {}) => state.context?.preferences?.write({
    connectionId: state.preferredConnectionId,
    collectionId: state.preferredCollectionId,
    catalogOpen: state.catalogOpen,
    tab: integrationTabs?.selected || 'status',
    ...patch,
  });

  const base = () => `/api/organizations/${state.context.organizationId}/workspaces/${state.context.workspaceId}`;
  const formatDate = (value) => value ? new Date(value).toLocaleString("ko-KR") : "아직 없음";
  const labelStatus = (value) => ({ active: "연결됨", pending: "인증 필요", degraded: "확인 필요",
    disconnected: "인증 해제됨", succeeded: "성공", bounded: "한도 도달", failed: "실패",
    retry: "재시도 필요", queued: "대기 중", running: "갱신 중" }[value] || value || "아직 없음");
  const currentCollections = () => state.collections.filter((item) => item.connection_id === state.selected?.id);

  const setMessage = (element, message, kind = element === errorBox || element === scopeError ? 'error' : 'info') => {
    if (element) ui.setStatus(element, {text:message || '', kind});
  };

  const showCatalog = () => {
    clearConfirmation();
    state.selected = null;
    state.catalogOpen = true;
    catalog.hidden = false;
    detail.hidden = true;
    document.querySelector("[data-integration-title]").textContent = "연동 / 추가";
    renderSidebar();
    rememberState();
  };

  const renderSidebar = () => {
    list.replaceChildren();
    state.connections.forEach((connection) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "app-sidebar__row integration-sidebar__item";
      if (connection.id === state.selected?.id) button.classList.add("is-selected");
      const icon = document.createElement("span"); icon.textContent = "G"; icon.setAttribute("aria-hidden", "true");
      const text = document.createElement("span"); text.textContent = connection.name;
      const dot = document.createElement("span"); dot.className = `integration-status-dot is-${connection.status}`;
      dot.title = labelStatus(connection.status); dot.setAttribute("aria-label", labelStatus(connection.status));
      button.append(icon, text, dot);
      button.addEventListener("click", () => selectConnection(connection.id));
      list.append(button);
    });
    const hasRows = state.connections.length > 0;
    list.hidden = !hasRows; empty.hidden = hasRows; setMessage(listState, '');
  };

  const renderCollections = () => {
    collectionList.replaceChildren();
    const rows = currentCollections();
    if (!rows.length) {
      collectionList.append(ui.status({kind:'empty',text:'이 작업공간에 연결된 Drive 범위가 없습니다.'})); return;
    }
    rows.forEach((collection) => {
      const button = document.createElement("button"); button.type = "button";
      button.className = "integration-collection-row ui-resource-row";
      button.setAttribute("aria-pressed", String(collection.collection_id === state.selectedCollection?.collection_id));
      if (collection.collection_id === state.selectedCollection?.collection_id) button.classList.add("is-selected");
      const title = document.createElement("strong"); title.textContent = collection.name;
      const meta = document.createElement("span");
      meta.textContent = `${collection.enabled ? labelStatus(collection.last_refresh_status) : "연결 제거됨"} · ${formatDate(collection.last_refreshed_at)}`;
      button.append(title, meta);
      button.addEventListener("click", () => {
        state.selectedCollection = collection; state.preferredCollectionId = collection.collection_id;
        rememberState(); renderCollections(); renderConnection();
      });
      collectionList.append(button);
    });
  };

  const renderConnection = () => {
    const connection = state.selected;
    if (!connection) return;
    catalog.hidden = true; detail.hidden = false;
    document.querySelector("[data-integration-title]").textContent = `연동 / ${connection.name}`;
    document.querySelector("[data-integration-name]").textContent = connection.name;
    document.querySelector("[data-integration-summary]").textContent = "Google Drive 원본 링크 · 이 작업공간 전용";
    document.querySelector("[data-auth-state]").textContent = labelStatus(connection.status);
    document.querySelector("[data-account-id]").textContent = connection.cloud?.account_id || connection.external_account_id || "인증 후 확인";
    document.querySelector("[data-requested-scopes]").textContent = connection.cloud?.requested_scopes?.length
      ? connection.cloud.requested_scopes.join(", ") : "Drive 읽기 전용";
    document.querySelector("[data-integration-workspace-name]").textContent = state.context.workspaceName || "현재 작업공간";
    const selectedCollection = state.selectedCollection
      || currentCollections().find((row) => row.collection_id === state.preferredCollectionId)
      || currentCollections().find((row) => row.enabled) || currentCollections()[0] || null;
    state.selectedCollection = selectedCollection;
    state.preferredCollectionId = selectedCollection?.collection_id || null;
    document.querySelector("[data-refresh-state]").textContent = selectedCollection
      ? `${labelStatus(selectedCollection.last_refresh_status)} · ${formatDate(selectedCollection.last_refreshed_at)}` : "아직 없음";
    const authorize = document.querySelector("[data-authorize-connection]");
    authorize.textContent = connection.status === "active" ? "다시 인증" : "인증하기";
    document.querySelector("[data-refresh-selected]").disabled = connection.status !== "active" || !selectedCollection?.enabled;
    document.querySelector("[data-unlink-collection]").disabled = !selectedCollection?.enabled;
    document.querySelector("[data-disconnect-account]").disabled = connection.status === "disconnected";
    setMessage(errorBox, selectedCollection?.last_error_code ? `최근 오류: ${selectedCollection.last_error_code}` : "");
    renderCollections();
    renderSidebar();
  };

  const selectConnection = async (id) => {
    clearConfirmation();
    if (state.selected?.id !== id) resetFolders();
    state.selected = state.connections.find((item) => item.id === id) || null;
    state.preferredConnectionId = state.selected?.id || null;
    state.catalogOpen = false;
    state.selectedCollection = state.collections.find((item) => item.connection_id === id && item.collection_id === state.preferredCollectionId)
      || state.collections.find((item) => item.connection_id === id && item.enabled)
      || state.collections.find((item) => item.connection_id === id) || null;
    state.preferredCollectionId = state.selectedCollection?.collection_id || null;
    rememberState();
    renderConnection();
    if (state.selected) await inspect(false);
  };

  const inspect = async (live) => {
    if (!state.selected) return;
    const id = state.selected.id;
    setMessage(status, live ? "연결 상태를 확인하는 중입니다." : "", 'loading');
    try {
      const cloud = await state.context.api(`${base()}/integrations/${id}/state?live=${live}`);
      if (state.selected?.id !== id) return;
      state.selected.cloud = cloud;
      state.selected.status = cloud.status;
      setMessage(status, cloud.inspection?.health === "available" ? "Google Drive 사용 가능" : "", 'success');
      renderConnection();
    } catch (error) { if (state.selected?.id === id) setMessage(errorBox, error.message); }
  };

  const reload = async () => {
    const generation = ++state.generation;
    if (!state.context) return;
    setMessage(listState, "연동을 불러오는 중입니다.", 'loading');
    try {
      const [providers, connections, collections] = await Promise.all([
        state.context.api("/api/integration-providers", { headers: {
          "X-Organization-ID": state.context.organizationId, "X-Workspace-ID": state.context.workspaceId,
        } }), state.context.api(`${base()}/integrations`),
        state.context.api(`${base()}/integration-collections`),
      ]);
      if (generation !== state.generation) return;
      state.providers = Array.isArray(providers) ? providers : [];
      state.connections = Array.isArray(connections) ? connections : [];
      state.collections = Array.isArray(collections?.collections) ? collections.collections : [];
      const selectedId = state.selected?.id || state.preferredConnectionId;
      renderSidebar();
      if (state.catalogOpen) showCatalog();
      else if (selectedId && state.connections.some((row) => row.id === selectedId)) await selectConnection(selectedId);
      else if (state.connections.length) await selectConnection(state.connections[0].id);
      else showCatalog();
    } catch (error) {
      if (generation !== state.generation) return;
      setMessage(listState, "연동을 불러오지 못했습니다.", 'error'); setMessage(status, error.message, 'error');
    }
  };

  const authorize = async () => {
    if (!state.selected) return;
    setMessage(errorBox, ""); setMessage(status, "Google 인증 페이지를 준비하는 중입니다.");
    try {
      const result = await state.context.api(`${base()}/integrations/${state.selected.id}/authorize`, { method: "POST" });
      window.location.assign(result.authorization_url);
    } catch (error) { setMessage(status, ""); setMessage(errorBox, error.message); }
  };

  const connectGoogle = async () => {
    const provider = state.providers.find((item) => item.key === "google-drive");
    if (!provider) { setMessage(status, "Google Drive 제공자가 활성화되어 있지 않습니다."); return; }
    const existing = state.connections.find((item) => item.provider_id === provider.id);
    if (existing) { await selectConnection(existing.id); await authorize(); return; }
    setMessage(status, "연결을 만드는 중입니다.");
    try {
      const connection = await state.context.api(`${base()}/integrations`, {
        method: "POST", body: JSON.stringify({ provider_id: provider.id, name: "Google Drive", credentials: null }),
      });
      state.connections.push(connection); await selectConnection(connection.id); await authorize();
    } catch (error) { setMessage(status, error.message); }
  };

  const folderStack = [{ id: "root", name: "내 드라이브" }];
  let folderRequest = 0;
  const resetFolders = () => {
    folderRequest++;folderStack.splice(1);state.selectedFolder=null;state.folders=[];state.nextFolderPage=null;
    document.querySelector('[data-selected-folder]').textContent='선택하지 않음';
    scopeForm.querySelector('[type="submit"]').disabled=true;
    setMessage(folderState,'');renderFolders();
  };
  const renderFolders = () => {
    folderList.replaceChildren(); document.querySelector("[data-drive-path]").textContent = folderStack.map((row) => row.name).join(" / ");
    document.querySelector("[data-drive-up]").disabled = folderStack.length === 1;
    state.folders.forEach((folder) => {
      const row = document.createElement("div"); row.className = "drive-folder-row";
      const select = ui.button({label:folder.name, variant:'link'});
      select.addEventListener("click", () => {
        state.selectedFolder = folder; document.querySelector("[data-selected-folder]").textContent = folder.name;
        scopeForm.querySelector('[type="submit"]').disabled = false;
        folderList.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected")); select.classList.add("is-selected");
      });
      const open = ui.button({label:'열기', variant:'link'}); open.setAttribute("aria-label", `${folder.name} 폴더 열기`);
      open.addEventListener("click", () => { folderStack.push({ id: folder.id, name: folder.name }); void loadFolders(folder.id); });
      row.append(select, open); folderList.append(row);
    });
    if (state.nextFolderPage) {
      const more = ui.button({label:'폴더 더 보기'}); more.classList.add('drive-folder-more');
      more.addEventListener("click", () => void loadFolders(folderStack.at(-1).id, state.nextFolderPage, true));
      folderList.append(more);
    }
  };

  const loadFolders = async (parentId = folderStack.at(-1).id, pageToken = null, append = false) => {
    const request=++folderRequest, context=state.context, connection=state.selected, generation=state.generation;
    const alive=()=>request===folderRequest && context===state.context && connection===state.selected && generation===state.generation;
    if (state.selected?.status !== "active") { setMessage(folderState, "먼저 Google 계정을 인증해 주세요.", 'warning'); return; }
    if (!append) {state.folders=[];state.nextFolderPage=null;renderFolders();}
    folderList.querySelector('.drive-folder-more')?.setAttribute('disabled','');
    setMessage(folderState, "폴더를 불러오는 중입니다.", 'loading');
    try {
      const query = `parent_id=${encodeURIComponent(parentId)}${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ""}`;
      const result = await context.api(`${base()}/integrations/${connection.id}/drive/folders?${query}`);
      if (!alive()) return;
      const folders = Array.isArray(result.folders) ? result.folders : [];
      state.folders = append ? [...state.folders, ...folders] : folders;
      state.nextFolderPage = result.next_page_token || null;
      setMessage(folderState, state.folders.length ? "" : "하위 폴더가 없습니다.", 'empty'); renderFolders();
    } catch (error) { if(alive()){setMessage(folderState, error.message, 'error');renderFolders();} }
  };

  const refreshCollection = async () => {
    const collection = state.selectedCollection;
    if (!collection) return;
    setMessage(errorBox, ""); setMessage(status, "새로고침을 요청하는 중입니다.");
    try {
      const run = await state.context.api(`${base()}/integration-collections/${collection.collection_id}/refresh`, {
        method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const generation = state.generation;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        if (generation !== state.generation) return;
        const current = await state.context.api(`${base()}/integration-runs/${run.run_id}`);
        setMessage(status, `${labelStatus(current.status)} · ${current.persisted_items}건`);
        if (["succeeded", "bounded", "cancelled", "failed"].includes(current.status)) {
          await reload(); await state.context.reloadDocuments?.(); return;
        }
      }
      setMessage(status, "갱신은 계속 실행 중입니다. 잠시 후 상태 확인을 눌러 주세요.");
    } catch (error) { setMessage(errorBox, error.message); }
  };

  document.querySelectorAll("[data-integration-add]").forEach((button) => button.addEventListener("click", showCatalog));
  document.querySelector("[data-connect-google]")?.addEventListener("click", connectGoogle);
  document.querySelector("[data-authorize-connection]")?.addEventListener("click", authorize);
  document.querySelector("[data-integration-live-check]")?.addEventListener("click", () => inspect(true));
  document.querySelector("[data-refresh-selected]")?.addEventListener("click", refreshCollection);
  document.querySelector("[data-open-originals]")?.addEventListener("click", () => state.context?.showOriginals());
  document.querySelector("[data-drive-up]")?.addEventListener("click", () => { if (folderStack.length > 1) folderStack.pop(); void loadFolders(); });
  document.querySelector("[data-select-current-folder]")?.addEventListener("click", () => {
    const folder = folderStack.at(-1); state.selectedFolder = folder;
    document.querySelector("[data-selected-folder]").textContent = folder.name;
    scopeForm.querySelector('[type="submit"]').disabled = false;
  });
  const integrationTabItems = [...host.querySelectorAll('[data-integration-tab]')].map(button => ({
    id:button.dataset.integrationTab, button,
    panel:host.querySelector('[data-integration-panel="' + button.dataset.integrationTab + '"]'),
  }));
  const integrationTabs = ui.bindTabs({
    list:host.querySelector('[role="tablist"]'),
    items:integrationTabItems,
    onChange:id => { rememberState({tab:id}); if (id === 'scope') void loadFolders(); },
  });
  scopeForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!state.selectedFolder || !state.selected) return;
    if (scopeForm.getAttribute("aria-busy") === "true") return;
    const submit = scopeForm.querySelector('[type="submit"]');
    const disabled = submit.disabled;
    if (disabled) return;
    scopeForm.setAttribute("aria-busy", "true");
    submit.disabled = true;
    setMessage(scopeError, "");
    try {
      const created = await state.context.api(`${base()}/integration-collections`, { method: "POST", body: JSON.stringify({
        connection_id: state.selected.id, name: scopeForm.elements.name.value.trim(), mode: "reference",
        selection: { folder_id: state.selectedFolder.id, recursive: scopeForm.elements.recursive.checked,
          attachments: false, max_items: 1000, max_pages: 100, max_bytes: 5000000 },
      }) });
      state.collections.push(created); state.selectedCollection = created; state.preferredCollectionId = created.collection_id;
      rememberState(); renderConnection(); await refreshCollection();
    } catch (error) { setMessage(scopeError, error.message); }
    finally { scopeForm.removeAttribute("aria-busy"); submit.disabled = disabled || !state.selectedFolder; }
  });
  document.querySelector("[data-unlink-collection]")?.addEventListener("click", async () => {
    if (!state.selectedCollection || !state.context) return;
    const generation = state.generation, collectionId = state.selectedCollection.collection_id;
    const context = state.context, path = `${base()}/integration-collections/${collectionId}`;
    const alive = () => generation === state.generation && context === state.context && collectionId === state.selectedCollection?.collection_id;
    if (!await confirmAction("이 범위의 이후 갱신을 중지하시겠습니까? 기존 원본 링크는 유지됩니다.") || !alive()) return;
    try {
      await context.api(path, { method: "PATCH", body: JSON.stringify({ enabled: false }) });
      if (alive()) await reload();
    } catch (error) { if (alive()) setMessage(errorBox, error.message); }
  });
  document.querySelector("[data-disconnect-account]")?.addEventListener("click", async () => {
    if (!state.selected || !state.context) return;
    const generation = state.generation, connectionId = state.selected.id;
    const context = state.context, path = `${base()}/integrations/${connectionId}`;
    const alive = () => generation === state.generation && context === state.context && connectionId === state.selected?.id;
    if (!await confirmAction("이 작업공간에 저장된 Google 인증을 해제하시겠습니까? 연결 범위의 갱신이 중단됩니다.") || !alive()) return;
    try { await context.api(path, { method: "DELETE" }); if (alive()) await reload(); }
    catch (error) { if (alive()) setMessage(errorBox, error.message); }
  });

  window.agentFactoryIntegrations = Object.freeze({
    open(context) {
      clearConfirmation(); state.context = context; resetFolders();
      const saved=context.preferences?.read({})||{};
      state.preferredConnectionId=typeof saved.connectionId==='string'?saved.connectionId:null;
      state.preferredCollectionId=typeof saved.collectionId==='string'?saved.collectionId:null;
      state.catalogOpen=saved.catalogOpen===true;
      const tabIndex=integrationTabItems.findIndex(item=>item.id===saved.tab);
      integrationTabs.select(tabIndex>=0?tabIndex:0, false, false);
      void reload();
    },
    reset() { state.generation += 1; clearConfirmation(); state.context = null; state.providers = []; state.connections = []; state.collections = []; state.selected = null; state.selectedCollection = null; state.preferredConnectionId = null; state.preferredCollectionId = null; state.catalogOpen = false; resetFolders(); renderSidebar(); },
    add: showCatalog,
  });
})();
