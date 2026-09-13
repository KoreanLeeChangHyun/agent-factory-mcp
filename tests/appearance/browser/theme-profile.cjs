// THEME_URL=http://127.0.0.1:4173 NODE_PATH=/tmp/af-pw/node_modules node tests/appearance/browser/theme-profile.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const profile = (userId, revision, base = "dark", reducedMotion = false) => ({
  schemaVersion: "1.0",
  userId: userId.replaceAll("-", ""),
  revision,
  base,
  density: "compact",
  overrides: {},
  reducedMotion,
});

async function installApi(context, identity, profiles) {
  let conflict = false;
  await context.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: identity.userId,
          display_name: "Theme profile user",
          email: `${identity.userId}@example.test`,
          is_platform_admin: false,
        },
      },
    }),
  );
  await context.route("**/api/account/organizations", (route) => route.fulfill({ json: [] }));
  await context.route("**/api/appearance/theme-profile", async (route) => {
    const authoritative = profiles.get(identity.userId);
    if (route.request().method() === "GET") return route.fulfill({ json: authoritative });
    if (conflict)
      return route.fulfill({ status: 409, json: { detail: { code: "revision_conflict", current: authoritative } } });
    const update = route.request().postDataJSON();
    const saved = { ...authoritative, ...update, revision: authoritative.revision + 1 };
    delete saved.expectedRevision;
    profiles.set(identity.userId, saved);
    return route.fulfill({ json: saved });
  });
  return {
    current: () => profiles.get(identity.userId),
    conflict: (value) => {
      conflict = value;
    },
    set: (value) => {
      profiles.set(identity.userId, value);
    },
  };
}

async function openThemeSettings(page, base, navigate = true) {
  if (navigate) await page.goto(new URL("./workbench/?task=account", base).href);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await page.getByText("서버 테마를 적용했습니다.").waitFor();
}

(async () => {
  const base = process.env.THEME_URL || "http://127.0.0.1:4173";
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const first = await browser.newContext();
    const firstId = "01234567-89ab-cdef-0123-456789abcdef";
    const secondId = "11234567-89ab-cdef-0123-456789abcdef";
    const identity = { userId: firstId };
    const profiles = new Map([
      [firstId, profile(firstId, 0)],
      [secondId, profile(secondId, 1, "high-contrast")],
    ]);
    const firstApi = await installApi(first, identity, profiles);
    const page = await first.newPage();
    await openThemeSettings(page, base);
    const baseSelect = page.getByLabel("기본 테마");
    await baseSelect.focus();
    assert(await baseSelect.evaluate((element) => element === document.activeElement));
    assert(await baseSelect.evaluate((element) => Number.parseFloat(getComputedStyle(element).outlineWidth) >= 2));
    await baseSelect.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "light");
    const motion = page.getByLabel("움직임 줄이기");
    await motion.focus();
    await motion.press("Space");
    const save = page.getByRole("button", { name: "저장", exact: true });
    await save.focus();
    assert(await save.evaluate((element) => element === document.activeElement));
    await save.press("Enter");
    await page.getByText("서버에 저장했습니다.").waitFor();
    assert.equal(firstApi.current().revision, 1);
    await page.reload();
    await openThemeSettings(page, base, false);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afReducedMotion), "true");

    const sameUserDevice = await browser.newContext();
    await installApi(sameUserDevice, { userId: firstId }, profiles);
    const restoredPage = await sameUserDevice.newPage();
    await openThemeSettings(restoredPage, base);
    assert.equal(await restoredPage.evaluate(() => document.documentElement.dataset.afTheme), "light");
    assert.equal(await restoredPage.evaluate(() => document.documentElement.dataset.afReducedMotion), "true");

    firstApi.set(profile(firstId, 2, "high-contrast"));
    firstApi.conflict(true);
    await page.getByLabel("기본 테마").selectOption("dark");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.getByText("편집 내용은 유지됩니다.").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "dark");
    await page.getByRole("button", { name: "서버 버전 불러오기" }).click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");

    const separateUser = await browser.newContext();
    await installApi(separateUser, { userId: secondId }, profiles);
    const otherPage = await separateUser.newPage();
    await openThemeSettings(otherPage, base);
    assert.equal(await otherPage.evaluate(() => document.documentElement.dataset.afTheme), "high-contrast");
    await first.close();
    await sameUserDevice.close();
    await separateUser.close();
    console.log("PASS ThemeProfile keyboard, save/reload, same-user restoration, conflict recovery, and isolation");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
