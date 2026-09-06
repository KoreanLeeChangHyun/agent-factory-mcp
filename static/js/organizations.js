/* Organization management uses the application's authenticated API adapter. */
(() => {
  const host = document.querySelector('[data-organization-content]');
  const nav = document.querySelector('[data-organization-navigation]');
  let config, generation = 0, currentView = 'members';
  const element = (tag, text, attrs = {}) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const button = (text, action) => {
    const node = element('button', text, {type: 'button'});
    node.addEventListener('click', action);
    return node;
  };
  const input = (name, value = '', type = 'text') => element('input', null, {name, value, type});
  const label = (text, control) => {
    const node = element('label', text); node.append(control); return node;
  };
  const select = (name, choices, selected) => {
    const node = element('select', null, {name});
    for (const [value, text] of choices) node.append(element('option', text, {value}));
    if (selected != null) node.value = selected;
    return node;
  };
  const roleNames = {organization_owner:'조직 소유자', organization_admin:'조직 관리자', organization_member:'구성원', workspace_owner:'작업공간 소유자', workspace_admin:'작업공간 관리자', member:'편집자', viewer:'열람자'};
  const roleName = role => roleNames[role.name] || role.name;
  const statuses = {active:'활성', suspended:'정지', removed:'제거됨', pending:'초대 대기', accepted:'수락됨', cancelled:'취소됨', expired:'만료됨'};
  const errorBox = element('p', '', {role:'alert', class:'organization-error'});
  const table = (headers, rows) => {
    const wrap = element('div', null, {class:'organization-table-scroll'});
    const node = element('table');
    const head = element('tr'); headers.forEach(text => head.append(element('th', text, {scope:'col'})));
    const thead = element('thead'); thead.append(head); node.append(thead);
    const body = element('tbody');
    for (const cells of rows) {
      const row = element('tr');
      for (const cell of cells) { const td = element('td'); td.append(cell instanceof Node ? cell : document.createTextNode(String(cell ?? '—'))); row.append(td); }
      body.append(row);
    }
    if (!rows.length) { const row = element('tr'); row.append(element('td', '표시할 항목이 없습니다.', {colspan:headers.length})); body.append(row); }
    node.append(body); wrap.append(node); return wrap;
  };
  function form(title, controls, submitText, submit, alive) {
    const node = element('form', null, {class:'organization-form'});
    if (title) node.append(element('h3', title));
    controls.forEach(control => node.append(control));
    node.append(element('button', submitText, {type:'submit'}));
    const error = element('p', '', {role:'alert'}); node.append(error);
    let submitting = false;
    node.addEventListener('submit', async event => {
      event.preventDefault(); if (!alive() || submitting) return;
      submitting = true;
      const data = new FormData(node);
      const buttons = node.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
      error.textContent = '';
      try { await submit(data); } catch (e) { if (alive()) error.textContent = e.message; }
      finally { submitting = false; if (alive()) buttons.forEach(b => b.disabled = false); }
    });
    return node;
  }
  const actions = (...items) => {const node = element('div', null, {class:'organization-actions'}); node.append(...items); return node;};
  async function open(next = config, view = currentView) {
    config = next; currentView = view;
    const version = ++generation, alive = () => version === generation;
    const local = {...config};
    const base = `/api/organizations/${local.organizationId}`;
    const api = (path = '', options) => local.api(base + path, options);
    const mutate = (path, method, body) => api(path, {method, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    const refresh = () => alive() ? open(local, view) : undefined;
    host.replaceChildren(element('h1', {members:'구성원', teams:'팀', roles:'역할 및 권한', settings:'조직 설정'}[view]), errorBox);
    errorBox.textContent = '';
    nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.orgView === view ? 'page' : 'false'));
    const create = form('조직 만들기', [label('조직 이름', input('name'))], '만들기', async data => {
      const org = await local.api('/api/organizations', {method:'POST', body:JSON.stringify({name:data.get('name')})});
      if (alive()) await local.changed(org.id);
    }, alive);
    create.querySelector('input').required = true; create.querySelector('input').maxLength = 200;
    if (!local.organizationId) { host.append(element('p', '조직을 선택하거나 새 조직을 만드세요.'), create); return; }
    const loading = element('p', '불러오는 중입니다.', {role:'status'}); host.append(loading);
    try {
      const overview = await api(); if (!alive()) return;
      const can = key => overview.permissions.includes(key);
      const run = async task => {
        if (!alive()) return;
        try { await task(); if (alive()) await refresh(); }
        catch (e) { if (alive()) errorBox.textContent = e.message; }
      };
      const roleChoices = (roles, scope) => roles.filter(r => r.scope === scope).map(r => [r.id, roleName(r)]);
      loading.remove();
      if (view === 'members') {
        if (!can('member.read')) { host.append(element('p', '구성원 조회 권한이 없습니다.')); return; }
        const [members, roles, spaces, invitations] = await Promise.all([
          api('/members'), can('role.read') ? api('/roles') : [], api('/workspace-options'), can('member.invite') ? api('/invitations') : []]);
        if (!alive()) return;
        const search = input('search'); search.setAttribute('aria-label', '이름 또는 이메일 검색');
        const state = select('state', [['','전체 상태'], ...Object.entries(statuses).filter(([k]) => ['active','suspended','removed'].includes(k))]); state.setAttribute('aria-label','구성원 상태');
        const list = element('div');
        const draw = () => list.replaceChildren(table(['이름','이메일','조직 역할','상태'], members.filter(m => (!state.value || m.status === state.value) && `${m.name} ${m.email}`.toLowerCase().includes(search.value.toLowerCase())).map(m => [button(m.name, () => showMember(m).catch(e => {if(alive())errorBox.textContent=e.message;})), m.email, roleNames[m.role_name] || m.role_name, statuses[m.status]])));
        search.addEventListener('input',draw); state.addEventListener('change',draw); draw();
        const detail = element('section', null, {class:'organization-detail'});
        host.append(actions(search,state),list,detail);
        async function showMember(member) {
          const data = await api(`/members/${member.user_id}`); if (!alive()) return;
          Object.assign(member, data);
          const assignedRole=roles.find(role=>role.id===data.role_id);
          if(assignedRole)member.role_name=assignedRole.name;
          draw();
          detail.replaceChildren(element('h2', data.name), element('p', data.email));
          detail.append(element('h3','조직 적용 권한'));
          const orgSources=data.organization_sources || [];
          detail.append(table(['부여 경로','최종 권한'],orgSources.map(source=>[
            roleNames[source.role_name] || source.role_name || '조직 역할', source.permissions.join(', ')
          ])));
          detail.append(element('p', `소속 팀: ${data.teams.map(t=>t.name).join(', ') || '없음'}`));
          if (can('member.update_role') && can('role.assign')) detail.append(form('조직 역할', [label('역할', select('role', roleChoices(roles,'organization'), data.role_id))], '역할 저장', async f => {
            await mutate(`/members/${member.user_id}`, 'PATCH', {role_id:f.get('role')}); if(alive()) await showMember(member);
          }, alive));
          const stateActions = [];
          if (can('member.suspend') && data.status !== 'removed') stateActions.push(button(data.status === 'active' ? '활동 정지' : '활동 복구', () => run(async () => {if (confirm(`${member.name}님의 상태를 변경할까요?`)) await mutate(`/members/${member.user_id}`, 'PATCH', {status:data.status === 'active' ? 'suspended' : 'active'});} )));
          if (can('member.remove') && data.status !== 'removed') stateActions.push(button('조직에서 제거', () => run(async () => {if (confirm(`${member.name}님을 조직에서 제거할까요?`)) await mutate(`/members/${member.user_id}`, 'PATCH', {status:'removed'});} )));
          detail.append(actions(...stateActions));
          detail.append(element('h3', '작업공간 및 적용 권한'));
          detail.append(table(['작업공간','부여 경로','최종 권한'], data.workspaces.map(w => [w.name, w.sources.map(s => s.source === 'team' ? `팀: ${s.team_name}` : '직접 추가').join(', '), w.permissions.join(', ')])));
          if (spaces.length && data.status === 'active') {
            detail.append(form('작업공간 배정', [label('작업공간',select('workspace',spaces.map(w=>[w.id,w.name]))), label('역할',select('role',roleChoices(roles,'workspace')))], '배정 저장', async f => {
              await mutate(`/assignments/${f.get('workspace')}/members/${member.user_id}`, 'PUT', {role_id:f.get('role')}); if(alive()) await showMember(member);
            }, alive));
            for (const w of data.workspaces.filter(w => spaces.some(s=>s.id===w.workspace_id) && w.sources.some(s=>s.source==='direct'))) detail.append(button(`${w.name} 직접 배정 해제`, () => run(() => mutate(`/assignments/${w.workspace_id}/members/${member.user_id}`, 'DELETE'))));
          }
        }
        if (can('member.invite') && !overview.is_personal) {
          const fields = [label('이메일',input('email','','email')), label('조직 역할',select('role',roleChoices(roles,'organization'),'00000000-0000-4000-8000-000000000008'))];
          fields.push(label('참여 작업공간',select('workspace',[['','나중에 배정'],...spaces.map(w=>[w.id,w.name])])), label('작업공간 역할',select('workspaceRole',roleChoices(roles,'workspace'),'00000000-0000-4000-8000-000000000007')));
          const inviteForm = form('구성원 초대',fields,'초대 보내기',async f => {await mutate('/invitations','POST',{email:f.get('email'),role_id:f.get('role'),workspace_grants:f.get('workspace')?[{workspace_id:f.get('workspace'),role_id:f.get('workspaceRole')}]:[]});await refresh();},alive);
          inviteForm.querySelector('input').required=true; host.append(inviteForm);
          host.append(element('h2','초대 내역'),table(['이메일','상태','만료','관리'],invitations.map(i=>[i.email,statuses[i.status],new Date(i.expires_at).toLocaleString(),actions(...(['pending','expired'].includes(i.status)?[button('재전송',()=>run(()=>mutate(`/invitations/${i.id}/resend`,'POST'))),...(can('member.cancel_invite')?[button('취소',()=>run(()=>mutate(`/invitations/${i.id}`,'DELETE')))]:[])]:[]))])));
        }
      } else if (view === 'roles') {
        if (!can('role.read')) {host.append(element('p','역할 조회 권한이 없습니다.'));return;}
        const [roles,catalog] = await Promise.all([api('/roles'),api('/permission-catalog')]); if(!alive())return;
        const editor=element('section');
        function edit(role) {
          editor.replaceChildren();
          const name=input('name',role?.name||'');name.required=true;name.maxLength=80;
          const scope=select('scope',[['organization','조직'],['workspace','작업공간']],role?.scope||'workspace'); if(role)scope.disabled=true;
          const permissions=element('div',null,{class:'organization-permissions'});
          function draw(){permissions.replaceChildren(); for(const resource of [...new Set(catalog.filter(p=>p.scope===scope.value).map(p=>p.resource))]) {
            const group=element('fieldset');group.append(element('legend',catalog.find(p=>p.resource===resource)?.resource_label || resource));
            for(const p of catalog.filter(p=>p.scope===scope.value && p.resource===resource)) {
              const check=input('permissions',p.key,'checkbox');check.checked=!!role?.permissions.includes(p.key);check.disabled=p.available === false||p.owner_only||!!role?.is_system;
              const choice=element('div',null,{class:'organization-permission-choice'});
              check.id=`permission-${p.key}`;
              const title=label(p.label + (p.available === false ? " (기능 준비 중)" : p.owner_only ? " (소유자 전용)" : ""),check);
              choice.append(title,element('code',p.key));
              if(p.description) {
                const help=element('p',p.description,{id:`permission-help-${p.key}`});
                check.setAttribute('aria-describedby',help.id);choice.append(help);
              }
              group.append(choice);
            } permissions.append(group);
          }}
          scope.addEventListener('change',draw);draw();
          const f=form(role?'역할 편집':'역할 만들기',[label('이름',name),label('적용 범위',scope),permissions],role?'저장':'만들기',async data=>{
            await mutate(role?`/roles/${role.id}`:'/roles',role?'PUT':'POST',{name:data.get('name'),scope:scope.value,permissions:data.getAll('permissions')});await refresh();
          },alive);
          if(role?.is_system || !(role?can('role.update'):can('role.create'))) f.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);
          editor.append(f);
        }
        host.append(element('p','조직 권한과 작업공간 권한을 각각 조합합니다. 작업공간 역할은 참여자 또는 팀에 배정할 때 적용할 공간을 선택합니다.'));
        host.append(table(['역할','범위','종류','관리'],roles.map(r=>[button(roleName(r),()=>edit(r)),r.scope==='organization'?'조직':'작업공간',r.is_system?'기본':'사용자 지정',!r.is_system&&can('role.delete')?button('삭제',()=>run(async()=>{if(confirm('역할을 삭제할까요?'))await mutate(`/roles/${r.id}`,'DELETE');})):'' ])));
        if(can('role.create'))host.append(button('역할 만들기',()=>edit(null)));host.append(editor);
      } else if(view==='teams') {
        if(!can('team.read')){host.append(element('p','팀 조회 권한이 없습니다.'));return;}
        const [teams,members,roles,spaces]=await Promise.all([api('/teams'),can('member.read')?api('/members'):[],can('role.read')?api('/roles'):[],can('member.read')?api('/workspace-options'):[]]);if(!alive())return;
        const editor=element('section');
        function edit(team){
          editor.replaceChildren(element('h2',team.name));
          if(can('team.update'))editor.append(form('팀 정보',[label('이름',input('name',team.name)),label('설명',input('description',team.description))],'저장',async f=>{await mutate(`/teams/${team.id}`,'PUT',{name:f.get('name'),description:f.get('description')});await refresh();},alive));
          editor.append(table(['구성원','관리'],team.members.map(id=>[members.find(m=>m.user_id===id)?.name||id,can('team.manage_members')?button('팀에서 제외',()=>run(()=>mutate(`/teams/${team.id}/members/${id}`,'DELETE'))):''])));
          const candidates=members.filter(m=>m.status==='active'&&!team.members.includes(m.user_id));
          if(can('team.manage_members')&&candidates.length)editor.append(form('팀원 추가',[label('구성원',select('user',candidates.map(m=>[m.user_id,`${m.name} (${m.email})`])) )],'추가',async f=>{await mutate(`/teams/${team.id}/members/${f.get('user')}`,'PUT');await refresh();},alive));
          editor.append(table(['작업공간','역할','관리'],team.workspaces.map(w=>[spaces.find(s=>s.id===w.workspace_id)?.name||w.workspace_id,roleName(roles.find(r=>r.id===w.role_id)||{name:w.role_id}),can('team.update')?button('배정 해제',()=>run(()=>mutate(`/teams/${team.id}/workspaces/${w.workspace_id}`,'DELETE'))):''])));
          if(can('team.update')&&spaces.length)editor.append(form('작업공간 배정',[label('작업공간',select('workspace',spaces.map(w=>[w.id,w.name]))),label('역할',select('role',roleChoices(roles.filter(r=>r.name!=='workspace_owner'),'workspace')))],'배정 저장',async f=>{await mutate(`/teams/${team.id}/workspaces/${f.get('workspace')}`,'PUT',{role_id:f.get('role')});await refresh();},alive));
        }
        host.append(table(['팀','구성원 수','관리'],teams.map(t=>[button(t.name,()=>edit(t)),t.members.length,can('team.delete')?button('삭제',()=>run(async()=>{if(confirm('팀과 팀을 통한 작업공간 접근을 제거할까요?'))await mutate(`/teams/${t.id}`,'DELETE');})):'' ])),editor);
        if(can('team.create'))host.append(form('팀 만들기',[label('이름',input('name')),label('설명',input('description'))],'만들기',async f=>{await mutate('/teams','POST',{name:f.get('name'),description:f.get('description')});await refresh();},alive));
      } else {
        if(can('organization.update'))host.append(form('조직 정보',[label('이름',input('name',overview.name))],'저장',async f=>{await mutate('','PATCH',{name:f.get('name'),revision:overview.revision});if(alive())await local.changed(local.organizationId);},alive));
        host.append(create);
        if(overview.is_owner&&!overview.is_personal){const members=await api('/members');if(!alive())return;
          const candidates=members.filter(m=>m.status==='active'&&m.user_id!==local.userId);
          if(candidates.length)host.append(form('소유권 이전',[label('새 소유자',select('user',candidates.map(m=>[m.user_id,`${m.name} (${m.email})`])))],'소유권 이전',async f=>{if(confirm('소유권을 이전하고 현재 계정을 관리자로 변경할까요?')){await mutate('/transfer','POST',{user_id:f.get('user')});await refresh();}},alive));
        }
        if(overview.is_owner&&!overview.is_personal) {
          const confirmation=input('confirmation');confirmation.required=true;confirmation.autocomplete='off';
          host.append(form('조직 삭제',[element('p','삭제하면 모든 구성원이 이 조직과 소속 작업공간에 접근할 수 없습니다. 조직 이름을 입력해 확인하세요.'),label('삭제할 조직 이름',confirmation)],'조직 삭제',async f=>{
            if(f.get('confirmation')!==overview.name)throw new Error('조직 이름이 일치하지 않습니다.');
            await mutate('','DELETE');if(alive())await local.changed(null);
          },alive));
        }
        if(overview.is_owner||can('member.update_role')){const events=await api('/events');if(!alive())return;host.append(element('h2','조직 변경 이력'),table(['일시','작업','대상'],events.map(e=>[new Date(e.occurred_at).toLocaleString(),e.action,e.target_id])));}
      }
    } catch(e) {if(alive()){loading.remove();errorBox.textContent=e.message;host.append(button('다시 불러오기',refresh));}}
  }
  nav?.querySelectorAll('[data-org-view]').forEach(node=>node.addEventListener('click',()=>open(config,node.dataset.orgView)));
  window.agentFactoryOrganizations={open, reset(){generation++;host.replaceChildren();}};
})();
