/* Production React acceptance; tests/tools/verify-native-management.sh owns its disposable database and sessions. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.AF_PLAYWRIGHT || "/tmp/af-pw/node_modules/playwright");
const documentsWorkbenchFixture = require("../../contracts/examples/workbenches/documents.json");

const baseURL = process.env.AF_NATIVE_BASE_URL;
const adminCookie = process.env.AF_NATIVE_ADMIN_COOKIE;
const userCookie = process.env.AF_NATIVE_USER_COOKIE;
const readerCookie = process.env.AF_NATIVE_READER_COOKIE;
const restrictedCookie = process.env.AF_NATIVE_RESTRICTED_COOKIE;
const cookieName = process.env.AF_NATIVE_COOKIE_NAME || "agent_factory_session";
const seededOrganization = process.env.AF_NATIVE_ORGANIZATION_ID;
const seededWorkspace = process.env.AF_NATIVE_WORKSPACE_ID;
const userEmail = process.env.AF_NATIVE_USER_EMAIL;
const userPassword = process.env.AF_NATIVE_USER_PASSWORD;
const readerEmail = process.env.AF_NATIVE_READER_EMAIL;
const readerUserId = process.env.AF_NATIVE_READER_USER_ID;
if (
  !baseURL ||
  !adminCookie ||
  !userCookie ||
  !readerCookie ||
  !restrictedCookie ||
  !seededOrganization ||
  !seededWorkspace ||
  !userEmail ||
  !userPassword ||
  !readerEmail ||
  !readerUserId
)
  throw new Error("AF_NATIVE_BASE_URL, credentials, seeded IDs and disposable session cookies are required");
const authenticated = async (browser, token, width = 1440) => {
  const context = await browser.newContext({ baseURL, viewport: { width, height: 900 } });
  const origin = new URL(baseURL);
  await context.addCookies([
    { name: cookieName, value: token, domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "agent_factory_csrf", value: "native-stage10-csrf", domain: origin.hostname, path: "/", sameSite: "Lax" },
  ]);
  return context;
};
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const zipEntries = (archive) => {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const expectedCRC = archive.readUInt32LE(offset + 14);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const content = archive.subarray(contentStart, contentStart + size);
    assert.equal(crc32(content), expectedCRC, `ZIP CRC mismatch: ${name}`);
    entries.set(name, content);
    offset = contentStart + size;
  }
  return entries;
};
const assertReadableGroupHeader = async (page, fullName) => {
  const header = page.locator(".af-native-group").filter({ hasText: fullName }).locator("header").first();
  await header.waitFor({ timeout: 10_000 });
  const layout = await header.evaluate((node) => {
    const disclosure = node.querySelector("button:first-child");
    const rename = node.querySelector("button:last-child");
    if (!disclosure || !rename || disclosure === rename) return null;
    const headerRect = node.getBoundingClientRect();
    const disclosureRect = disclosure.getBoundingClientRect();
    const renameRect = rename.getBoundingClientRect();
    const headerStyle = getComputedStyle(node);
    const gap = Number.parseFloat(headerStyle.columnGap || headerStyle.gap) || 0;
    return {
      headerWidth: headerRect.width,
      disclosureWidth: disclosureRect.width,
      renameWidth: renameRect.width,
      usedWidth: disclosureRect.width + gap + renameRect.width,
      overlap: disclosureRect.right > renameRect.left,
      contained: disclosureRect.left >= headerRect.left && renameRect.right <= headerRect.right + 1,
      fullName: disclosure.getAttribute("title"),
      renameWhiteSpace: getComputedStyle(rename).whiteSpace,
    };
  });
  assert.ok(layout, `long group header must render two controls: ${fullName}`);
  assert.equal(layout.fullName, fullName);
  assert.equal(layout.overlap, false);
  assert.equal(layout.contained, true);
  assert.equal(layout.renameWhiteSpace, "nowrap");
  assert.ok(layout.disclosureWidth >= 56, `group label width ${layout.disclosureWidth}`);
  assert.ok(layout.renameWidth <= 96, `rename action width ${layout.renameWidth}`);
  assert.ok(Math.abs(layout.headerWidth - layout.usedWidth) <= 2, JSON.stringify(layout));
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  let ordinaryUserId = "";
  let unenabledContext = null;
  try {
    const loginContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const loginPage = await loginContext.newPage();
    await loginPage.goto("./login/");
    await loginPage.getByLabel("이메일", { exact: true }).fill(userEmail);
    await loginPage.getByLabel("비밀번호", { exact: true }).fill(userPassword);
    await Promise.all([
      loginPage.waitForURL((url) => url.pathname.endsWith("/workspace/"), { timeout: 10_000 }),
      loginPage.getByRole("button", { name: "로그인", exact: true }).click(),
    ]);
    assert.equal((await loginPage.request.get("./api/auth/me")).status(), 200);
    await loginPage.goto("./workbench/?task=account");
    await loginPage.getByTitle("계정").click();
    await loginPage.getByRole("button", { name: "로그아웃", exact: true }).click();
    await loginPage.waitForURL((url) => url.pathname.endsWith("/workspace/") || url.pathname.endsWith("/login/"), {
      timeout: 10_000,
    });
    assert.equal((await loginPage.request.get("./api/auth/me")).status(), 401);
    await loginContext.close();
    const restricted = await authenticated(browser, restrictedCookie);
    const restrictedPage = await restricted.newPage();
    const protectedReads = [];
    restrictedPage.on("request", (request) => {
      if (/\/api\/organizations\/[^/]+\/(members|teams|roles)$/.test(new URL(request.url()).pathname))
        protectedReads.push(request.url());
    });
    await restrictedPage.goto(`./workbench/?organization=${encodeURIComponent(seededOrganization)}&task=organization`, {
      waitUntil: "domcontentloaded",
    });
    await restrictedPage.getByRole("button", { name: "구성원", exact: true }).click();
    assert.equal(await restrictedPage.getByRole("button", { name: "초대", exact: true }).isDisabled(), true);
    await restrictedPage.getByRole("button", { name: "팀", exact: true }).click();
    assert.equal(await restrictedPage.getByRole("button", { name: "팀 만들기", exact: true }).isDisabled(), true);
    await restrictedPage.getByRole("button", { name: "설정 · 역할 및 권한", exact: true }).click();
    assert.equal(await restrictedPage.getByRole("button", { name: "역할 만들기", exact: true }).isDisabled(), true);
    assert.deepEqual(protectedReads, []);
    await restricted.close();
    let visualLongSidebarContent = "";
    for (const width of [1440, 390]) {
      const context = await authenticated(browser, userCookie, width);
      const page = await context.newPage();
      const suffix = Date.now().toString(36);
      await page.goto("./workbench/", { waitUntil: "domcontentloaded" });
      let issuedConnectionName = "";
      if (width === 1440) {
        const call = async (method, path, data, expected = [200, 201, 204]) => {
          const response = await page.request.fetch(path, {
            method,
            data,
            headers: { "X-CSRF-Token": "native-stage10-csrf" },
          });
          assert.ok(
            expected.includes(response.status()),
            `${method} ${path}: ${response.status()} ${await response.text()}`,
          );
          return response.status() === 204 ? null : response.json();
        };
        issuedConnectionName = `native-${suffix}`;
        const organization = await call("POST", "./api/organizations", {
          name: `긴 한국어 조직 ${suffix}`,
          slug: `native-${suffix}`,
        });
        const overview = await call("GET", `./api/organizations/${organization.id}`);
        const roles = await call("GET", `./api/organizations/${organization.id}/roles`);
        const catalog = await call("GET", `./api/organizations/${organization.id}/permission-catalog`);
        assert.ok(catalog.some((permission) => permission.key === "test.execute" && permission.available === false));
        const customRole = await call("POST", `./api/organizations/${organization.id}/roles`, {
          name: "검증 역할",
          scope: "workspace",
          permissions: ["workspace.read"],
        });
        const team = await call("POST", `./api/organizations/${organization.id}/teams`, {
          name: "검증 팀",
          description: "평면 팀",
        });
        const workspace = await call("POST", `./api/organizations/${organization.id}/workspaces`, {
          name: `아주 긴 한국어 작업공간 ${suffix}`,
          slug: `workspace-${suffix}`,
        });
        unenabledContext = { organizationId: organization.id, workspaceId: workspace.id };
        const organizationRole =
          roles.find((role) => role.scope === "organization" && role.name === "organization_member") ||
          roles.find((role) => role.scope === "organization");
        const workspaceRole =
          roles.find((role) => role.scope === "workspace" && role.name === "viewer") ||
          roles.find((role) => role.scope === "workspace");
        const invitation = await call("POST", `./api/organizations/${organization.id}/invitations`, {
          email: `invite-${suffix}@example.com`,
          role_id: organizationRole.id,
          workspace_grants: [{ workspace_id: workspace.id, role_id: workspaceRole.id }],
        });
        await call("POST", `./api/organizations/${organization.id}/invitations/${invitation.id}/resend`);
        await call("DELETE", `./api/organizations/${organization.id}/invitations/${invitation.id}`);
        const group = await call("POST", `./api/organizations/${organization.id}/workspaces/groups`, {
          name: "초기 그룹",
        });
        const renamedGroup = await call(
          "PATCH",
          `./api/organizations/${organization.id}/workspaces/groups/${group.id}`,
          { revision: group.revision, name: "변경 그룹" },
        );
        await call(
          "PUT",
          `./api/organizations/${organization.id}/workspaces/groups/${group.id}/workspaces/${workspace.id}`,
        );
        await call("PUT", `./api/organizations/${organization.id}/teams/${team.id}/workspaces/${workspace.id}`, {
          role_id: customRole.id,
        });
        const conflict = await page.request.patch(
          `./api/organizations/${organization.id}/workspaces/groups/${group.id}`,
          { data: { revision: group.revision, name: "충돌 입력" }, headers: { "X-CSRF-Token": "native-stage10-csrf" } },
        );
        assert.equal(conflict.status(), 409);
        assert.ok(renamedGroup.revision > group.revision);
        const me = await call("GET", "./api/auth/me");
        ordinaryUserId = me.user.id;
        const currentTheme = await call("GET", "./api/appearance/theme-profile");
        let theme = currentTheme;
        for (const base of ["dark", "light", "high-contrast"]) {
          theme = await call("PUT", "./api/appearance/theme-profile", {
            base,
            density: theme.density,
            overrides: {},
            reducedMotion: theme.reducedMotion,
            expectedRevision: theme.revision,
          });
          const themeLoad = page.waitForResponse(
            (response) =>
              response.request().method() === "GET" &&
              new URL(response.url()).pathname.endsWith("/api/appearance/theme-profile"),
            { timeout: 10_000 },
          );
          await page.reload({ waitUntil: "domcontentloaded" });
          const themeResponse = await themeLoad;
          assert.equal(
            themeResponse.status(),
            200,
            `GET ${themeResponse.url()}: ${themeResponse.status()} ${await themeResponse.text()}`,
          );
          await page.waitForFunction((expected) => document.documentElement.dataset.afTheme === expected, base, {
            timeout: 10_000,
          });
          await page.screenshot({ path: `/tmp/af-native-stage10-theme-${base}.png`, fullPage: true });
        }
        assert.equal(me.user.id.replaceAll("-", ""), currentTheme.userId);
        await call("DELETE", `./api/organizations/${organization.id}/teams/${team.id}`);
        await call("DELETE", `./api/organizations/${organization.id}/roles/${customRole.id}`);
        assert.ok(roles.some((role) => role.is_system));
      }
      await page.getByTitle("조직").click();
      assert.equal(await page.locator("nav[aria-label='작업 목록']").count(), 1);
      assert.equal(await page.locator("aside[aria-label='사이드바']").count(), 1);
      assert.equal(await page.locator("section[aria-label='패널']").count(), 1);
      await page.getByLabel("조직 선택").selectOption(seededOrganization);
      await page.getByTitle("작업공간").click();
      await page.getByLabel("작업공간 이름 검색").fill("없는-작업공간");
      await page.getByLabel("작업공간 이름 검색").fill("");
      const seededContext = new URL(page.url());
      seededContext.searchParams.set("organization", seededOrganization);
      seededContext.searchParams.set("workspace", seededWorkspace);
      seededContext.searchParams.set("task", "workspaces");
      await page.goto(seededContext.href, { waitUntil: "domcontentloaded" });
      assert.equal(new URL(page.url()).searchParams.get("organization"), seededOrganization);
      assert.equal(new URL(page.url()).searchParams.get("workspace"), seededWorkspace);
      await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
      await page.getByRole("tab", { name: "MCP 연결" }).click();
      assert.match(await page.locator(".af-native-mcp").innerText(), /13개 클라이언트.*18개 환경/s);
      if (width === 1440) {
        await page.getByRole("button", { name: "토큰 발급", exact: true }).click();
        const issueDialog = page.getByRole("dialog", { name: "연결 토큰 발급" });
        await issueDialog.getByLabel("토큰 이름").fill(issuedConnectionName);
        await issueDialog.getByRole("button", { name: "발급", exact: true }).click();
        await issueDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: new RegExp(issuedConnectionName) }).click();
        const connectionStatusPath = `./api/organizations/${seededOrganization}/workspaces/${seededWorkspace}/mcp-connections`;
        const pendingStatus = await page.request.get(connectionStatusPath);
        assert.equal(pendingStatus.status(), 200, await pendingStatus.text());
        const pendingStatusBody = await pendingStatus.json();
        assert.equal(pendingStatusBody.state, "pending");
        assert.equal(Array.isArray(pendingStatusBody.connections), true);
        assert.equal(
          pendingStatusBody.connections.find((connection) => connection.name === issuedConnectionName)?.state,
          "pending",
        );
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("button", { name: "전체 설정 ZIP 다운로드" }).click(),
        ]);
        const path = await download.path();
        const bytes = require("node:fs").readFileSync(path);
        assert.equal(bytes.readUInt32LE(0), 0x04034b50);
        const entries = zipEntries(bytes);
        const connectionManifest = JSON.parse(entries.get("connection.json").toString("utf8"));
        const credentials = JSON.parse(entries.get("credentials.json").toString("utf8"));
        const scopedMcpURL = new URL(`mcp/workspaces/${seededWorkspace}/`, baseURL).href;
        assert.equal(connectionManifest.workspaceId, seededWorkspace);
        assert.equal(connectionManifest.tokenId, credentials.tokenId);
        assert.equal(connectionManifest.url, scopedMcpURL);
        assert.equal(connectionManifest.clients.length, 18);
        for (const client of connectionManifest.clients) {
          assert.ok(entries.has(client.configFile), `missing client configuration: ${client.configFile}`);
          assert.ok(
            entries.get(client.configFile).toString("utf8").includes(connectionManifest.url),
            `Workspace MCP URL mismatch: ${client.configFile}`,
          );
          if (client.commandFile) assert.ok(entries.has(client.commandFile), `missing command: ${client.commandFile}`);
        }
        assert.match(entries.get("README.txt").toString("utf8"), /connection\.json.*credentials\.json/s);
        assert.equal(
          entries.size,
          3 +
            connectionManifest.clients.length +
            connectionManifest.clients.filter((client) => client.commandFile).length,
        );
        await page.getByRole("button", { name: "AI 지침 복사", exact: true }).click();
        const instructions = await page.getByLabel("직접 복사할 AI 지침").inputValue();
        assert.equal(instructions.includes(credentials.token), false, "AI instructions must remain token-free");
        assert.ok(instructions.includes(connectionManifest.url), "AI instructions must use the emitted Workspace URL");
        const mcp = await page.request.post(connectionManifest.url, {
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              clientInfo: { name: "stage10-connection-check", version: "1" },
            },
          },
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
        });
        assert.equal(mcp.status(), 200, await mcp.text());
        const toolsList = await page.request.post(connectionManifest.url, {
          data: {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {
              _meta: {
                "io.modelcontextprotocol/clientInfo": { name: "stage10-connection-check" },
              },
            },
          },
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
          },
        });
        const toolsListBody = await toolsList.text();
        assert.equal(toolsList.status(), 200, toolsListBody);
        const toolsListData = toolsListBody
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data: "))
          .map((line) => JSON.parse(line.slice(6)));
        const toolsListMessages = toolsListData.length ? toolsListData : [JSON.parse(toolsListBody)];
        assert.ok(
          toolsListMessages.some((message) => message.id === 2 && "result" in message && !("error" in message)),
          toolsListBody,
        );
        const verifiedStatus = await page.request.get(connectionStatusPath);
        assert.equal(verifiedStatus.status(), 200, await verifiedStatus.text());
        const verifiedStatusBody = await verifiedStatus.json();
        assert.equal(verifiedStatusBody.state, "verified");
        assert.equal(
          verifiedStatusBody.connections.find((connection) => connection.id === credentials.tokenId)?.state,
          "verified",
        );
        await page.getByRole("button", { name: "연결 확인" }).click();
        await page.getByText("MCP 연결됨", { exact: true }).waitFor({ timeout: 10_000 });
        await page.locator('.af-native-workspace-row[aria-current="page"]').click({ button: "right" });
        const renameDialog = page.getByRole("dialog", { name: "이름 변경" });
        await renameDialog.waitFor();
        await renameDialog.getByRole("button", { name: "대화상자 닫기" }).click();
        const tokenCard = page.locator(".af-native-token-list article").filter({ hasText: issuedConnectionName });
        const revokedStatus = page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response
              .url()
              .endsWith(`/api/organizations/${seededOrganization}/workspaces/${seededWorkspace}/mcp-connections`) &&
            response.status() === 200,
        );
        await tokenCard.getByRole("button", { name: "폐기", exact: true }).click();
        const revokedStatusResponse = await revokedStatus;
        const revokedStatusBody = await revokedStatusResponse.json();
        // Other seeded tokens remain pending, which takes aggregate precedence over
        // this individual token's revoked state.
        assert.equal(revokedStatusBody.state, "pending");
        assert.equal(Array.isArray(revokedStatusBody.connections), true);
        const revokedConnection = revokedStatusBody.connections.find(
          (connection) => connection.id === credentials.tokenId,
        );
        assert.deepEqual(
          { state: revokedConnection?.state, reason: revokedConnection?.reason },
          { state: "reauth_required", reason: "revoked" },
        );
        const purged = page.waitForResponse(
          (response) =>
            response.request().method() === "DELETE" &&
            response
              .url()
              .endsWith(
                `/api/organizations/${seededOrganization}/workspaces/${seededWorkspace}/mcp-connections/${credentials.tokenId}/purge`,
              ),
        );
        await tokenCard.getByRole("button", { name: "영구 삭제", exact: true }).click();
        assert.equal((await purged).status(), 204);
        await tokenCard.waitFor({ state: "hidden", timeout: 10_000 });

        const renderedWorkspaceName = `브라우저 장문 한국어 작업공간 — 플랫폼 운영 및 MCP 연결 검증 ${suffix}`;
        const rolloutContext = await authenticated(browser, adminCookie);
        const createWorkspacePattern = new RegExp(`/api/organizations/${seededOrganization}/workspaces$`);
        let createdWorkspaceId = "";
        await page.route(createWorkspacePattern, async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          const response = await route.fetch();
          const responseBody = await response.text();
          assert.equal(response.status(), 201, responseBody);
          const createdWorkspace = JSON.parse(responseBody);
          const rolloutResponse = await rolloutContext.request.put("./api/admin/feature-flags/react-workbench", {
            data: {
              is_enabled: true,
              description: "Stage 10 browser",
              rules: { workspaceIds: [seededWorkspace, createdWorkspace.id] },
            },
            headers: { "X-CSRF-Token": "native-stage10-csrf" },
          });
          assert.equal(rolloutResponse.status(), 200, await rolloutResponse.text());
          createdWorkspaceId = createdWorkspace.id;
          await route.fulfill({ response, body: responseBody });
        });
        await page.getByRole("button", { name: "새 작업공간", exact: true }).click();
        const workspaceDialog = page.getByRole("dialog", { name: "작업공간 만들기" });
        await workspaceDialog.getByLabel("이름").fill(renderedWorkspaceName);
        await workspaceDialog.getByLabel("슬러그").fill(`browser-${suffix}`);
        await workspaceDialog.getByRole("button", { name: "저장", exact: true }).click();
        await workspaceDialog.waitFor({ state: "hidden", timeout: 10_000 });
        assert.ok(createdWorkspaceId, "the created Workspace must be rolled out before React receives it");
        await page.unroute(createWorkspacePattern);
        await rolloutContext.close();
        await page.getByRole("button", { name: renderedWorkspaceName, exact: true }).click();
        const workspaceInfoTab = page.getByRole("tab", { name: "작업공간 정보", exact: true });
        await workspaceInfoTab.click();
        assert.equal(await workspaceInfoTab.getAttribute("aria-selected"), "true");
        const repositoryForm = page.locator(".af-native-inline-form").filter({ has: page.getByLabel("로컬 위치") });
        await repositoryForm.getByLabel("로컬 위치").fill(`/tmp/native-${suffix}`);
        await repositoryForm.getByLabel("원격 URL").fill("https://github.com/example/native-stage10.git");
        await repositoryForm.getByRole("button", { name: "추가", exact: true }).click();
        const repositoryRow = page.locator(".af-native-row").filter({ hasText: `/tmp/native-${suffix}` });
        await repositoryRow.getByRole("button", { name: "제거", exact: true }).click();
        await repositoryRow.waitFor({ state: "hidden", timeout: 10_000 });

        const memberForm = page.locator(".af-native-inline-form").filter({ has: page.getByLabel("이메일") });
        const seededRoles = await (await page.request.get(`./api/organizations/${seededOrganization}/roles`)).json();
        const renderedMemberRole = seededRoles.find((role) => role.scope === "workspace");
        assert.ok(renderedMemberRole, "a Workspace role is required for rendered member management");
        await memberForm.getByLabel("이메일").fill(readerEmail);
        await memberForm.getByLabel("역할").fill(renderedMemberRole.name);
        const memberCreated = page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response
              .url()
              .endsWith(`/api/organizations/${seededOrganization}/workspaces/${createdWorkspaceId}/members`),
        );
        await memberForm.getByRole("button", { name: "추가", exact: true }).click();
        const memberCreatedResponse = await memberCreated;
        if (memberCreatedResponse.status() !== 204)
          assert.fail(`member create: ${memberCreatedResponse.status()} ${await memberCreatedResponse.text()}`);
        const memberRow = page.locator(".af-native-row").filter({ hasText: "Workbench reader" });
        await memberRow.getByRole("button", { name: "제거", exact: true }).click();
        await memberRow.waitFor({ state: "hidden", timeout: 10_000 });

        const renderedGroupName = `브라우저 장문 한국어 작업공간 운영 그룹 — 권한 및 연결 상태 검증 ${suffix}`;
        await page.getByRole("button", { name: "새 그룹", exact: true }).click();
        const groupDialog = page.getByRole("dialog", { name: "그룹 만들기" });
        await groupDialog.getByLabel("이름").fill(renderedGroupName);
        await groupDialog.getByRole("button", { name: "저장", exact: true }).click();
        await groupDialog.waitFor({ state: "hidden", timeout: 10_000 });
        const groupSection = page.locator(".af-native-group").filter({ hasText: renderedGroupName });
        await groupSection.getByRole("button", { name: "이름 변경", exact: true }).click();
        const groupRenameDialog = page.getByRole("dialog", { name: "이름 변경" });
        await groupRenameDialog.getByLabel("이름").fill(`${renderedGroupName} 변경`);
        await groupRenameDialog.getByRole("button", { name: "저장", exact: true }).click();
        await groupRenameDialog.waitFor({ state: "hidden", timeout: 10_000 });
        visualLongSidebarContent = `${renderedGroupName} 변경`;
        const groupSelect = page.getByLabel("그룹 이동 (키보드 선택 가능)");
        const renderedGroupId = await groupSelect
          .locator("option")
          .filter({ hasText: `${renderedGroupName} 변경` })
          .getAttribute("value");
        assert.ok(renderedGroupId, "the rendered Workspace group must have a selectable identifier");
        const groupAssigned = page.waitForResponse(
          (response) =>
            response.request().method() === "PUT" &&
            response
              .url()
              .endsWith(
                `/api/organizations/${seededOrganization}/workspaces/groups/${renderedGroupId}/workspaces/${createdWorkspaceId}`,
              ) &&
            response.status() === 204,
        );
        const groupReloaded = page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/workspaces/groups`) &&
            response.status() === 200,
        );
        await groupSelect.selectOption(renderedGroupId);
        await Promise.all([groupAssigned, groupReloaded]);
        await page.waitForFunction(
          (groupId) =>
            Array.from(document.querySelectorAll("select")).some(
              (select) =>
                Array.from(select.labels).some((label) => label.textContent.includes("그룹 이동")) &&
                select.value === groupId,
            ),
          renderedGroupId,
        );

        await page.locator(".af-native-actions").getByRole("button", { name: "이름 변경", exact: true }).click();
        const workspaceRenameDialog = page.getByRole("dialog", { name: "이름 변경" });
        await workspaceRenameDialog.getByLabel("이름").fill(`${renderedWorkspaceName} 충돌 입력`);
        const renderedWorkspaces = await (
          await page.request.get(`./api/organizations/${seededOrganization}/workspaces`)
        ).json();
        const renderedWorkspace = renderedWorkspaces.find((item) => item.name === renderedWorkspaceName);
        assert.ok(renderedWorkspace, "the rendered Workspace must be discoverable for the competing CAS update");
        const competingWorkspace = await page.request.put(
          `./api/organizations/${seededOrganization}/workspaces/${renderedWorkspace.id}`,
          {
            data: { name: `${renderedWorkspaceName} 경쟁 변경`, revision: renderedWorkspace.revision },
            headers: { "X-CSRF-Token": "native-stage10-csrf" },
          },
        );
        assert.equal(competingWorkspace.status(), 200, await competingWorkspace.text());
        const conflictResponse = page.waitForResponse(
          (response) =>
            response.request().method() === "PUT" &&
            response.url().endsWith(`/workspaces/${renderedWorkspace.id}`) &&
            response.status() === 409,
        );
        await workspaceRenameDialog.getByRole("button", { name: "저장", exact: true }).click();
        await conflictResponse;
        assert.equal(await workspaceRenameDialog.getByLabel("이름").inputValue(), `${renderedWorkspaceName} 충돌 입력`);
        await workspaceRenameDialog.getByRole("button", { name: "대화상자 닫기" }).click();
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator('.af-native-workspace-row[aria-current="page"]').click();
        await page.locator(".af-native-actions").getByRole("button", { name: "이름 변경", exact: true }).click();
        await workspaceRenameDialog.getByLabel("이름").fill(`${renderedWorkspaceName} 변경`);
        await workspaceRenameDialog.getByRole("button", { name: "저장", exact: true }).click();
        await workspaceRenameDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: "비활성화", exact: true }).click();
        const deactivateDialog = page.getByRole("dialog", { name: "작업공간 비활성화" });
        await deactivateDialog.getByRole("button", { name: "대화상자 닫기" }).click();
        await page.getByRole("button", { name: "비활성화", exact: true }).click();
        await deactivateDialog.getByRole("button", { name: "비활성화", exact: true }).click();
        await deactivateDialog.waitFor({ state: "hidden", timeout: 10_000 });

        await page.goto(seededContext.href, { waitUntil: "domcontentloaded" });
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        await page.getByTitle("조직").click();
        await page.getByLabel("조직 선택").selectOption(seededOrganization);
        await page.getByRole("button", { name: "설정 · 역할 및 권한", exact: true }).click();
        await page.getByRole("button", { name: "역할 만들기" }).click();
        const roleDialog = page.getByRole("dialog", { name: "역할 편집" });
        await roleDialog.getByLabel("이름").fill(`브라우저 역할 ${suffix}`);
        await roleDialog.getByLabel("역할 범위").selectOption("workspace");
        await roleDialog.getByRole("button", { name: "확인" }).click();
        await roleDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: "팀", exact: true }).click();
        await page.getByRole("button", { name: "팀 만들기" }).click();
        const teamDialog = page.getByRole("dialog", { name: "팀 편집" });
        await teamDialog.getByLabel("이름").fill(`브라우저 팀 ${suffix}`);
        await teamDialog.getByRole("button", { name: "확인" }).click();
        await teamDialog.waitFor({ state: "hidden", timeout: 10_000 });
        const renderedTeamRow = page.getByRole("row").filter({ hasText: `브라우저 팀 ${suffix}` });
        await renderedTeamRow.getByRole("button", { name: "편집", exact: true }).click();
        await teamDialog.getByLabel("추가할 구성원").selectOption({ label: "Workbench reader" });
        await teamDialog.getByRole("button", { name: "팀원 추가", exact: true }).click();
        await teamDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await renderedTeamRow.getByRole("button", { name: "편집", exact: true }).click();
        await teamDialog.getByLabel("부여할 작업공간").selectOption(seededWorkspace);
        await teamDialog.getByLabel("작업공간 역할").selectOption({ index: 1 });
        await teamDialog.getByRole("button", { name: "작업공간 부여", exact: true }).click();
        await teamDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await renderedTeamRow.getByRole("button", { name: "편집", exact: true }).click();
        await teamDialog.getByRole("button", { name: "팀원 제거", exact: true }).click();
        await teamDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await renderedTeamRow.getByRole("button", { name: "편집", exact: true }).click();
        await teamDialog.getByRole("button", { name: "작업공간 부여 해제", exact: true }).click();
        await teamDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await renderedTeamRow.getByRole("button", { name: "삭제", exact: true }).click();
        await renderedTeamRow.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: "설정 · 역할 및 권한", exact: true }).click();
        const renderedRoleRow = page.getByRole("row").filter({ hasText: `브라우저 역할 ${suffix}` });
        await renderedRoleRow.getByRole("button", { name: "삭제", exact: true }).click();
        await renderedRoleRow.waitFor({ state: "hidden", timeout: 10_000 });

        await page.getByLabel("조직 선택").selectOption(unenabledContext.organizationId);
        await page.getByRole("button", { name: "구성원", exact: true }).click();
        const inviteButton = page.getByRole("button", { name: "초대", exact: true });
        await inviteButton.waitFor();
        await inviteButton.click();
        const invitationDialog = page.getByRole("dialog", { name: "구성원 초대" });
        await invitationDialog.getByLabel("이메일").fill(`rendered-${suffix}@example.com`);
        await invitationDialog.getByLabel("조직 역할").selectOption({ index: 1 });
        await invitationDialog.getByRole("button", { name: "확인", exact: true }).click();
        await invitationDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: "설정", exact: true }).click();
        const invitationRow = page.locator(".af-native-row").filter({ hasText: `rendered-${suffix}@example.com` });
        await invitationRow.getByRole("button", { name: "다시 보내기", exact: true }).waitFor();
        await invitationRow.getByRole("button", { name: "다시 보내기", exact: true }).click();
        await invitationRow.getByRole("button", { name: "취소", exact: true }).click();
        await invitationRow.waitFor({ state: "hidden", timeout: 10_000 });

        await page.getByRole("button", { name: "조직 수정", exact: true }).click();
        const organizationDialog = page.getByRole("dialog", { name: "조직 수정" });
        await organizationDialog.getByLabel("이름").fill(`Stage 10 조직 ${suffix}`);
        await organizationDialog.getByRole("button", { name: "확인", exact: true }).click();
        await organizationDialog.waitFor({ state: "hidden", timeout: 10_000 });

        await page.getByLabel("조직 선택").selectOption(seededOrganization);
        await page.getByRole("button", { name: "구성원", exact: true }).click();
        const readerRow = page.getByRole("row").filter({ hasText: "Workbench reader" });
        const waitForMemberReload = () =>
          page.waitForResponse(
            (response) =>
              response.request().method() === "GET" &&
              response.url().endsWith(`/api/organizations/${seededOrganization}/members`) &&
              response.status() === 200,
          );
        const waitForOrganizationRefresh = () =>
          page.waitForResponse(
            (response) =>
              response.request().method() === "GET" &&
              response.url().endsWith(`/api/organizations/${seededOrganization}`) &&
              response.status() === 200,
          );
        await readerRow.getByRole("button", { name: "상세", exact: true }).click();
        const memberDetail = page.locator(".af-native-detail");
        await memberDetail.getByText("적용 권한과 부여 경로", { exact: true }).waitFor();
        const memberRoleUpdated = page.waitForResponse(
          (response) =>
            response.request().method() === "PATCH" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/members/${readerUserId}`) &&
            response.status() === 200,
        );
        const memberRoleReloaded = waitForMemberReload();
        const organizationAfterRoleUpdate = waitForOrganizationRefresh();
        await memberDetail.getByRole("button", { name: "역할 저장", exact: true }).click();
        await Promise.all([memberRoleUpdated, memberRoleReloaded, organizationAfterRoleUpdate]);
        await readerRow.getByRole("button", { name: "상세", exact: true }).waitFor();
        const retainedMemberDetail = await memberDetail.elementHandle();
        const refreshedMemberDetail = page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/members/${readerUserId}`) &&
            response.status() === 200,
        );
        await readerRow.getByRole("button", { name: "상세", exact: true }).click();
        await page.waitForFunction((detail) => !detail.isConnected, retainedMemberDetail);
        await refreshedMemberDetail;
        const memberWorkspaceSelect = memberDetail.locator('select[name="workspace"]');
        await memberWorkspaceSelect.waitFor();
        await memberWorkspaceSelect.selectOption(seededWorkspace);
        const memberAssigned = page.waitForResponse(
          (response) =>
            response.request().method() === "PUT" &&
            response
              .url()
              .endsWith(
                `/api/organizations/${seededOrganization}/assignments/${seededWorkspace}/members/${readerUserId}`,
              ) &&
            response.status() === 200,
        );
        const memberAssignmentReloaded = waitForMemberReload();
        const organizationAfterAssignment = waitForOrganizationRefresh();
        await memberDetail.getByRole("button", { name: "직접 배정", exact: true }).click();
        await Promise.all([memberAssigned, memberAssignmentReloaded, organizationAfterAssignment]);
        await readerRow.getByRole("button", { name: "상세", exact: true }).waitFor();
        const detailBeforeAssignmentRefresh = await memberDetail.elementHandle();
        const detailAfterAssignment = page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/members/${readerUserId}`) &&
            response.status() === 200,
        );
        await readerRow.getByRole("button", { name: "상세", exact: true }).click();
        await page.waitForFunction((detail) => !detail.isConnected, detailBeforeAssignmentRefresh);
        await detailAfterAssignment;
        await memberDetail.locator("pre").filter({ hasText: seededWorkspace }).waitFor();
        await readerRow.getByRole("button", { name: "정지", exact: true }).waitFor();
        const memberSuspended = page.waitForResponse(
          (response) =>
            response.request().method() === "PATCH" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/members/${readerUserId}`) &&
            response.status() === 200,
        );
        const memberSuspensionReloaded = waitForMemberReload();
        const organizationAfterSuspension = waitForOrganizationRefresh();
        await readerRow.getByRole("button", { name: "정지", exact: true }).click();
        await Promise.all([memberSuspended, memberSuspensionReloaded, organizationAfterSuspension]);
        await readerRow.getByRole("button", { name: "복원", exact: true }).waitFor();
        const memberRestored = page.waitForResponse(
          (response) =>
            response.request().method() === "PATCH" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/members/${readerUserId}`) &&
            response.status() === 200,
        );
        const memberRestorationReloaded = waitForMemberReload();
        const organizationAfterRestoration = waitForOrganizationRefresh();
        await readerRow.getByRole("button", { name: "복원", exact: true }).click();
        await Promise.all([memberRestored, memberRestorationReloaded, organizationAfterRestoration]);
        await readerRow.getByRole("button", { name: "정지", exact: true }).waitFor();

        await page.getByRole("button", { name: "설정", exact: true }).click();
        await page.getByRole("button", { name: "소유권 이전", exact: true }).click();
        const transferDialog = page.getByRole("dialog", { name: "소유권 이전" });
        await transferDialog.getByRole("button", { name: "대화상자 닫기" }).click();
        await page.getByRole("button", { name: "소유권 이전", exact: true }).click();
        await transferDialog.getByLabel("새 소유자 사용자 UUID").fill(ordinaryUserId);
        const rejectedSelfTransfer = page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().endsWith(`/api/organizations/${seededOrganization}/transfer`) &&
            response.status() === 409,
        );
        await transferDialog.getByRole("button", { name: "확인", exact: true }).click();
        await rejectedSelfTransfer;
        await transferDialog.getByLabel("새 소유자 사용자 UUID").fill(readerUserId);
        await transferDialog.getByRole("button", { name: "확인", exact: true }).click();
        await transferDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByTitle("조직").click();
        await page.getByLabel("조직 선택").selectOption(seededOrganization);
        await page.getByRole("button", { name: "설정", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "소유권 이전", exact: true }).isDisabled(), true);

        const transferredOwner = await authenticated(browser, readerCookie);
        const transferredOwnerPage = await transferredOwner.newPage();
        await transferredOwnerPage.goto(
          `./workbench/?organization=${encodeURIComponent(seededOrganization)}&task=organization`,
          { waitUntil: "domcontentloaded" },
        );
        await transferredOwnerPage.getByRole("button", { name: "설정", exact: true }).click();
        const transferBackButton = transferredOwnerPage.getByRole("button", {
          name: "소유권 이전",
          exact: true,
        });
        assert.equal(await transferBackButton.isEnabled(), true);
        await transferBackButton.click();
        const transferBackDialog = transferredOwnerPage.getByRole("dialog", { name: "소유권 이전" });
        await transferBackDialog.getByLabel("새 소유자 사용자 UUID").fill(ordinaryUserId);
        await transferBackDialog.getByRole("button", { name: "확인", exact: true }).click();
        await transferBackDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await transferredOwnerPage.reload({ waitUntil: "domcontentloaded" });
        await transferredOwnerPage.getByRole("button", { name: "설정", exact: true }).click();
        assert.equal(await transferBackButton.isDisabled(), true);
        await transferredOwner.close();

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByTitle("조직").click();
        await page.getByLabel("조직 선택").selectOption(seededOrganization);
        await page.getByRole("button", { name: "구성원", exact: true }).click();

        let releaseMembers;
        let markMembersStarted;
        const membersStarted = new Promise((resolve) => {
          markMembersStarted = resolve;
        });
        const releaseMembersRequest = new Promise((resolve) => {
          releaseMembers = resolve;
        });
        const delayedMembersPattern = new RegExp(`/api/organizations/${seededOrganization}/members$`);
        await page.route(delayedMembersPattern, async (route) => {
          markMembersStarted();
          await releaseMembersRequest;
          await route.continue();
        });
        await page.getByRole("button", { name: "개요", exact: true }).click();
        await page.getByRole("button", { name: "구성원", exact: true }).click();
        await membersStarted;
        await page.getByLabel("조직 선택").selectOption(unenabledContext.organizationId);
        releaseMembers();
        await page.getByRole("heading", { name: `Stage 10 조직 ${suffix}`, exact: true }).waitFor({ timeout: 10_000 });
        assert.equal(await page.getByText("Workbench reader", { exact: true }).count(), 0);
        await page.unroute(delayedMembersPattern);
        await page.getByLabel("조직 선택").selectOption(seededOrganization);
        await page.getByRole("button", { name: "구성원", exact: true }).click();
        await readerRow.getByRole("button", { name: "제거", exact: true }).click();
        await readerRow.waitFor({ state: "hidden", timeout: 10_000 });

        const personalOrganization = await page
          .getByLabel("조직 선택")
          .evaluate(
            (select) => Array.from(select.options).find((option) => option.textContent?.startsWith("개인 ·"))?.value,
          );
        assert.ok(personalOrganization, "the personal organization must remain discoverable");
        await page.getByLabel("조직 선택").selectOption(personalOrganization);
        await page.getByRole("button", { name: "구성원", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "초대", exact: true }).isDisabled(), true);
        await page.getByRole("button", { name: "설정", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "조직 삭제", exact: true }).isDisabled(), true);
        await page.getByLabel("조직 선택").selectOption(seededOrganization);

        const disposableOrganizationName = `삭제 조직 ${suffix}`;
        await page.getByRole("button", { name: "새 조직", exact: true }).click();
        const createOrganizationDialog = page.getByRole("dialog", { name: "조직 만들기" });
        await createOrganizationDialog.getByLabel("이름").fill(disposableOrganizationName);
        await createOrganizationDialog.getByLabel("@슬러그").fill(`delete-${suffix}`);
        await createOrganizationDialog.getByRole("button", { name: "만들기", exact: true }).click();
        await createOrganizationDialog.waitFor({ state: "hidden", timeout: 10_000 });
        await page.getByRole("button", { name: "설정", exact: true }).click();
        await page.getByRole("button", { name: "조직 삭제", exact: true }).click();
        const deleteOrganizationDialog = page.getByRole("dialog", { name: "조직 삭제" });
        await deleteOrganizationDialog
          .getByLabel(new RegExp(disposableOrganizationName))
          .fill(disposableOrganizationName);
        await deleteOrganizationDialog.getByRole("button", { name: "확인", exact: true }).click();
        await deleteOrganizationDialog.waitFor({ state: "hidden", timeout: 10_000 });
        const preferenceContext = new URL("./workbench/", baseURL);
        preferenceContext.searchParams.set("organization", seededOrganization);
        preferenceContext.searchParams.set("workspace", seededWorkspace);
        preferenceContext.searchParams.set("task", "workspaces");
        await page.goto(preferenceContext.href, { waitUntil: "domcontentloaded" });
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        assert.equal(new URL(page.url()).searchParams.get("organization"), seededOrganization);
        assert.equal(new URL(page.url()).searchParams.get("workspace"), seededWorkspace);

        await page.evaluate(
          ({ userId, organizationId, workspaceId }) => {
            localStorage.setItem(
              `agent-factory:shell:v3:${userId}:${organizationId}:${workspaceId}:account`,
              JSON.stringify({ sidebarOpen: true, sidebarWidth: 180 }),
            );
            localStorage.setItem(
              `agent-factory:shell:v3:${userId}:${organizationId}:${workspaceId}:workspaces`,
              JSON.stringify({ sidebarOpen: true, sidebarWidth: 520 }),
            );
          },
          { userId: ordinaryUserId, organizationId: seededOrganization, workspaceId: seededWorkspace },
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        await page.waitForFunction(
          () =>
            Math.abs(document.querySelector("aside[aria-label='사이드바']").getBoundingClientRect().width - 520) <= 2,
        );
        assert.ok(
          Math.abs(
            (await page
              .locator("aside[aria-label='사이드바']")
              .evaluate((sidebar) => sidebar.getBoundingClientRect().width)) - 520,
          ) <= 2,
        );
        await page.getByTitle("계정").click();
        await page.waitForFunction(
          () =>
            Math.abs(document.querySelector("aside[aria-label='사이드바']").getBoundingClientRect().width - 180) <= 2,
        );
        await page.getByText("현재 조직").waitFor();
        assert.match(await page.locator(".af-native-summary").innerText(), /현재 조직.*현재 작업공간/s);
        await page.getByRole("button", { name: "테마", exact: true }).click();
        await page.getByLabel("기본 테마").selectOption("dark");
        await page.getByRole("button", { name: "저장", exact: true }).click();
        await page.getByText("서버에 저장했습니다.").waitFor({ timeout: 10_000 });
        await page.getByLabel("기본 테마").selectOption("light");
        const competingTheme = await (await page.request.get("./api/appearance/theme-profile")).json();
        const competingThemeResponse = await page.request.put("./api/appearance/theme-profile", {
          data: {
            base: "high-contrast",
            density: competingTheme.density,
            overrides: competingTheme.overrides,
            reducedMotion: competingTheme.reducedMotion,
            expectedRevision: competingTheme.revision,
          },
          headers: { "X-CSRF-Token": "native-stage10-csrf" },
        });
        assert.equal(competingThemeResponse.status(), 200, await competingThemeResponse.text());
        await page.getByRole("button", { name: "저장", exact: true }).click();
        await page.getByText("다른 기기에서 테마가 변경되었습니다.", { exact: false }).waitFor({ timeout: 10_000 });
        assert.equal(await page.getByLabel("기본 테마").inputValue(), "light");
        await page.getByRole("button", { name: "서버 버전 불러오기", exact: true }).click();
        assert.equal(await page.getByLabel("기본 테마").inputValue(), "high-contrast");
        await page.getByRole("button", { name: "보안", exact: true }).click();
        await page.getByText("로그인 세션").waitFor();
        const secondarySession = page.locator(".af-native-row").filter({ hasText: "Stage10 secondary session" });
        await secondarySession.getByRole("button", { name: "세션 해제" }).click();
        await secondarySession.waitFor({ state: "hidden", timeout: 10_000 });
        const selectedToken = page.locator(".af-native-row").filter({ hasText: /^writer ·/ });
        await selectedToken.waitFor({ timeout: 10_000 });
        assert.equal(await selectedToken.count(), 1);
        const selectedTokenAction = selectedToken.getByRole("button", { name: "폐기", exact: true });
        await selectedTokenAction.waitFor({ timeout: 10_000 });
        assert.equal(await selectedTokenAction.count(), 1);
        const [selectedTokenResponse, refreshedTokenResponse] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.request().method() === "DELETE" &&
              /\/api\/auth\/tokens\/[^/]+$/.test(new URL(response.url()).pathname),
            { timeout: 10_000 },
          ),
          page.waitForResponse(
            (response) =>
              response.request().method() === "GET" && new URL(response.url()).pathname.endsWith("/api/auth/tokens"),
            { timeout: 10_000 },
          ),
          selectedTokenAction.click(),
        ]);
        assert.equal(selectedTokenResponse.status(), 204);
        const selectedTokenId = new URL(selectedTokenResponse.url()).pathname.split("/").at(-1);
        const refreshedTokens = await refreshedTokenResponse.json();
        assert.equal(refreshedTokenResponse.status(), 200, JSON.stringify(refreshedTokens));
        assert.ok(refreshedTokens.find((token) => token.id === selectedTokenId)?.revoked_at);
        await selectedToken.waitFor({ state: "hidden", timeout: 10_000 });
        await page
          .locator(".af-native-row")
          .filter({ hasText: /^reader ·/ })
          .getByRole("button", { name: "폐기", exact: true })
          .waitFor();
        await page.getByTitle("작업공간").click();
        await page.waitForFunction(
          () =>
            Math.abs(document.querySelector("aside[aria-label='사이드바']").getBoundingClientRect().width - 520) <= 2,
        );
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        await page.getByTitle("문서").click();
        const createDocument = page.getByRole("button", { name: "새 원본 문서", exact: true });
        await createDocument.waitFor({ timeout: 10_000 });
        await createDocument.click();
        await page.locator(".af-document-header h1").waitFor({ timeout: 10_000 });
        const selectedDocumentTitle = await page.locator(".af-document-header h1").innerText();
        await page.getByTitle("작업공간").click();
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        await page.getByTitle("문서").click();
        await page.locator(".af-document-header h1").waitFor({ timeout: 10_000 });
        assert.equal(await page.locator(".af-document-header h1").innerText(), selectedDocumentTitle);
        const standardTaskCount = await page.locator("nav[aria-label='작업 목록'] button").count();
        const customerWorkbenchKey = `native-customer-${suffix}`;
        const customerWorkbenchDefinition = {
          ...documentsWorkbenchFixture,
          descriptor: {
            ...documentsWorkbenchFixture.descriptor,
            id: customerWorkbenchKey,
            title: `브라우저 Workbench ${suffix}`,
          },
        };
        const customerWorkbenchResponse = await page.request.post(`./api/workspaces/${seededWorkspace}/workbenches`, {
          data: {
            key: customerWorkbenchKey,
            title: `브라우저 Workbench ${suffix}`,
            definition: customerWorkbenchDefinition,
          },
          headers: {
            "X-CSRF-Token": "native-stage10-csrf",
            "X-Organization-ID": seededOrganization,
          },
        });
        const customerWorkbench = await customerWorkbenchResponse.json();
        assert.equal(customerWorkbenchResponse.status(), 201, JSON.stringify(customerWorkbench));
        assert.equal(customerWorkbench.revision, 1);
        const authoringURL = new URL("./workbench/authoring", baseURL);
        authoringURL.searchParams.set("organization", seededOrganization);
        authoringURL.searchParams.set("workspace", seededWorkspace);
        authoringURL.searchParams.set("definition", customerWorkbench.id);
        await page.goto(authoringURL.href, { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Workbench 구성" }).waitFor({ timeout: 10_000 });
        await page.getByLabel("에셋 검색").fill("button@1");
        await page.getByRole("button", { name: "button@1 패널에 추가", exact: true }).click();
        await page.getByRole("button", { name: "초안 저장", exact: true }).click();
        await page.getByText("초안 revision 2을 저장했습니다.", { exact: true }).waitFor({ timeout: 10_000 });
        await page.getByRole("button", { name: "게시", exact: true }).click();
        await page.getByRole("heading", { name: "게시된 release 1" }).waitFor({ timeout: 10_000 });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "게시된 release 1" }).waitFor({ timeout: 10_000 });
        await page.goto(seededContext.href, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          (minimum) => document.querySelectorAll("nav[aria-label='작업 목록'] button").length > minimum,
          standardTaskCount,
          { timeout: 10_000 },
        );
        await page.getByTitle("작업공간").click();
      }
      const storage = await page.evaluate(() => Object.entries(localStorage));
      assert.equal(
        storage.some(([, value]) => /afm_[A-Za-z0-9_-]+/.test(value)),
        false,
        "credential must not enter localStorage",
      );
      await page.keyboard.press("Control+b");
      await page.locator("aside[aria-label='사이드바']").waitFor({ state: "hidden", timeout: 10_000 });
      await page.keyboard.press("Control+b");
      await page.locator("aside[aria-label='사이드바']").waitFor({ state: "visible", timeout: 10_000 });
      const sidebarPreferenceKey = `agent-factory:shell:v3:${ordinaryUserId}:${seededOrganization}:${seededWorkspace}:workspaces`;
      if (width === 1440) {
        for (const sidebarWidth of [180, 268, 520]) {
          await page.evaluate(
            ({ key, value }) => {
              const current = JSON.parse(localStorage.getItem(key) ?? "{}");
              localStorage.setItem(
                key,
                JSON.stringify({ ...current, selectedId: "workspaces", sidebarOpen: true, sidebarWidth: value }),
              );
            },
            { key: sidebarPreferenceKey, value: sidebarWidth },
          );
          await page.reload({ waitUntil: "domcontentloaded" });
          const selectedWorkspaceRow = page.locator('.af-native-workspace-row[aria-current="page"]');
          const sidebar = page.locator("aside[aria-label='사이드바']");
          const panel = page.locator("section[aria-label='패널']");
          await selectedWorkspaceRow.waitFor({ timeout: 10_000 });
          const selectedWorkspaceName = (await selectedWorkspaceRow.innerText()).trim();
          await panel.getByRole("heading", { name: selectedWorkspaceName, exact: true }).waitFor({ timeout: 10_000 });
          await panel.locator(".af-native-panel-body").waitFor({ timeout: 10_000 });
          await panel.getByRole("tab", { name: "작업공간 정보", exact: true }).waitFor({ timeout: 10_000 });
          await panel.getByRole("button", { name: "이름 변경", exact: true }).waitFor({ timeout: 10_000 });
          assert.ok(visualLongSidebarContent, "representative long sidebar content must be prepared");
          await sidebar.getByText(visualLongSidebarContent, { exact: false }).waitFor({ timeout: 10_000 });
          await assertReadableGroupHeader(page, visualLongSidebarContent);
          assert.equal(await sidebar.getByText("불러오는 중…", { exact: true }).count(), 0);
          assert.equal(await panel.getByRole("heading", { name: "작업공간을 선택하세요", exact: true }).count(), 0);
          await page.waitForFunction(
            (expected) => {
              const sidebar = document.querySelector("aside[aria-label='사이드바']");
              return sidebar && Math.abs(Math.round(sidebar.getBoundingClientRect().width) - expected) <= 2;
            },
            sidebarWidth,
            { timeout: 10_000 },
          );
          const measured = await page
            .locator("aside[aria-label='사이드바']")
            .evaluate((node) => Math.round(node.getBoundingClientRect().width));
          assert.ok(Math.abs(measured - sidebarWidth) <= 2, `sidebar width ${sidebarWidth}, received ${measured}`);
          await page.screenshot({
            path: `/tmp/af-native-stage10-${width}-sidebar-${sidebarWidth}.png`,
            fullPage: true,
          });
        }
      } else {
        await page.evaluate(
          ({ key, value }) => {
            const current = JSON.parse(localStorage.getItem(key) ?? "{}");
            localStorage.setItem(
              key,
              JSON.stringify({ ...current, selectedId: "workspaces", sidebarOpen: true, sidebarWidth: value }),
            );
          },
          { key: sidebarPreferenceKey, value: 520 },
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => document.querySelector(".af-shell")?.style.getPropertyValue("--af-runtime-sidebar-width") === "520px",
          undefined,
          { timeout: 10_000 },
        );
        await page.locator('.af-native-workspace-row[aria-current="page"]').waitFor({ timeout: 10_000 });
        await page.locator("section[aria-label='패널'] .af-native-panel-body").waitFor({ timeout: 10_000 });
        const responsive = await page.evaluate(() => {
          const shell = document.querySelector(".af-shell");
          const taskList = document.querySelector("nav[aria-label='작업 목록']");
          const sidebar = document.querySelector("aside[aria-label='사이드바']");
          const panel = document.querySelector("section[aria-label='패널']");
          const sidebarBody = sidebar?.querySelector(".af-native-scroll");
          const panelBody = panel?.querySelector(".af-native-panel-body");
          if (!shell || !taskList || !sidebar || !panel || !sidebarBody || !panelBody) return null;
          const taskRect = taskList.getBoundingClientRect();
          const sidebarRect = sidebar.getBoundingClientRect();
          const panelRect = panel.getBoundingClientRect();
          return {
            preferredWidth: shell.style.getPropertyValue("--af-runtime-sidebar-width"),
            stacked:
              sidebarRect.left >= taskRect.right &&
              Math.abs(panelRect.left - sidebarRect.left) <= 1 &&
              panelRect.top >= sidebarRect.bottom,
            noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            sidebarOverflow: getComputedStyle(sidebarBody).overflowY,
            panelOverflow: getComputedStyle(panelBody).overflowY,
          };
        });
        assert.deepEqual(responsive, {
          preferredWidth: "520px",
          stacked: true,
          noHorizontalOverflow: true,
          sidebarOverflow: "auto",
          panelOverflow: "auto",
        });
        assert.equal(await page.getByRole("separator", { name: "사이드바 너비 조절" }).isVisible(), false);
        assert.ok(visualLongSidebarContent, "representative long sidebar content must be prepared");
        await assertReadableGroupHeader(page, visualLongSidebarContent);
        const panel = page.locator("section[aria-label='패널']");
        const panelHeader = panel.locator(".af-native-panel-header");
        const mcpTab = panel.getByRole("tab", { name: "MCP 연결", exact: true });
        const tabLayout = await panelHeader.evaluate((header) => {
          const panelRect = header.closest("section[aria-label='패널']")?.getBoundingClientRect();
          const headerRect = header.getBoundingClientRect();
          if (!panelRect) return null;
          return Array.from(header.querySelectorAll('[role="tab"]')).map((tab) => {
            const rect = tab.getBoundingClientRect();
            return {
              label: tab.textContent?.trim(),
              contained:
                rect.left >= headerRect.left &&
                rect.right <= headerRect.right + 1 &&
                rect.left >= panelRect.left &&
                rect.right <= panelRect.right + 1,
              unclipped: tab.scrollWidth <= tab.clientWidth,
            };
          });
        });
        assert.deepEqual(tabLayout, [
          { label: "작업공간 정보", contained: true, unclipped: true },
          { label: "MCP 연결", contained: true, unclipped: true },
        ]);
        await mcpTab.focus();
        assert.equal(await mcpTab.evaluate((node) => node === document.activeElement), true);
        await mcpTab.press("Enter");
        assert.equal(await mcpTab.getAttribute("aria-selected"), "true");
        const mcpView = panel.locator(".af-native-mcp");
        await mcpView.waitFor({ timeout: 10_000 });
        const responsiveConnectionName = `responsive-${Date.now().toString(36)}`;
        await mcpView.getByRole("button", { name: "토큰 발급", exact: true }).click();
        const issueDialog = page.getByRole("dialog", { name: "연결 토큰 발급" });
        await issueDialog.getByLabel("토큰 이름").fill(responsiveConnectionName);
        await issueDialog.getByRole("button", { name: "발급", exact: true }).click();
        await issueDialog.waitFor({ state: "hidden", timeout: 10_000 });
        const responsiveToken = mcpView
          .locator(".af-native-token-list article")
          .filter({ hasText: responsiveConnectionName });
        await responsiveToken.waitFor({ timeout: 10_000 });
        const responsiveTokenSelector = responsiveToken.getByRole("button", {
          name: new RegExp(responsiveConnectionName),
        });
        await responsiveTokenSelector.click();
        const mcpLayout = await mcpView.evaluate((root) => {
          const steps = root.querySelector(".af-native-mcp-steps");
          const tokenList = root.querySelector(".af-native-token-list");
          if (!steps || !tokenList) return null;
          const tokenRect = tokenList.getBoundingClientRect();
          const stepRect = steps.getBoundingClientRect();
          const descendants = steps.querySelectorAll("section, button, textarea, [role='status']");
          return {
            regionsOverlap: stepRect.bottom > tokenRect.top && stepRect.top < tokenRect.bottom,
            descendantOverlap: Array.from(descendants).some((node) => {
              const rect = node.getBoundingClientRect();
              return rect.bottom > tokenRect.top && rect.top < tokenRect.bottom;
            }),
            stepCount: steps.querySelectorAll(":scope > section").length,
          };
        });
        assert.deepEqual(mcpLayout, { regionsOverlap: false, descendantOverlap: false, stepCount: 4 });
        const reachableActions = [
          ["토큰 발급", mcpView.getByRole("button", { name: "토큰 발급", exact: true })],
          ["전체 설정 ZIP 다운로드", mcpView.getByRole("button", { name: "전체 설정 ZIP 다운로드", exact: true })],
          ["AI 지침 복사", mcpView.getByRole("button", { name: "AI 지침 복사", exact: true })],
          ["연결 확인", mcpView.getByRole("button", { name: "연결 확인", exact: true })],
          ["새로고침", mcpView.getByRole("button", { name: "새로고침", exact: true })],
          [responsiveConnectionName, responsiveTokenSelector],
          ["폐기", responsiveToken.getByRole("button", { name: "폐기", exact: true })],
        ];
        for (const [label, action] of reachableActions) {
          await action.waitFor({ state: "visible", timeout: 10_000 });
          await action.waitFor({ state: "attached", timeout: 10_000 });
          assert.equal(await action.isEnabled(), true, `${label} must be enabled before keyboard focus`);
          await action.focus();
          assert.equal(
            await action.evaluate((node) => node === document.activeElement),
            true,
            `${label} must be keyboard reachable`,
          );
        }
        const sidebarToggle = page.getByRole("button", { name: "사이드바 표시" });
        await sidebarToggle.focus();
        assert.equal(await sidebarToggle.evaluate((node) => node === document.activeElement), true);
        await page.screenshot({ path: "/tmp/af-native-stage10-390-responsive.png", fullPage: true });
      }
      await page.screenshot({ path: `/tmp/af-native-stage10-${width}.png`, fullPage: true });
      await context.close();
    }

    assert.ok(unenabledContext, "the unenabled rollout context must be created");
    const fallback = await authenticated(browser, userCookie);
    const fallbackPage = await fallback.newPage();
    const fallbackURL = new URL("./workbench/", baseURL);
    fallbackURL.searchParams.set("organization", unenabledContext.organizationId);
    fallbackURL.searchParams.set("workspace", unenabledContext.workspaceId);
    fallbackURL.searchParams.set("task", "workspaces");
    await fallbackPage.goto(fallbackURL.href, { waitUntil: "domcontentloaded" });
    await fallbackPage.waitForURL((url) => url.pathname.endsWith("/workspace/"), { timeout: 10_000 });
    assert.ok(new URL(fallbackPage.url()).pathname.endsWith("/workspace/"));
    await fallback.close();

    const denied = await authenticated(browser, userCookie);
    const deniedPage = await denied.newPage();
    await deniedPage.goto("./workbench/?task=administration");
    assert.equal(await deniedPage.getByTitle("관리자").count(), 0);
    const direct = await deniedPage.request.get("./api/admin/users");
    assert.equal(direct.status(), 403);
    assert.ok(seededOrganization && seededWorkspace);
    await denied.close();

    const admin = await authenticated(browser, adminCookie);
    const adminPage = await admin.newPage();
    await adminPage.goto("./workbench/?task=administration");
    await adminPage.getByTitle("관리자").click();
    for (const label of [
      "대시보드",
      "사용자",
      "조직 및 작업공간",
      "Jobs",
      "연동 상태",
      "감사",
      "기능 플래그",
      "런타임",
      "공통 에셋",
    ]) {
      await adminPage.getByRole("button", { name: label, exact: true }).click();
      await adminPage.locator(".af-native-panel-body").waitFor();
    }
    await adminPage.getByRole("button", { name: "Jobs", exact: true }).click();
    const failedJob = adminPage.getByRole("row").filter({ hasText: "failed" });
    await failedJob.getByRole("button", { name: "재시도", exact: true }).click();
    const runningJob = adminPage.getByRole("row").filter({ hasText: "running" });
    await runningJob.getByRole("button", { name: "취소", exact: true }).click();
    const jobDialog = adminPage.getByRole("dialog", { name: "관리 작업 확인" });
    await jobDialog.getByRole("button", { name: "취소", exact: true }).click();
    await runningJob.getByRole("button", { name: "취소", exact: true }).click();
    await jobDialog.getByRole("button", { name: "확인", exact: true }).click();

    await adminPage.getByRole("button", { name: "연동 상태", exact: true }).click();
    const integrationRow = adminPage.getByRole("row").filter({ hasText: "Stage 10 connection" });
    await integrationRow.getByRole("button", { name: "연동 해제", exact: true }).click();
    const integrationDialog = adminPage.getByRole("dialog", { name: "관리 작업 확인" });
    await integrationDialog.getByRole("button", { name: "취소", exact: true }).click();
    await integrationRow.getByRole("button", { name: "연동 해제", exact: true }).click();
    await integrationDialog.getByRole("button", { name: "확인", exact: true }).click();

    const adminProfile = await (await adminPage.request.get("./api/auth/me")).json();
    await adminPage.getByRole("button", { name: "조직 및 작업공간", exact: true }).click();
    await adminPage.getByRole("button", { name: "소유자 추가", exact: true }).click();
    const ownerDialog = adminPage.getByRole("dialog", { name: "소유자 추가" });
    await ownerDialog.getByLabel("범위").selectOption("workspace");
    await ownerDialog.getByLabel("리소스 UUID").fill(seededWorkspace);
    await ownerDialog.getByLabel("사용자 UUID").fill(adminProfile.user.id);
    await ownerDialog.getByRole("button", { name: "추가", exact: true }).click();
    await ownerDialog.waitFor({ state: "hidden", timeout: 10_000 });
    await adminPage.getByRole("button", { name: "기능 플래그", exact: true }).click();
    const flagRow = adminPage.getByRole("row").filter({ hasText: "react-workbench" });
    await flagRow.getByRole("button", { name: "편집" }).click();
    const flagDialog = adminPage.getByRole("dialog", { name: "기능 플래그 편집" });
    await flagDialog.getByLabel("설명").fill("Stage 10 rendered administrator acceptance");
    await flagDialog.getByRole("button", { name: "저장" }).click();
    await flagDialog.waitFor({ state: "hidden", timeout: 10_000 });
    assert.equal(
      await adminPage
        .locator("body")
        .textContent()
        .then((text) => /ciphertext|afm_[A-Za-z0-9_-]+/.test(text || "")),
      false,
    );
    const usersResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === "GET" && new URL(response.url()).pathname === "/api/admin/users",
      { timeout: 10_000 },
    );
    await adminPage.getByRole("button", { name: "사용자", exact: true }).click();
    const adminUsers = await (await usersResponse).json();
    const ordinaryUserIndex = adminUsers.findIndex((user) => user.id === ordinaryUserId);
    assert.notEqual(ordinaryUserIndex, -1, `ordinary user ${ordinaryUserId} missing from administrator response`);
    const usersTable = adminPage.getByRole("table", { name: "사용자", exact: true });
    const ordinaryUserRow = usersTable.getByRole("row").nth(ordinaryUserIndex + 1);
    await ordinaryUserRow.getByRole("button", { name: "정지", exact: true }).click();
    const suspendDialog = adminPage.getByRole("dialog", { name: "관리 작업 확인" });
    await suspendDialog.getByRole("button", { name: "확인", exact: true }).click();
    await ordinaryUserRow.getByRole("button", { name: "복원", exact: true }).click();
    await ordinaryUserRow.getByRole("button", { name: "정지", exact: true }).waitFor({ timeout: 10_000 });
    await ordinaryUserRow.getByRole("button", { name: "세션 해제" }).click();
    const revokeDialog = adminPage.getByRole("dialog", { name: "관리 작업 확인" });
    await revokeDialog.getByRole("button", { name: "취소" }).click();
    await ordinaryUserRow.getByRole("button", { name: "세션 해제" }).click();
    const [revokeSessionsResponse] = await Promise.all([
      adminPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/admin/users/${ordinaryUserId}/revoke-sessions`,
        { timeout: 10_000 },
      ),
      revokeDialog.getByRole("button", { name: "확인" }).click(),
    ]);
    const revokeSessionsResult = await revokeSessionsResponse.json();
    assert.equal(revokeSessionsResponse.status(), 200, JSON.stringify(revokeSessionsResult));
    assert.ok(revokeSessionsResult.revoked_sessions >= 1, JSON.stringify(revokeSessionsResult));
    const revokedUser = await authenticated(browser, userCookie);
    assert.equal((await revokedUser.request.get("./api/auth/me")).status(), 401);
    await revokedUser.close();
    await admin.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
