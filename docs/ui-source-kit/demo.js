// Local demonstration only: no product data is read or changed.
window.demoMenu = attachActionMenu(
  document.getElementById('menu-trigger'),
  document.getElementById('demo-menu'),
  action => { document.getElementById('demo-result').textContent = action + ' 선택 (데모만 실행)'; },
);
