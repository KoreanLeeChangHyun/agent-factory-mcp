(() => {
  const organizationId = new URLSearchParams(location.search).get('organization_invite');
  const token = new URLSearchParams(location.hash.slice(1)).get('invitation');
  const state = document.querySelector('[data-invitation-state]');
  if (!/^[0-9a-f-]{36}$/i.test(organizationId || '') || !token || token.length > 200) {
    state.textContent = '올바른 초대 링크를 열어 주세요.'; return;
  }
  try {
    sessionStorage.setItem('agentFactoryPendingInvitation', JSON.stringify({organizationId, token}));
    history.replaceState(null, '', location.pathname);
    location.replace(new URL('../workspace/', location.href));
  } catch {
    state.textContent = '초대를 보관할 수 없습니다. 브라우저의 사이트 저장소를 허용한 뒤 초대 링크를 다시 열어 주세요.';
  }
})();
