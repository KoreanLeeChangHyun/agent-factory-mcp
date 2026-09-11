/* Tenant-owned development plan. All views render the same server snapshot. */
(() => {
  const sidebar = document.querySelector('[data-sidebar-view="schedule"]');
  const headerActions = document.querySelector('[data-plan-header-actions]');
  const panel = document.querySelector('[data-workspace-view="schedule"]');
  if (!sidebar || !panel) return;
  const ui = window.agentFactoryUI;
  const iconBase = new URL('../images/planning-explorer/', document.currentScript.src);
  const statuses = { pending: '대기', active: '진행 중', done: '완료' };
  const kinds = { domain: '작업', feature: '하위 작업', issue: '하위 작업' };
  let scope = null, epoch = 0, snapshot = { items: [], settings: {}, calendar: {}, can_edit: false };
  let importView = false, importVersion = 0;
  let selected = null, activeView = 'timeline', collapsed = new Set(), expanded = new Set(), drafts = new Map(), loadVersion = 0;
  let scale = 'week', fitted = false, anchor = today(), timelineScroll = 0, busy = false;
  let planningExplorer = null;
  let scrollStateTimer = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => {
    const shared = {add:'plus',left:'chevron-right',right:'chevron-right',down:'chevron-down',done:'check'};
    if (shared[name]) return ui.icon(shared[name]).outerHTML;
    return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${({ pending: '<circle cx="8" cy="8" r="5"/>', active: '<circle cx="8" cy="8" r="5"/><path d="M8 3v10"/>', milestone: '<path d="m8 2 6 6-6 6-6-6Z"/>' })[name]}</svg>`;
  };
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  const day = value => Date.parse(`${value}T00:00:00Z`) / 86400000;
  const iso = value => new Date(value * 86400000).toISOString().slice(0,10);
  const item = id => snapshot.items.find(r => r.id === id);
  const children = id => snapshot.items.filter(r => r.parent_id === id);
  const domains = () => snapshot.items.filter(r => r.kind === 'domain');
  const features = () => snapshot.items.filter(r => r.kind === 'feature');
  const rememberState = () => scope?.preferences?.write({
    view: activeView,
    selectedId: selected,
    importView,
    collapsedIds: [...collapsed],
    expandedIds: [...expanded],
    scale,
    fitted,
    anchor,
    timelineScroll,
  });
  const period = r => r.period_conflict ? `시작 ${r.start_date} · 목표 ${r.target_date} (기간 확인 필요)` : r.start_date && r.target_date ? `${r.start_date} – ${r.target_date}` : r.target_date ? `목표 ${r.target_date}` : r.start_date ? `${r.start_date} 시작 · 종료 미정` : '기간 미정';
  const status = r => `<span class="plan-status status-${r.status}">${icon(r.status)}${statuses[r.status]}</span>`;
  const flags = r => `${r.blocked_reason ? '<span class="plan-warning">막힘</span>' : ''}${r.target_date && r.target_date < today() && r.status !== 'done' ? '<span class="plan-warning">기한 초과</span>' : ''}`;
  const button = (action, label, extra = '', variant = '') => {
    // label/extra are the existing escaped template fragments (including owned SVG).
    const fragment = document.createElement('template');
    fragment.innerHTML = `<button ${extra}>${label}</button>`;
    const source = fragment.content.firstElementChild;
    const node = ui.button({label:source.textContent || source.getAttribute('aria-label') || source.title || action,
      variant:variant || (action === 'delete' ? 'danger' : action === 'import-apply' ? 'primary' : 'secondary')});
    for (const attr of source.attributes) {
      if (attr.name === 'class') node.classList.add(...attr.value.split(/\s+/).filter(Boolean));
      else node.setAttribute(attr.name,attr.value);
    }
    node.dataset.planAction = action;
    node.replaceChildren(...source.childNodes);
    return node.outerHTML;
  };
  const editButton = r => snapshot.can_edit ? button('edit', '수정', `data-id="${r.id}"`) : '';
  const addButton = (kind, parent = '', primary = false) => snapshot.can_edit ? button('add', `${icon('add')}${kinds[kind]} 추가`, `data-kind="${kind}" data-parent="${parent}"`,primary?'primary':'secondary') : '';
  const planningExplorerIcon = (row, open) => {
    const name = row.folder ? (open ? 'task-open' : 'task') : 'subtask';
    const image = document.createElement('img');
    image.className = 'af-explorer-icon plan-explorer__icon';
    image.src = new URL(`${name}.svg`, iconBase).href;
    image.alt = '';
    image.dataset.planExplorerIcon = name;
    return image;
  };
  const views = { timeline: '전체 일정', today: '오늘 할 일', kanban: '칸반' };
  const dashboardViews = () => `<div class="plan-dashboard-views" role="group" aria-label="일정 대시보드 보기">${Object.entries(views).map(([view,name])=>`<button type="button" data-plan-action="view" data-view="${view}" aria-pressed="${activeView===view}">${name}</button>`).join('')}</div>`;
  function renderSidebar() {
    headerActions.querySelector('[data-plan-action="add"]').hidden = !snapshot.can_edit;
    headerActions.querySelector('[data-plan-action="dashboard"]').setAttribute('aria-pressed',String(selected===null&&!importView));
    planningExplorer?.destroy(); planningExplorer = null;
    const rows = domains();
    if (!rows.length) {
      sidebar.innerHTML = '<p class="app-sidebar__state plan-muted">작업을 추가해 일정을 시작하세요.</p>';
      return;
    }
    planningExplorer = ui.explorerTree({
      label: '일정 탐색기',
      items: rows.map(domain => ({
        id: domain.id,
        label: domain.name,
        selected: selected === domain.id,
        expanded: !collapsed.has(domain.id),
        toggleOnClick: false,
        children: children(domain.id).map(feature => ({
          id: feature.id,
          label: feature.name,
          selected: selected === feature.id,
        })),
      })),
      multiSelect: false,
      renderIcon: planningExplorerIcon,
      onSelect: keys => {
        const id = keys[0];
        if (!id || selected === id) return;
        importView = false; importVersion++; selected = id; rememberState(); render(); panel.querySelector('h1')?.focus();
      },
      onActivate: id => {
        if (!item(id) || selected === id) return;
        importView = false; importVersion++; selected = id; rememberState(); render(); panel.querySelector('h1')?.focus();
      },
      onToggle: (id, open) => {
        if (open) collapsed.delete(id); else collapsed.add(id);
        rememberState();
      },
      onRender: visible => visible.forEach(row => {
        row.element.dataset.planId = row.key;
        row.element.classList.add(row.folder ? 'plan-explorer__task' : 'plan-explorer__subtask');
        if (selected === row.key) row.element.setAttribute('aria-current','page');
      }),
    });
    sidebar.replaceChildren(planningExplorer.root);
  }
  function header(title, actions = '') {
    return `<header class="plan-header ui-section-header"><h1 tabindex="-1">${esc(title)}</h1><div class="plan-actions">${actions}</div></header><p class="ui-message plan-message" role="status" aria-live="polite"></p>`;
  }
  function detailHeader(title, actions = '') {
    const back=button('dashboard',`${icon('left')}<span>일정 대시보드</span>`,'class="plan-back-button" aria-label="일정 대시보드로 돌아가기" title="일정 대시보드로 돌아가기"');
    return `<header class="plan-header plan-detail-header"><div class="plan-detail-heading">${back}<span class="plan-header-divider" aria-hidden="true"></span><h1 tabindex="-1" title="${esc(title)}">${esc(title)}</h1></div><div class="plan-actions">${actions}</div></header><p class="ui-message plan-message" role="status" aria-live="polite"></p>`;
  }
  const dashboardHeader = (actions='') => `<header class="plan-dashboard-header"><h1 tabindex="-1">일정 대시보드</h1>${dashboardViews()}<div class="plan-actions">${actions}${addButton('domain')}</div></header><p class="ui-message plan-message plan-dashboard-message" role="status" aria-live="polite"></p>`;
  function rememberDrafts() {
    panel.querySelectorAll('[data-plan-form]').forEach(form => {
      drafts.set(form.dataset.id, {...Object.fromEntries(new FormData(form)), revision: Number(form.dataset.revision)});
    });
  }
  function render() {
    rememberDrafts();
    renderSidebar();
    if (importView) { void renderImports(); return; }
    const record = item(selected);
    if (!record) {
      selected = null;
      if (activeView === 'today') renderToday();
      else if (activeView === 'kanban') renderKanban();
      else renderTimeline();
    }
    else if (record.kind === 'domain') renderDomain(record);
    else renderFeature(record);
  }
  function featureTable(rows) {
    return `<div class="plan-table-scroll"><table class="plan-table plan-detail-table"><thead><tr><th>작업 이름</th><th>상태</th><th>목표 기간</th><th>하위 작업</th></tr></thead><tbody>${rows.map(r => {
      const issues = children(r.id);
      return `<tr><td>${button('select',esc(r.name),`data-id="${r.id}"`)}</td><td>${status(r)} ${flags(r)}</td><td>${esc(period(r))} ${issueWarning(r,item(r.parent_id))}</td><td>${issues.filter(i=>i.status==='done').length}/${issues.length} 완료</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function renderDomain(r) {
    panel.classList.remove('is-timeline');
    const rows = children(r.id);
    const completed=rows.filter(i=>i.status==='done').length;
    panel.innerHTML = detailHeader(r.name,editButton(r)) + `<div class="plan-detail"><dl class="plan-resource-summary"><div><dt>상태</dt><dd>${status(r)}</dd></div><div><dt>기간</dt><dd>${esc(period(r))}</dd></div><div><dt>날짜 기준</dt><dd>${esc(dateOrigin(r))}</dd></div></dl>
      ${r.description?`<section class="plan-detail-section"><h2>설명</h2><p class="plan-description">${esc(r.description)}</p></section>`:''}
      <section class="plan-detail-section plan-subtasks"><header class="plan-subtasks-header"><div><h2>하위 작업</h2><span class="plan-progress-summary">${completed}/${rows.length} 완료</span></div>${addButton('feature',r.id,true)}</header>${rows.length?featureTable(rows):'<p class="plan-empty">하위 작업을 추가하면 요약 일정이 표시됩니다.</p>'}</section></div>`;
  }
  function dateOrigin(r) {
    const label={explicit:'직접 지정',derived:'하위 작업에서 집계',unspecified:'미정'};
    return `시작일: ${label[r.start_date_source]||'미정'} · 목표일: ${label[r.target_date_source]||'미정'}`;
  }
  function issueWarning(r, parent) {
    if (!parent) return '';
    const dates=[r.start_date,r.target_date].filter(Boolean);
    const outside=dates.some(d=>(parent.start_date && d<parent.start_date)||(parent.target_date && d>parent.target_date));
    return outside ? `<span class="plan-warning">상위 작업 기간 밖</span>${snapshot.can_edit ? button('edit','상위 작업 기간 조정',`data-id="${parent.id}"`) : ''}` : '';
  }
  function renderFeature(r) {
    panel.classList.remove('is-timeline');
    const rows = children(r.id);
    const completed=rows.filter(i=>i.status==='done').length;
    panel.innerHTML = detailHeader(r.name,editButton(r)) + `<div class="plan-detail"><dl class="plan-resource-summary"><div><dt>상태</dt><dd>${status(r)}${flags(r)}</dd></div><div><dt>담당자</dt><dd>${esc(r.assignee || '미지정')}</dd></div><div><dt>기간</dt><dd>${esc(period(r))}${issueWarning(r,item(r.parent_id))}</dd></div></dl>
      ${r.blocked_reason?`<p class="plan-warning plan-blocked-reason">막힘: ${esc(r.blocked_reason)}</p>`:''}
      <section class="plan-detail-section plan-acceptance"><h2>완료 조건</h2><p>${esc(r.acceptance || '완료 조건을 작성하세요.')}</p></section>
      ${r.description?`<section class="plan-detail-section"><h2>설명</h2><p class="plan-description">${esc(r.description)}</p></section>`:''}
      <section class="plan-detail-section plan-subtasks"><header class="plan-subtasks-header"><div><h2>하위 작업</h2><span class="plan-progress-summary">${completed}/${rows.length} 완료</span></div>${addButton('issue',r.id,true)}</header>
      ${rows.length?`<div class="plan-table-scroll"><table class="plan-table plan-detail-table plan-subtask-table"><thead><tr><th>작업 이름</th><th>담당자</th><th>상태</th><th>목표일</th></tr></thead><tbody>${rows.map(i=>`<tr><td>${button('expand',`${icon(expanded.has(i.id)?'down':'right')}${esc(i.name)}`,`data-id="${i.id}" aria-expanded="${expanded.has(i.id)}" aria-controls="issue-${i.id}"`)}</td><td>${esc(i.assignee || '미지정')}</td><td>${status(i)}${flags(i)}</td><td>${esc(i.target_date || '미정')} ${issueWarning(i,r)}</td></tr><tr id="issue-${i.id}" ${expanded.has(i.id)?'':'hidden'}><td colspan="4"><div class="plan-issue-detail">${snapshot.can_edit?(expanded.has(i.id)?editor(i):''):`<p class="plan-description">${esc(i.description || '설명이 없습니다.')}</p>${i.blocked_reason?`<p>막힘: ${esc(i.blocked_reason)}</p>`:''}`}</div></td></tr>`).join('')}</tbody></table></div>`:'<p class="plan-empty">하위 작업을 추가하세요. 목표일은 필요한 작업에만 입력합니다.</p>'}</section></div>`;
  }
  const opensOn = (r, date) => !r.period_conflict && ((r.start_date && r.target_date && r.start_date <= date && date <= r.target_date) || r.start_date === date || r.target_date === date);
  const viewRow = r => `<li><button type="button" data-plan-action="view-item" data-id="${r.id}" title="${esc(r.name)}"><strong>${esc(r.name)}</strong><span>${statuses[r.status] || esc(r.status)} · ${esc(period(r))}</span></button></li>`;
  const taskList = (label,rows) => `<section class="plan-today-group"><h2>${label} <span>${rows.length}</span></h2>${rows.length?`<ul class="plan-view-list" aria-label="${label}">${rows.map(viewRow).join('')}</ul>`:'<p class="plan-muted">작업 없음</p>'}</section>`;
  function renderToday() {
    panel.classList.remove('is-timeline');
    const date=today(), active=snapshot.items.filter(r=>r.kind!=='domain' && r.status!=='done');
    const overdue=active.filter(r=>r.target_date && r.target_date<date).sort((a,b)=>a.target_date.localeCompare(b.target_date));
    const rows=active.filter(r=>!overdue.includes(r) && opensOn(r,date)).sort((a,b)=>(a.target_date||'9999').localeCompare(b.target_date||'9999'));
    panel.innerHTML=dashboardHeader()+`<p class="plan-muted plan-dashboard-context">${date} 기준 미완료 작업입니다.</p><div class="plan-today-groups">${taskList('기한 초과',overdue)}${taskList('오늘 진행',rows)}</div>`;
  }
  const updatePayload = (r,changes={}) => ({name:r.name,description:r.description||'',acceptance:r.acceptance||'',assignee:r.assignee||'',status:r.status,blocked_reason:r.blocked_reason||'',start_date:r.start_date||null,target_date:r.target_date||null,revision:r.revision,...changes});
  const kanbanCard = r => { const parent=item(r.parent_id); return `<li class="plan-kanban-card" data-plan-card data-id="${r.id}" ${snapshot.can_edit?'draggable="true"':''}><button type="button" data-plan-action="view-item" data-id="${r.id}" title="${esc(r.name)}"><strong>${esc(r.name)}</strong><span>${parent?`${esc(parent.name)} · `:''}${esc(r.assignee||'담당자 미지정')}</span><span>${esc(r.target_date?`목표 ${r.target_date}`:'목표일 미정')}${r.blocked_reason?' · 막힘':''}</span></button>${snapshot.can_edit?`<label><span class="visually-hidden">${esc(r.name)} 상태</span><select data-plan-status data-id="${r.id}" aria-label="${esc(r.name)} 상태">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${r.status===value?'selected':''}>${label}</option>`).join('')}</select></label>`:''}</li>`; };
  function renderKanban() {
    panel.classList.remove('is-timeline');
    const rows=snapshot.items.filter(r=>r.kind!=='domain');
    panel.innerHTML=dashboardHeader()+`<p class="plan-muted plan-dashboard-context">하위 작업을 상태별로 구분합니다.</p><div class="plan-kanban" aria-label="상태별 작업">${Object.entries(statuses).map(([value,label])=>{const column=rows.filter(r=>r.status===value);return `<section data-plan-column="${value}"><h2>${label} <span>${column.length}</span></h2>${column.length?`<ul>${column.map(kanbanCard).join('')}</ul>`:'<p class="plan-muted">작업 없음</p>'}</section>`;}).join('')}</div>`;
  }
  function renderTimeline() {
    panel.classList.add('is-timeline');
    const timelineScale=scale;
    const rows = features();
    const dates = [...rows,...domains()].flatMap(r=>[r.start_date,r.target_date]).filter(Boolean);
    if (snapshot.settings.launch_date) dates.push(snapshot.settings.launch_date);
    let start, end;
    if (fitted && dates.length) { start = Math.min(...dates.map(day))-3; end = Math.max(...dates.map(day))+4; }
    else {
      const windowStart=day(anchor)-7, windowDays=timelineScale==='day'?28:timelineScale==='week'?56:180;
      start=dates.length?Math.min(windowStart,Math.min(...dates.map(day))-3):windowStart;
      end=Math.max(windowStart+windowDays,dates.length?Math.max(...dates.map(day))+4:windowStart+windowDays);
    }
    const labelWidth = parseFloat(getComputedStyle(panel).getPropertyValue('--plan-label-width')) || 280;
    const pixelsPerDay=timelineScale==='day'?44:timelineScale==='week'?14:5;
    const minimumChartWidth=timelineScale==='day'?880:timelineScale==='week'?784:900;
    const chartWidth = fitted
      ? Math.max(120, panel.clientWidth - labelWidth - 34)
      : Math.max(minimumChartWidth,(end-start)*pixelsPerDay);
    const maxLabels = Math.max(1, Math.floor(chartWidth / (timelineScale==='day'?44:88)));
    const tickInterval = Math.max(1, Math.ceil((end-start) / (timelineScale==='day'?1:timelineScale==='week'?7:30) / maxLabels));
    const ticks = [];
    const holidayName=date=>snapshot.calendar?.holidays?.[date]||'';
    const calendarClass=(date,weekday)=>`${weekday===0||weekday===6?'is-weekend ':''}${holidayName(date)?'is-holiday ':''}${date===today()?'is-today':''}`;
    if (timelineScale === 'day') {
      for(let d=start;d<=end;d+=tickInterval) {
        const weekday=new Date(d*86400000).getUTCDay(),date=iso(d),holiday=holidayName(date);
        ticks.push(`<span class="${calendarClass(date,weekday)}" data-plan-date="${date}" data-plan-left="${(d-start)/(end-start)*100}" title="${esc(holiday||((weekday===0||weekday===6)?'주말':''))}">${date.slice(5)}</span>`);
      }
    } else if (timelineScale === 'week') {
      const weekday = new Date(start * 86400000).getUTCDay();
      for (let d = start + ((8-weekday)%7); d <= end; d += 7*tickInterval) ticks.push(`<span data-plan-left="${(d-start)/(end-start)*100}">${iso(d).slice(5)}</span>`);
    } else {
      const cursor = new Date(start * 86400000);
      cursor.setUTCDate(1);
      if (cursor.getTime()/86400000 < start) cursor.setUTCMonth(cursor.getUTCMonth()+1);
      while (cursor.getTime()/86400000 <= end) {
        ticks.push(`<span data-plan-left="${(cursor.getTime()/86400000-start)/(end-start)*100}">${cursor.getUTCFullYear()}년 ${cursor.getUTCMonth()+1}월</span>`);
        cursor.setUTCMonth(cursor.getUTCMonth()+tickInterval);
      }
    }
    const position = d => (day(d)-start)/(end-start)*100;
    const marker = (date,label,cls,caption=false) => date && position(date)>=0 && position(date)<=100 ? `<div class="${caption?'plan-marker-caption':'plan-marker'} ${cls}${position(date)>60?' near-end':''}" data-plan-left="${position(date)}" ${caption?'':'aria-hidden="true"'}>${caption?`<span>${cls==='launch'?icon('milestone'):''}${label} ${esc(date)}</span>`:''}</div>`:'';
    const minWidth = chartWidth;
    const bandDays=end-start;
    const showWeekendBands=timelineScale==='day'||(timelineScale==='week'&&!fitted);
    const dayBands=Array.from({length:bandDays},(_,offset)=>{const d=start+offset,weekday=new Date(d*86400000).getUTCDay(),date=iso(d),holiday=holidayName(date),weekend=weekday===0||weekday===6,classes=`${showWeekendBands&&weekend?'is-weekend ':''}${holiday?'is-holiday ':''}${date===today()?'is-today':''}`;return `<i class="plan-day-band ${classes}" data-plan-date="${date}" data-plan-left="${offset/bandDays*100}" data-plan-width="${100/bandDays}" title="${esc(holiday||(showWeekendBands&&weekend?'주말':''))}" aria-hidden="true"></i>`;}).join('');
    let timelineRowIndex=0;
    const timelineRow = (r, summary=false) => {
      const rowIndex=++timelineRowIndex;
      let bar='';
      const label=`${r.name} · ${period(r)} · ${statuses[r.status]}`;
      const childRows=summary?children(r.id):[];
      const completed=childRows.filter(child=>child.status==='done').length;
      const progress=childRows.length?completed/childRows.length*100:0;
      const barContent=summary
        ? `${childRows.length?`<span class="plan-bar-progress" data-plan-width="${progress}" aria-hidden="true"></span>`:''}`
        : '';
      if(r.start_date && r.target_date && !r.period_conflict) {
        const left=Math.max(0,position(r.start_date)), right=Math.min(100,position(iso(day(r.target_date)+1)));
        bar=right>left?`<button type="button" class="plan-bar status-${r.status}${summary?' plan-summary-bar':''}" data-plan-left="${left}" data-plan-width="${Math.max(.4,right-left)}" data-plan-action="select" data-id="${r.id}" aria-label="${esc(label)}" title="${esc(label)}">${barContent}</button>`:button('locate','기간으로 이동',`data-date="${r.start_date}"`);
      } else if(!r.period_conflict && (r.start_date || r.target_date)) {
        const date=r.start_date||r.target_date;
        if(position(date)>=0 && position(date)<=100) bar=`<button type="button" class="plan-date-point status-${r.status}" data-plan-left="${position(date)}" data-plan-action="select" data-id="${r.id}" aria-label="${esc(label)}" title="${esc(label)}">${icon('milestone')}</button>`;
        else bar=button('locate','날짜로 이동',`data-date="${date}"`);
      }
      const rowMeta=snapshot.can_edit && !r.start_date && !r.target_date
        ? button('edit-period','기간 미정',`class="plan-period-edit" data-id="${r.id}" aria-label="${esc(r.name)} 기간 설정" title="날짜 입력"`)
        : summary&&childRows.length?`<span class="plan-progress-text" aria-label="${completed}/${childRows.length} 완료" title="하위 작업 ${childRows.length}개 중 ${completed}개 완료">${completed}/${childRows.length}</span>`:'';
      return `<div class="${summary?'plan-time-group':'plan-time-row'}${rowIndex%2===0?' is-even':''}"><div class="plan-time-label${summary?'':' is-child'}"><span class="plan-row-index" aria-hidden="true">${rowIndex}</span><div class="plan-task-content"><div class="plan-task-title">${button('select',`${icon(r.status)}${esc(r.name)}`,`data-id="${r.id}" title="${esc(r.name)} · ${esc(period(r))}"`)}${flags(r)}</div>${rowMeta?`<div class="plan-task-meta">${rowMeta}</div>`:''}${issueWarning(r,item(r.parent_id))}</div></div><div class="plan-time-track">${bar}</div></div>`;
    };
    const visibleDomains=domains();
    const actions=`${button('imports','가져오기')}${button('today','오늘')}${button('fit','전체 맞춤',`aria-pressed="${fitted}"`)}<label>단위 <select data-plan-scale aria-label="타임라인 단위"><option value="day" ${scale==='day'?'selected':''}>일</option><option value="week" ${scale==='week'?'selected':''}>주</option><option value="month" ${scale==='month'?'selected':''}>월</option></select></label>${snapshot.can_edit?button('launch','출시 목표일'):''}`;
    const context=`${iso(start)} – ${iso(end)}${snapshot.settings.launch_date?` · 출시 목표 ${snapshot.settings.launch_date}`:''}`;
    panel.innerHTML = dashboardHeader(actions) + `<p class="plan-muted plan-dashboard-context">${esc(context)}</p>` +
      `${!visibleDomains.length?'<p class="plan-empty">하위 작업에 목표 기간을 입력하면 전체 일정이 표시됩니다.</p>':`<div class="plan-timeline-scroll" tabindex="0" aria-label="전체 일정 타임라인"><div class="plan-timeline${fitted?' is-fitted':''}" data-plan-chart-width="${minWidth}"><div class="plan-time-header"><strong><span class="plan-index-heading">#</span><span>작업</span></strong><div>${ticks.join('')}${marker(today(),'오늘','today',true)}</div></div><div class="plan-time-body"><div class="plan-day-band-layer" aria-hidden="true">${dayBands}</div>${visibleDomains.map(d=>timelineRow(d,true)+children(d.id).map(f=>timelineRow(f)).join('')).join('')}<div class="plan-grid-layer" aria-hidden="true">${ticks.map(t=>t.replace('<span','<i class="plan-grid-line"').replace(/>[^<]*<\/span>/,'></i>')).join('')}</div><div class="plan-marker-layer">${marker(today(),'오늘','today')}${marker(snapshot.settings.launch_date,'출시','launch')}</div></div></div></div>`}`;
    // Assign individual CSS properties; HTML style attributes are blocked by the server CSP.
    panel.querySelectorAll('[data-plan-left]').forEach(el=>{el.style.left=`${Number(el.dataset.planLeft)}%`;});
    panel.querySelectorAll('[data-plan-width]').forEach(el=>{el.style.width=`${Number(el.dataset.planWidth)}%`;});
    const timeline=panel.querySelector('[data-plan-chart-width]');
    if(timeline) timeline.style.setProperty('--plan-chart-width',`${Number(timeline.dataset.planChartWidth)}px`);
    const scroller = panel.querySelector('.plan-timeline-scroll');
    if(scroller) { scroller.scrollLeft=timelineScroll; scroller.addEventListener('scroll',()=>{
      timelineScroll=scroller.scrollLeft;
      clearTimeout(scrollStateTimer);
      scrollStateTimer=setTimeout(rememberState, 120);
    }); }
  }
  async function renderImports(id = null) {
    panel.classList.remove('is-timeline');
    if (!scope) return;
    const own=epoch, version=++importVersion, current=scope;
    panel.innerHTML=header('일정 가져오기',button('select','전체 일정', 'data-id=""'))+'<p class="ui-message" role="status">가져오기 내역 불러오는 중…</p>';
    try {
      const data=await current.api(current.path+'/imports'+(id?'/'+encodeURIComponent(id):''));
      if(own!==epoch || version!==importVersion || !importView) return;
      const top=header('일정 가져오기',button('select','전체 일정','data-id=""'));
      if(!id) {
        panel.innerHTML=top+`<p>사용하는 AI에 원본 파일 또는 서비스와 우리 MCP를 연결한 뒤, “이 일정을 가져와 미리보기를 만들어 줘”라고 요청하세요.</p><p class="plan-muted">AI가 제출한 변환안을 여기서 검토하고 반영합니다. 새 요청은 새로고침으로 확인하세요.</p>${button('imports','내역 새로고침')}<div class="plan-table-scroll"><table class="plan-table"><thead><tr><th>원본</th><th>읽은 범위</th><th>상태</th></tr></thead><tbody>${data.map(r=>`<tr><td>${button('import-detail',esc(r.source.label),`data-id="${esc(r.id)}"`)}</td><td>${esc(r.source.read_scope)}</td><td>${r.status==='applied'?'반영 완료':r.can_apply?'검토 대기':'오류 확인 필요'}</td></tr>`).join('')}</tbody></table></div>${!data.length?'<p>아직 제출된 가져오기 내역이 없습니다.</p>':''}`;
        return;
      }
      const fieldNames={name:'작업 이름',description:'설명',acceptance:'완료 조건',assignee:'담당자',status:'상태',blocked_reason:'막힌 이유',start_date:'시작일',target_date:'목표일'};
      const show=v=>v===null?'미정':typeof v==='object'?JSON.stringify(v):String(v??'');
      panel.innerHTML=top+button('imports','가져오기 목록')+`<h2>${esc(data.source.label)}</h2><p>읽은 범위: ${esc(data.source.read_scope)}</p><p>원본 위치: ${esc(data.source.location||'미제공')}</p>
        ${data.errors.length?`<div role="alert"><h3>반영 전 해결 필요</h3><ul>${data.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><p>AI에 수정한 변환안을 새 요청으로 제출하도록 요청하세요.</p></div>`:''}
        ${data.warnings.length?`<h3>확인할 내용</h3><ul>${data.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}
        <div class="plan-table-scroll"><table class="plan-table"><thead><tr><th>작업 / 상위 작업</th><th>변경</th><th>내용 비교</th><th>원본과 보정 근거</th></tr></thead><tbody>${data.operations.map(o=>`<tr><td>${esc(o.after.name)}<br><span class="plan-muted">${esc(data.operations.find(p=>p.id===o.parent_id)?.after.name || item(o.parent_id)?.name || '최상위 작업')}</span></td><td>${({create:'추가',update:'수정',unchanged:'동일'})[o.action]}</td><td>${Object.entries(o.after).filter(([k,v])=>!o.before||o.before[k]!==v).map(([k,v])=>`<div><strong>${esc(fieldNames[k]||k)}</strong>: ${o.before?esc(show(o.before[k]))+' → ':''}${esc(show(v))}</div>`).join('')||'변경 없음'}</td><td><p>${esc(o.source_location||o.source_id)}</p>${Object.entries(o.original_values).map(([k,v])=>`<div>${esc(k)}: ${esc(v)}</div>`).join('')}${o.corrections.map(c=>`<p>${esc(fieldNames[c.field]||c.field)}: ${esc(c.original)} → ${esc(show(o.after[c.field]))}<br>${esc(c.reason)}</p>`).join('')}${o.questions.map(q=>`<p>확인 필요: ${esc(q)}</p>`).join('')}</td></tr>`).join('')}</tbody></table></div>
        ${data.status==='applied'?'<p class="ui-message" role="status">반영 완료</p>':snapshot.can_edit&&data.can_apply?`<label><input type="checkbox" data-import-reviewed> 작업 구조와 변경 내용${data.warnings.length?' 및 위 확인할 내용':''}을 검토했습니다.</label>${button('import-apply','일정에 반영',`data-id="${esc(data.id)}" data-digest="${esc(data.preview_digest)}"`)}`:''}`;
    } catch(error) {
      if(own!==epoch || version!==importVersion || !importView) return;
      panel.innerHTML=header('일정 가져오기',button('select','전체 일정','data-id=""'))+`<p class="ui-message" role="alert">${esc(error.message)}</p>${button(id?'import-detail':'imports','다시 시도',id?`data-id="${esc(id)}"`:'')}`;
    }
  }
  async function applyImport(b) {
    if(!panel.querySelector('[data-import-reviewed]')?.checked) { message('작업 구조와 변경 내용을 검토한 뒤 확인란을 선택하세요.'); return; }
    const own=epoch, current=scope, version=importVersion;
    busy=true;
    b.setAttribute("aria-busy", "true"); b.disabled=true;
    try {
      await current.api(current.path+'/imports/'+encodeURIComponent(b.dataset.id)+'/apply',{method:'POST',body:JSON.stringify({preview_digest:b.dataset.digest,acknowledge_warnings:true})});
      if(own!==epoch) return;
      const updated=await current.api(current.path);
      if(own!==epoch) return;
      snapshot=updated;
      renderSidebar();
      if(importView && version===importVersion) await renderImports(b.dataset.id);
    } catch(error) { if(own===epoch && version===importVersion) message(error.message, 'error'); }
    finally {if(own===epoch)busy=false; b.disabled=false; b.removeAttribute('aria-busy');}
  }
  function editor(r, creating = false) {
    if (r.kind==='domain' && !creating) r={...r,start_date:r.configured_start_date??null,target_date:r.configured_target_date??null};
    if (r.id && drafts.has(r.id)) r = {...r, ...drafts.get(r.id)};
    const field = (name,label,type='text',value=r[name]||'',max='') => `<label class="ui-field"><span>${label}${name==='name'?' <span aria-hidden="true">*</span>':''}</span><input aria-label="${label}" name="${name}" type="${type}" value="${esc(value)}" ${max?`maxlength="${max}"`:''} ${name==='name'?'required':''}></label>`;
    const area = (name,label,max) => `<label class="ui-field">${label}<textarea name="${name}" aria-label="${label}" rows="3" maxlength="${max}">${esc(r[name]||'')}</textarea></label>`;
    return `<form class="plan-form" data-plan-form data-id="${r.id||''}" data-kind="${r.kind}" data-parent="${r.parent_id||''}" data-revision="${r.revision||0}">
      <p class="plan-muted">* 필수 항목</p>${field('name','작업 이름','text',r.name||'',200)}
      ${r.kind!=='domain'?`<div class="plan-form-grid"><label class="ui-field">상태<select name="status" aria-label="상태">${Object.entries(statuses).map(([v,l])=>`<option value="${v}" ${r.status===v?'selected':''}>${l}</option>`).join('')}</select></label>${field('assignee','담당자','text',r.assignee||'',160)}</div>`:''}
      <div class="plan-form-grid">${r.kind!=='issue'?field('start_date','시작일','date'):''}${field('target_date','목표일','date')}</div>
      ${r.kind==='domain'?'<p class="plan-muted">비워 둔 날짜는 하위 작업에서 집계합니다.</p>':''}
      ${r.kind==='feature'?area('acceptance','완료 조건',10000):''}${area('description','설명',20000)}${r.kind!=='domain'?area('blocked_reason','막힌 이유',2000):''}
      <p class="plan-form-error ui-message" role="alert"></p><footer>${!creating?button('delete','삭제',`data-id="${r.id}" data-revision="${r.revision}"`):''}${button('cancel','취소',`data-id="${r.id||''}"`)}<button class="ui-button ui-button--primary" type="submit">${creating?'추가':'저장'}</button></footer></form>`;
  }
  const dialog = document.createElement('dialog'); dialog.className='workspace-dialog plan-dialog'; dialog.setAttribute('aria-labelledby','plan-dialog-title'); document.body.append(dialog);
  const editorDialogUI = ui.bindNativeDialog(dialog);
  function showEditorDialog() {
    dialog.classList.add('af-kit');
    dialog.querySelectorAll('label.ui-field').forEach(caption => {
      const control = caption.querySelector('input,select,textarea');
      const text = control.getAttribute('aria-label') || caption.firstChild.textContent.trim();
      const field = ui.fieldFor({label:text,control});
      if (control.required) {
        const mark=document.createElement('span'); mark.textContent=' *'; mark.setAttribute('aria-hidden','true');
        const line=document.createElement('span'); line.append(document.createTextNode(text),mark);
        field.root.querySelector('label').replaceChildren(line);
      }
      caption.replaceWith(field.root);
    });
    editorDialogUI.open();
  }
  function openEditor(r, creating=false) { dialog.innerHTML=`<h2 id="plan-dialog-title">${kinds[r.kind]} ${creating?'추가':'수정'}</h2>${editor(r,creating)}`; showEditorDialog(); }
  function message(text, kind = 'warning') {
    const el=panel.querySelector('.plan-message');
    if (!el) return;
    inlineStatus(el, text, kind);
  }
  function inlineStatus(el, text, kind = 'error') {
    el.classList.add('af-status--inline');
    ui.setStatus(el,{kind,text});
  }
  async function reload() {
    if(!scope) return;
    const own=epoch, current=scope, requestVersion=++loadVersion;
    try {
      const data=await current.api(current.path);
      if(own!==epoch || requestVersion!==loadVersion) return;
      if (!Array.isArray(data.items) || !data.settings) throw new Error('일정 응답을 확인할 수 없습니다.');
      snapshot=data;
      const ids = new Set(snapshot.items.map(row => row.id));
      if (selected && !ids.has(selected)) selected = null;
      collapsed = new Set([...collapsed].filter(id => ids.has(id)));
      expanded = new Set([...expanded].filter(id => ids.has(id)));
      render(); rememberState();
      return true;
    } catch(error) {
      if(own!==epoch || requestVersion!==loadVersion) return;
      rememberDrafts();
      panel.classList.remove('is-timeline');
      sidebar.innerHTML=button('refresh','다시 시도');
      panel.innerHTML=header('일정')+ui.status({kind:'error',text:`일정을 불러오지 못했습니다. ${error.message}`}).outerHTML+button('refresh','다시 시도');
    }
  }
  async function mutate(path, options, errorHost, done) {
    if(busy || !scope) return;
    const own=epoch, current=scope;
    busy=true;
    errorHost.setAttribute("aria-busy", "true");
    const controls=[...errorHost.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);
    try {
      await current.api(current.path+path,options);
      if(own!==epoch) return;
      done?.();
      if (await reload()) message('저장했습니다.', 'success');
    } catch(error) {
      if(own!==epoch) return;
      const target=errorHost.querySelector('.plan-form-error') || panel.querySelector('.plan-message');
      if(target) inlineStatus(target,error.status===409?`${error.message} 입력 내용은 유지됩니다. 최신 내용을 가져오려면 편집을 취소하고 새로고침하세요.`:error.status===422?'입력 내용을 확인하세요. 시작일은 목표일보다 늦을 수 없습니다.':error.message);
    } finally { errorHost.removeAttribute("aria-busy"); if(own===epoch) busy=false; controls.forEach(([el,disabled])=>el.disabled=disabled); }
  }
  async function onClick(event) {
    const b=event.target.closest('[data-plan-action]'); if(!b || busy) return;
    const id=b.dataset.id, record=item(id);
    switch(b.dataset.planAction) {
      case 'dashboard': importView=false;importVersion++;selected=null;rememberState();render();panel.querySelector('h1')?.focus();break;
      case 'imports': rememberDrafts(); importView=true; rememberState(); void renderImports(); break;
      case 'import-detail': void renderImports(id); break;
      case 'import-apply': await applyImport(b); break;
      case 'view': importView=false; importVersion++; selected=null; activeView=b.dataset.view; rememberState(); render(); panel.querySelector('h1')?.focus(); break;
      case 'view-item': {
        const target=item(id); if(!target) break;
        importView=false; selected=target.kind==='issue'?target.parent_id:target.id;
        if(target.kind==='issue') expanded.add(target.id);
        rememberState(); render(); panel.querySelector('h1')?.focus(); break;
      }
      case 'select': importView=false; importVersion++; selected=id||null; if(!id)activeView='timeline'; rememberState(); render(); panel.querySelector('h1')?.focus(); break;
      case 'expand': expanded.has(id)?expanded.delete(id):expanded.add(id); rememberState(); render(); panel.querySelector(`[data-plan-action="expand"][data-id="${id}"]`)?.focus(); break;
      case 'add': openEditor({kind:b.dataset.kind,parent_id:b.dataset.parent,status:'pending'},true); break;
      case 'edit-period': openEditor(record); dialog.querySelector('[name="start_date"],[name="target_date"]')?.focus(); break;
      case 'edit': openEditor(record); break;
      case 'cancel': if(dialog.open) {drafts.delete(dialog.querySelector('form')?.dataset.id); dialog.close();} else { event.target.closest('form')?.remove(); drafts.delete(id); expanded.delete(id);render();} break;
      case 'delete':
        if(!confirm(`“${record.name}”을 삭제하시겠습니까? 하위 항목이 있으면 삭제되지 않습니다.`)) return;
        await mutate(`/items/${id}?revision=${b.dataset.revision}`,{method:'DELETE'},b.closest('form'),()=>{if(dialog.open)dialog.close(); if(selected===id)selected=record.parent_id;}); break;
      case 'refresh': await reload(); break;
      case 'today': fitted=false;anchor=today();timelineScroll=0;rememberState();renderTimeline();break;
      case 'locate': fitted=false;anchor=b.dataset.date;timelineScroll=0;rememberState();renderTimeline();break;
      case 'fit': fitted=true;timelineScroll=0;rememberState();renderTimeline();break;
      case 'launch':
        dialog.innerHTML=`<h2 id="plan-dialog-title">출시 목표일</h2><form class="plan-form" data-plan-settings data-revision="${snapshot.settings.revision}"><label class="ui-field">목표일<input type="date" name="launch_date" value="${snapshot.settings.launch_date||''}"></label><p class="ui-message plan-form-error" role="alert"></p><footer>${button('cancel','취소')}<button class="ui-button ui-button--primary" type="submit">저장</button></footer></form>`;showEditorDialog();break;
    }
  }
  dialog.addEventListener('cancel', () => drafts.delete(dialog.querySelector('form')?.dataset.id));
  async function onSubmit(event) {
    const form=event.target;
    if(!form.matches('[data-plan-form],[data-plan-settings]'))return;
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form));
    if(form.dataset.id) drafts.set(form.dataset.id,{...values,revision:Number(form.dataset.revision)});
    if(form.hasAttribute('data-plan-settings')) {
      await mutate('/settings',{method:'PUT',body:JSON.stringify({launch_date:values.launch_date||null,revision:Number(form.dataset.revision)})},form,()=>dialog.close());return;
    }
    const payload={...values,start_date:values.start_date||null,target_date:values.target_date||null};
    if(payload.start_date && payload.target_date && payload.start_date>payload.target_date) {inlineStatus(form.querySelector('.plan-form-error'),'시작일은 목표일보다 늦을 수 없습니다.');return;}
    const id=form.dataset.id;
    if(id)payload.revision=Number(form.dataset.revision);
    else {payload.kind=form.dataset.kind;payload.parent_id=form.dataset.parent||null;}
    await mutate(id?`/items/${id}`:'/items',{method:id?'PUT':'POST',body:JSON.stringify(payload)},form,()=>{form.remove();drafts.delete(id);if(dialog.open)dialog.close();});
  }
  [sidebar,panel,dialog,headerActions].forEach(el=>el.addEventListener('click',onClick));
  [panel,dialog].forEach(el=>el.addEventListener('submit',onSubmit));
  panel.addEventListener('change',async e=>{if(e.target.matches('[data-plan-scale]')){scale=e.target.value;fitted=false;rememberState();renderTimeline();return;}if(e.target.matches('[data-plan-status]')){const r=item(e.target.dataset.id);if(r&&r.status!==e.target.value)await mutate(`/items/${r.id}`,{method:'PUT',body:JSON.stringify(updatePayload(r,{status:e.target.value}))},panel);}});
  panel.addEventListener('dragstart',e=>{const card=e.target.closest('[data-plan-card]');if(card&&snapshot.can_edit)e.dataTransfer.setData('text/plain',card.dataset.id);});
  panel.addEventListener('dragover',e=>{if(snapshot.can_edit&&e.target.closest('[data-plan-column]'))e.preventDefault();});
  panel.addEventListener('drop',async e=>{const column=e.target.closest('[data-plan-column]');if(!column||!snapshot.can_edit)return;e.preventDefault();const r=item(e.dataTransfer.getData('text/plain'));if(r&&r.status!==column.dataset.planColumn)await mutate(`/items/${r.id}`,{method:'PUT',body:JSON.stringify(updatePayload(r,{status:column.dataset.planColumn}))},panel);});
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(() => {if(scope && !importView && selected===null && fitted && panel.clientWidth) renderTimeline();},80);
  }).observe(panel);
  window.agentFactoryPlanning = {
    async openItem(id) {
      const own=epoch;
      const loaded=await reload();
      if (own!==epoch) return false;
      if (!loaded) throw new Error('연결된 일정을 불러오지 못했습니다.');
      const record=item(id);
      if (!record) throw new Error('연결된 일정 항목을 찾을 수 없습니다.');
      selected=record.kind==='issue'?record.parent_id:record.id;
      if(record.kind==='issue') expanded.add(record.id);
      rememberState(); render();
      if(record.kind==='issue') panel.querySelector(`[aria-controls="issue-${record.id}"]`)?.focus();
      else panel.querySelector('h1')?.focus();
      return true;
    },
    reset() { importView=false; importVersion++; epoch++;clearTimeout(scrollStateTimer);scope=null;snapshot={items:[],settings:{},calendar:{},can_edit:false};selected=null;activeView='timeline';collapsed=new Set();expanded=new Set();drafts=new Map();loadVersion++;busy=false;timelineScroll=0;anchor=today();scale='week';fitted=false;if(dialog.open)dialog.close(); panel.classList.remove('is-timeline');planningExplorer?.destroy();planningExplorer=null;sidebar.replaceChildren();panel.replaceChildren();headerActions.querySelector('[data-plan-action="dashboard"]').setAttribute('aria-pressed','false');headerActions.querySelector('[data-plan-action="add"]').hidden=true; },
    open({api,organizationId,workspaceId,preferences}) {
      this.reset();scope={api,organizationId,workspaceId,preferences,path:`/api/organizations/${organizationId}/workspaces/${workspaceId}/plan`};
      const saved=preferences?.read({}) || {};
      if(saved.view in views)activeView=saved.view;
      selected=typeof saved.selectedId==='string'?saved.selectedId:null;
      importView=saved.importView===true;
      collapsed=new Set(Array.isArray(saved.collapsedIds)?saved.collapsedIds.filter(id=>typeof id==='string'):[]);
      expanded=new Set(Array.isArray(saved.expandedIds)?saved.expandedIds.filter(id=>typeof id==='string'):[]);
      if(['day','week','month'].includes(saved.scale))scale=saved.scale;
      fitted=saved.fitted===true;
      if(/^\d{4}-\d{2}-\d{2}$/.test(saved.anchor||''))anchor=saved.anchor;
      if(Number.isFinite(saved.timelineScroll)&&saved.timelineScroll>=0)timelineScroll=saved.timelineScroll;
      sidebar.innerHTML='<p class="ui-message" role="status">일정 불러오는 중…</p>';panel.innerHTML='<p class="ui-message" role="status">일정 불러오는 중…</p>';void reload();
    },
  };
})();
