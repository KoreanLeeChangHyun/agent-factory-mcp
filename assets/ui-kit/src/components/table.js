import {element} from './primitives.js';

/** Semantic native table. DOM cells retain identity/listeners; strings are text. */
export function resourceTable({headers, rows, emptyText = '표시할 항목이 없습니다.'}) {
  const root = element('div','af-table-scroll');
  const table = element('table','af-table'), head = element('thead'), titles = element('tr');
  headers.forEach(label => {const th=element('th','',label); th.scope='col'; titles.append(th);});
  head.append(titles); table.append(head);
  const body=element('tbody');
  rows.forEach(cells => {
    const row=element('tr');
    cells.forEach(value => {
      const cell=element('td');
      cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? '—')));
      row.append(cell);
    });
    body.append(row);
  });
  if (!rows.length) {
    const row=element('tr'), cell=element('td','',emptyText);
    cell.colSpan=Math.max(1,headers.length); row.append(cell); body.append(row);
  }
  table.append(body); root.append(table); return root;
}
