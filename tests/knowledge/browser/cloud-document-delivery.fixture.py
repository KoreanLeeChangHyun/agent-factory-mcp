"""Emit a realistic preview HTTP fixture for the independently run browser test."""

import json

from app.modules.document.preview import PREVIEW_HEADERS, render_preview

files = {
    "human/index.html": """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="./assets/styles.css">
<script src="./assets/blocking.js"></script>
<script defer src="./assets/dependency.js"></script><script defer src="./assets/app.js"></script>
</head><body><h1>문서 전달 명세</h1><nav><button id="overview">개요</button><button id="details">처리 흐름</button></nav>
<section id="summary">완전한 명세를 읽을 수 있습니다.</section><section id="flow" hidden><h2>전달 흐름</h2><svg id="diagram" viewBox="0 0 240 60" aria-label="준비에서 게시까지"></svg></section>
<img id="logo" src="./assets/logo.svg" alt="명세 로고"><a id="next" href="./pages/next.html">다음 문서</a>
<button id="attacks">격리 확인</button><button id="navigate">외부 이동 시도</button><output id="security"></output></body></html>""".encode(),
    "human/assets/styles.css": b'@import "./theme.css"; h1 { color: rgb(12, 34, 56); } #logo {width:24px;height:24px}',
    "human/assets/theme.css": b"body { background: rgb(240, 241, 242); }",
    "human/assets/logo.svg": b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="blue" d="M0 0h24v24H0z"/></svg>',
    "human/pages/next.html": '<html lang="ko"><h1>다음 문서 내용</h1><a href="../index.html">처음</a></html>'.encode(),
    "human/assets/blocking.js": b"globalThis.packageOrder=['blocking'];globalThis.packageBeforeBody=!document.querySelector('#summary');",
    "human/assets/dependency.js": b"if(!document.querySelector('#summary'))throw new Error('defer ran before body');globalThis.packageDependency=true;packageOrder.push('dependency');",
    "human/assets/app.js": """if(!globalThis.packageDependency)throw new Error('package dependency not initialized');
packageOrder.push('app');
document.addEventListener('DOMContentLoaded',()=>{packageOrder.push('DOMContentLoaded');document.documentElement.dataset.packageInitialized='ready';});
document.querySelector('#details').onclick=()=>{document.querySelector('#summary').hidden=true;document.querySelector('#flow').hidden=false;document.querySelector('#diagram').innerHTML='<rect width="80" height="40" fill="blue"/><text x="5" y="25" fill="white">준비</text><path d="M80 20h60" stroke="black"/><rect x="140" width="80" height="40" fill="green"/>';};
document.querySelector('#overview').onclick=()=>{document.querySelector('#summary').hidden=false;document.querySelector('#flow').hidden=true;};
document.querySelector('#attacks').onclick=async()=>{let blocked=[];for(const [name,fn] of [['parent',()=>parent.document.body],['storage',()=>localStorage.getItem('secret')],['cookie',()=>document.cookie],['top',()=>top.location.href='https://blocked.invalid/top']]){try{fn()}catch{blocked.push(name)}}try{await fetch('https://blocked.invalid/fetch')}catch{blocked.push('fetch')};const img=new Image();img.src='https://blocked.invalid/image';document.body.append(img);document.querySelector('#security').textContent=blocked.sort().join(',');};
document.querySelector('#navigate').onclick=()=>location.href='https://blocked.invalid/self';""".encode(),
}
print(
    json.dumps(
        {
            "html": render_preview(files, "human/index.html"),
            "headers": PREVIEW_HEADERS,
            "manifest": {
                "human_entry": "human/index.html",
                "members": [{"path": path, "size_bytes": len(raw)} for path, raw in files.items()],
            },
        }
    )
)
