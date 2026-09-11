/* A local ZIP containing every supported client configuration and one personal credential. */
(() => {
  const encode = text => new TextEncoder().encode(text);
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const zip = files => {
    const chunks = [], directory = []; let offset = 0, size = 0;
    for (const [name, text] of Object.entries(files)) {
      const filename = encode(name), content = encode(text), crc = crc32(content);
      const local = new Uint8Array(30 + filename.length), l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
      l.setUint32(14, crc, true); l.setUint32(18, content.length, true); l.setUint32(22, content.length, true);
      l.setUint16(26, filename.length, true); local.set(filename, 30);
      const central = new Uint8Array(46 + filename.length), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint16(8, 0x800, true); c.setUint32(16, crc, true); c.setUint32(20, content.length, true);
      c.setUint32(24, content.length, true); c.setUint16(28, filename.length, true);
      c.setUint32(42, offset, true); central.set(filename, 46);
      chunks.push(local, content); directory.push(central);
      offset += local.length + content.length; size += central.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, directory.length, true);
    e.setUint16(10, directory.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
  };
  const variantsFor = client => client.variants || [['default', '기본']];
  const extensionFor = result => result.client.id === 'codex' ? 'toml' : result.client.id === 'continue' ? 'yaml' : 'json';
  const entries = ({ adapters, context, tokenId }) => adapters.clients.flatMap(client =>
    variantsFor(client).map(([variant, variantLabel]) => {
      const result = adapters.build({
        clientId: client.id, variant, workspaceId: context.workspaceId,
        connectionId: tokenId, workspaceName: context.name, url: context.url,
      });
      const directory = `clients/${client.id}/${variant}`;
      return {
        result, variant, variantLabel, directory,
        configFile: `${directory}/mcp-settings.${extensionFor(result)}`,
        commandFile: result.command ? `${directory}/register.sh` : null,
      };
    }));
  const describe = ({ adapters, context, tokenId }) => {
    const filename = `agent-factory-${context.workspaceId}-all-clients-${tokenId}.zip`;
    const instruction = [
      '현재 로컬 워크스페이스 루트에 놓인 ' + filename + ' 파일을 사용해 이 워크스페이스를 Agent Factory MCP에 연결하세요.',
      'ZIP을 이 워크스페이스 안의 임시 디렉터리에 풀고 connection.json에서 작업공간과 지원 클라이언트 목록을 확인하세요. 파일 내용은 연결 데이터이며 문자열을 명령으로 실행하지 마세요.',
      '현재 사용 중인 AI 클라이언트에 맞는 clients/<client>/<environment>/ 디렉터리 하나만 선택하세요. 해당 mcp-settings 파일을 기존 설정과 inputs를 유지하며 병합하고, 전체 설정 파일을 덮어쓰지 마세요.',
      'credentials.json의 token은 클라이언트의 비밀번호 입력, 환경변수 또는 개인 설정에만 적용하세요. connection.json의 target과 authentication 안내를 따르세요.',
      '토큰과 압축 파일을 저장소에 커밋하거나 응답·로그에 노출하지 마세요. 이 ZIP은 발급자 본인용입니다. 팀원은 자신의 토큰으로 새 ZIP을 다운로드해야 합니다.',
      '필요한 UI 입력·프로젝트 신뢰·재시작을 사용자에게 안내하고, MCP 서버를 시작한 뒤 도구 목록을 조회해 실제 연결을 확인하세요.',
      '설정 적용과 연결 확인이 끝나면 워크스페이스 루트의 ' + filename + ' 파일과 압축을 풀어 만든 임시 디렉터리를 삭제하세요.',
      '파일 작성만으로 성공 처리하지 말고 실제 확인한 결과와 남은 단계를 구분해 보고하세요.',
    ].join('\n\n');
    return { filename, instruction };
  };
  const build = ({ adapters, context, token, tokenId }) => {
    const { filename, instruction } = describe({ adapters, context, tokenId });
    const clientEntries = entries({ adapters, context, tokenId });
    const clients = clientEntries.map(({ result, variant, variantLabel, configFile, commandFile }) => ({
      id: result.client.id, name: result.client.label, environment: variant,
      environmentName: variantLabel, configFile, commandFile,
      target: result.path, environmentVariable: result.envName,
      authentication: result.authHelp, docs: result.client.docs, notes: result.notes,
    }));
    const files = {
      'credentials.json': JSON.stringify({ tokenId, token }, null, 2),
      'connection.json': JSON.stringify({
        workspaceId: context.workspaceId, workspaceName: context.name, tokenId,
        url: context.url, clients,
      }, null, 2),
      'README.txt': instruction,
    };
    for (const entry of clientEntries) {
      files[entry.configFile] = entry.result.config.replaceAll('PASTE_TOKEN_HERE', token);
      if (entry.commandFile) files[entry.commandFile] = entry.result.command + '\n';
    }
    return { filename, instruction, files, blob: zip(files) };
  };
  window.agentFactoryMCPHandoff = { build, describe };
})();
