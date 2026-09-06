/* Read-only external reports. Connection silence never changes reported state. */
(() => {
  const sidebar = document.querySelector('[data-reporting-sidebar]');
  const panel = document.querySelector('[data-reporting-panel]');
  if (!sidebar || !panel) return;
  const labels = {pending:'대기', in_progress:'진행 중', input_required:'입력 필요', completed:'완료', failed:'실패', cancelled:'취소'};
  const terminal = new Set(['completed','failed','cancelled']);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button = (action, label, id='') => `<button type="button" data-reporting-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
  const date = value => value ? esc(new Date(value).toLocaleString('ko-KR')) : '보고 없음';
  let scope, epoch=0, loadVersion=0, detailVersion=0, timer, selected=null, taskId=null;
  let snapshot={agents:[],tasks:[]}, detail=null, error='', detailError='', loading=false, loadingDetail=false, received=0;
  function freshness(row) {
    if (!row.last_report_at) return '보고 없음';
    if (!terminal.has(row.status) && Date.now()-Date.parse(row.last_report_at) > 300000) return '보고 오래됨 · 마지막 상태 유지';
    return '마지막 보고';
  }
  function hierarchy() {
    const byId=new Map(snapshot.agents.map(a=>[a.id,a]));
    const children=new Map();
    snapshot.agents.forEach(a=>{const parent=byId.has(a.parent_id)?a.parent_id:null; if(!children.has(parent))children.set(parent,[]);children.get(parent).push(a);});
    const seen=new Set();
    const branch=(parent,depth=0)=>(children.get(parent)||[]).map(a=>{
      if(seen.has(a.id))return '';seen.add(a.id);
      const active=snapshot.tasks.filter(t=>t.agent_id===a.id&&!terminal.has(t.status));
      return `<li><button class="app-sidebar__row app-sidebar__row--detail" type="button" data-reporting-action="agent" data-id="${esc(a.id)}" ${selected===a.id?'aria-current="page"':''} title="${esc(a.name+' · '+a.role)}"><strong>${esc(a.name)}</strong><span>${esc(a.role)}</span><small>${active.length?esc(active.map(t=>`${t.name} · ${labels[t.status]}`).join(', ')):'현재 작업 없음'}</small></button>${depth<64?`<ul>${branch(a.id,depth+1)}</ul>`:''}</li>`;
    }).join('');
    return `<ul class="reporting-tree">${branch(null)}</ul>`;
  }
  const taskRow = t => `<li>${button('task',t.name,t.id)} <span class="reporting-status">${labels[t.status]||esc(t.status)}</span> · ${esc(snapshot.agents.find(a=>a.id===t.agent_id)?.name||t.agent_id)}${t.progress!==null?` · 보고된 진행률 ${t.progress}%`:''}<small>${freshness(t)} · ${date(t.last_report_at)}</small></li>`;
  function taskList(title, rows) {return `<section><h2>${title}</h2>${rows.length?`<ul class="reporting-tasks">${rows.map(taskRow).join('')}</ul>`:'<p class="reporting-muted">작업 없음</p>'}</section>`;}
  function resultView(r) {
    let link='';
    if(r.document_id) link=button('document','문서 열기',r.document_id);
    else if(r.url) {
      try {const url=new URL(r.url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)link=`<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">결과 링크 열기</a>`;}catch{}
    }
    return `<li><strong>${esc(r.label)}</strong><p>${esc(r.summary)}</p>${link}</li>`;
  }
  function renderDetail() {
    if(loadingDetail&&!detail)return '<p role="status">작업 보고 불러오는 중…</p>';
    if(detailError)return `<p role="alert">${esc(detailError)}</p>${button('task','다시 시도',taskId)}`;
    if(!detail)return '';
    const t=detail.task;
    const parent=snapshot.tasks.find(r=>r.id===t.parent_id);
    return `<section class="reporting-detail"><h2 tabindex="-1">${esc(t.name)}</h2><p>${esc(t.description)}</p><p>${labels[t.status]} · ${freshness(t)} · ${date(t.last_report_at)}</p>
      <p>시작 ${date(t.started_at)} · 종료 ${date(t.finished_at)} · 수정 ${t.revision}</p>
      ${t.progress!==null?`<label>보고된 진행률 ${t.progress}% <progress max="100" value="${t.progress}"></progress></label>`:'<p>진행률 보고 없음</p>'}
      ${t.parent_id?`<p>상위 작업 ${button('task',parent?.name||t.parent_id,t.parent_id)}</p>`:''}
      ${t.plan_item_id?button('plan','연결된 일정 항목 열기',t.plan_item_id):''}
      ${button('logs','관련 MCP 보고 로그')}
      ${taskList('하위 작업',snapshot.tasks.filter(r=>r.parent_id===t.id))}
      <h3>보고 이력</h3><ol class="reporting-history">${detail.reports.map(r=>`<li><strong>${labels[r.status]} · 수정 ${r.revision}</strong><small>${date(r.received_at)} · 보고자 ${esc(r.reporter_user_id)} · 연결 ${esc(r.connection_id||'일반 API 토큰')}</small><p>${esc(r.message)}</p><ul>${detail.results.filter(x=>x.report_id===r.id).map(resultView).join('')}</ul></li>`).join('')||'<li>보고 없음</li>'}</ol>
      ${detail.next_before_revision?button('older','이전 보고 더 보기'):''}
      <div data-reporting-logs hidden tabindex="-1"><h3>관련 MCP 보고 로그</h3><p>이 작업의 표시된 보고와 함께 저장된 호출 기록입니다.</p><ul>${detail.logs.map(l=>`<li>${date(l.occurred_at)} · ${esc(l.action)} · ${esc(l.outcome)}<small>기록 ${esc(l.id)} · 보고자 ${esc(l.actor_user_id)}</small></li>`).join('')||'<li>기록 없음</li>'}</ul></div></section>`;
  }
  function render() {
    const focus=document.activeElement?.closest('[data-reporting-action]');
    const focusKey=focus&&[focus.dataset.reportingAction,focus.dataset.id];
    const tree=hierarchy();
    sidebar.innerHTML=`<nav class="app-sidebar__nav" aria-label="에이전트 탐색"><button class="app-sidebar__row" type="button" data-reporting-action="overall" data-id="" ${selected===null?'aria-current="page"':''}>전체 에이전트</button>${tree}</nav>`+(!received&&loading?'<p class="app-sidebar__state" role="status">에이전트 불러오는 중…</p>':!received&&error?'<p class="app-sidebar__state" role="alert">에이전트를 불러오지 못했습니다.</p>'+button('refresh','다시 시도'):!snapshot.agents.length?'<p class="app-sidebar__state reporting-muted">등록된 에이전트 없음</p>':'');
    const agent=snapshot.agents.find(a=>a.id===selected);
    const tasks=selected?snapshot.tasks.filter(t=>t.agent_id===selected):snapshot.tasks;
    panel.innerHTML=`<header><h1>${esc(agent?.name||'전체 에이전트')}</h1>${button('refresh','새로고침')}</header><p class="reporting-muted">외부 에이전트가 MCP로 보고한 구성과 작업입니다. AI 실행은 연결한 도구에서 수행합니다.</p>
      ${loading?'<p role="status">불러오는 중…</p>':''}${error?`<p role="alert">${esc(error)} · 이전 자료가 있으면 마지막 수신 자료입니다.</p>`:''}
      <p role="status">${received?'화면 수신 '+date(received):'수신 대기'} · 15초마다 새로고침 · 5분 무보고 시 오래됨 표시</p>
      ${snapshot.truncated?'<p role="status">최대 1,000개 구성과 최근 1,000개 작업을 표시합니다. 일부 계층과 작업은 생략되었습니다.</p>':''}
      ${agent?`<p><strong>역할</strong> ${esc(agent.role)}</p><p><strong>책임</strong> ${esc(agent.responsibilities)}</p><p>범위: 현재 워크스페이스 ${esc(agent.workspace_id)} · 구성 수정 ${agent.revision}</p><p>보고 소유자 ${esc(agent.owner_user_id)} · ${freshness(agent)} ${date(agent.last_report_at)}</p>${agent.parent_id?button('agent','상위 에이전트',agent.parent_id):''}`:`<section><h2>에이전트 계층</h2>${tree||'등록된 에이전트 없음'}</section>`}
      ${taskList('대기 작업',tasks.filter(t=>t.status==='pending'))}${taskList('진행 중 / 입력 필요',tasks.filter(t=>['in_progress','input_required'].includes(t.status)))}${taskList('최근 수행 작업',tasks.filter(t=>terminal.has(t.status)))}${taskId?renderDetail():''}`;
    if(focusKey) [sidebar,panel].flatMap(el=>[...el.querySelectorAll('[data-reporting-action]')]).find(el=>el.dataset.reportingAction===focusKey[0]&&el.dataset.id===focusKey[1])?.focus({preventScroll:true});
  }
  async function loadTask(id, older=false, quiet=false) {
    if(!scope)return;
    const own=epoch, version=++detailVersion, current=scope;
    taskId=id;detailError='';loadingDetail=true;
    if(!older&&!quiet)detail=null;
    render();
    const before=older?detail?.next_before_revision:null;
    try {
      const data=await current.api(`${current.path}/tasks/${encodeURIComponent(id)}${before?`?before_revision=${before}`:''}`);
      if(own!==epoch||version!==detailVersion||taskId!==id)return;
      if(!data.task||!Array.isArray(data.reports)||!Array.isArray(data.results)||!Array.isArray(data.logs))throw new Error('작업 응답 형식 오류');
      detail=older?{...data,reports:[...detail.reports,...data.reports],results:[...detail.results,...data.results],logs:[...detail.logs,...data.logs]}:data;
    } catch(e) {if(own!==epoch||version!==detailVersion)return;detailError=`작업 보고를 불러오지 못했습니다. ${e.message}`;}
    finally {if(own===epoch&&version===detailVersion){loadingDetail=false;render();}}
  }
  async function reload() {
    if(!scope)return;
    const own=epoch,version=++loadVersion,current=scope;
    loading=true;render();
    try {
      const data=await current.api(current.path);
      if(own!==epoch||version!==loadVersion)return;
      if(!Array.isArray(data.agents)||!Array.isArray(data.tasks))throw new Error('에이전트 응답 형식 오류');
      snapshot=data;error='';received=Date.now();
      if(selected&&!snapshot.agents.some(a=>a.id===selected)){selected=null;taskId=null;detail=null;detailVersion++;}
      if(taskId&&!loadingDetail)void loadTask(taskId,false,true);
    }catch(e){if(own!==epoch||version!==loadVersion)return;error=`보고를 불러오지 못했습니다. ${e.message}`;}
    finally{if(own===epoch&&version===loadVersion){loading=false;render();}}
  }
  async function click(event) {
    const b=event.target.closest('[data-reporting-action]');if(!b||!scope)return;
    const id=b.dataset.id;
    switch(b.dataset.reportingAction){
      case 'overall': selected=null;taskId=null;detail=null;detailVersion++;render();break;
      case 'agent': selected=id;taskId=null;detail=null;detailVersion++;render();break;
      case 'task': await loadTask(id);panel.querySelector('.reporting-detail h2')?.focus();break;
      case 'refresh': await reload();break;
      case 'older': await loadTask(taskId,true);break;
      case 'plan': case 'document': {
        const own=epoch;
        try {await scope.navigate(b.dataset.reportingAction,id);}catch(e){if(own===epoch){detailError=e.message;render();}}break;
      }
      case 'logs': {const logs=panel.querySelector('[data-reporting-logs]');logs.hidden=false;logs.focus();break;}
    }
  }
  sidebar.addEventListener('click',click);panel.addEventListener('click',click);
  window.addEventListener('online',()=>{if(scope)void reload();});
  window.agentFactoryReporting={
    reset(){epoch++;loadVersion++;detailVersion++;clearInterval(timer);scope=null;selected=null;taskId=null;detail=null;snapshot={agents:[],tasks:[]};error='';detailError='';loading=false;loadingDetail=false;received=0;sidebar.replaceChildren();panel.replaceChildren();},
    open({api,organizationId,workspaceId,navigate}){this.reset();scope={api,navigate,path:`/api/organizations/${organizationId}/workspaces/${workspaceId}/reporting`};void reload();timer=setInterval(()=>{if(!document.hidden&&!loading)void reload();},15000);},
  };
})();
