import { useMemo, useState } from "react";
import { assetCatalog, Button, Dialog, instantiateAsset, Toast, type CommonState } from "@agent-factory/design-system";

type Theme = "dark" | "light" | "high-contrast";
const widths = [180, 268, 520] as const;
const stateIds: Record<CommonState, string> = {
  loading: "loading-state@1",
  empty: "empty-state@1",
  error: "error-state@1",
  "permission-denied": "permission-denied-state@1",
  busy: "busy-state@1",
  stale: "stale-state@1",
  success: "success-state@1",
  progress: "progress-state@1",
};

export function CatalogPreview() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [width, setWidth] = useState<number>(268);
  const [selectedId, setSelectedId] = useState("tree@1");
  const [state, setState] = useState<CommonState>("loading");
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState(false);
  const selected = useMemo(
    () => assetCatalog.find((asset) => asset.id === selectedId) ?? assetCatalog[0],
    [selectedId],
  );
  const previewProps =
    selected?.kind === "icon"
      ? { ...selected.example, selected: true, notification: true }
      : selected && ["dialog@1", "menu@1", "popover@1", "toast@1"].includes(selected.id)
        ? { open: false }
        : (selected?.example ?? {});
  const isSidebar = selected?.allowedRegions.includes("sidebar");
  const previewRuntime =
    selected?.kind === "panel"
      ? {
          inputs: {
            slots: [
              { id: "primary", title: "기본 예제", content: "호출자가 제공한 합성 콘텐츠" },
              { id: "secondary", title: "보조 예제", content: "두 번째 합성 콘텐츠", meta: "예제 메타데이터" },
              { id: "tertiary", title: "추가 예제", content: "세 번째 합성 콘텐츠" },
            ],
          },
        }
      : selected?.allowedRegions.includes("sidebar")
        ? {
            inputs: {
              records: [
                { id: "fixture-one", label: "합성 탐색 항목", meta: "미리보기" },
                { id: "fixture-two", label: "두 번째 항목", group: "예제" },
              ],
            },
          }
        : selected?.id === "resource-table@1"
          ? { inputs: { records: [{ id: "fixture-row", title: "합성 리소스", status: "미리보기" }] } }
          : selected?.id === "resource-header@1"
            ? { inputs: { title: "합성 리소스", status: "미리보기" } }
            : selected?.id === "tabs@1"
              ? {
                  inputs: {
                    items: [
                      { id: "fixture-overview", label: "합성 개요" },
                      { id: "fixture-detail", label: "합성 세부" },
                    ],
                  },
                }
              : selected?.id === "select@1" || selected?.id === "multiselect@1"
                ? {
                    inputs: {
                      value: selected.id === "multiselect@1" ? ["합성 A"] : "합성 A",
                      options: ["합성 A", "합성 B"],
                    },
                  }
                : ["metric@1", "code@1", "markdown@1", "json@1"].includes(selected?.id ?? "")
                  ? { inputs: { value: "합성 미리보기 값" } }
                  : undefined;
  return (
    <main className="catalog-page" data-af-theme={theme}>
      <header className="catalog-toolbar">
        <div>
          <h1>공통 에셋 카탈로그</h1>
          <p>모든 데이터는 합성 예제이며 provider 연결 상태를 나타내지 않습니다.</p>
        </div>
        <label>
          테마
          <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
            <option value="dark">어둡게</option>
            <option value="light">밝게</option>
            <option value="high-contrast">고대비</option>
          </select>
        </label>
        <label>
          사이드바 폭
          <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
            {widths.map((value) => (
              <option key={value} value={value}>
                {value}px
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="catalog-body">
        <aside className="catalog-index" aria-label="에셋 선택">
          {(["icon", "sidebar", "panel", "control", "display", "feedback"] as const).map((kind) => (
            <section key={kind}>
              <h2>{kind}</h2>
              {assetCatalog
                .filter((asset) => asset.kind === kind)
                .map((asset) => (
                  <button
                    type="button"
                    aria-current={selected?.id === asset.id ? "page" : undefined}
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    {asset.id}
                  </button>
                ))}
            </section>
          ))}
        </aside>
        <section className="catalog-stage" aria-label="대화형 미리보기">
          <header>
            <div>
              <span className="catalog-kind">{selected?.allowedRegions.join(" · ")}</span>
              <h2>{selected?.id}</h2>
            </div>
            <div className="catalog-actions">
              <Button onClick={() => setDialog(true)}>대화상자</Button>
              <Button onClick={() => setToast(true)}>알림</Button>
            </div>
          </header>
          <dl>
            <div>
              <dt>속성</dt>
              <dd>{selected?.properties.map((item) => item.name).join(", ") || "없음"}</dd>
            </div>
            <div>
              <dt>동작</dt>
              <dd>{selected?.actions.join(", ") || "없음"}</dd>
            </div>
            <div>
              <dt>접근성</dt>
              <dd>{selected?.accessibility.keyboard}</dd>
            </div>
          </dl>
          <div className="catalog-preview" style={isSidebar ? { width } : undefined}>
            {selected && instantiateAsset(selected.id, previewProps, previewRuntime)}
          </div>
          <section className="catalog-state-picker">
            <h3>공통 상태</h3>
            <div>
              {Object.keys(stateIds).map((value) => (
                <button
                  type="button"
                  aria-pressed={state === value}
                  key={value}
                  onClick={() => setState(value as CommonState)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="catalog-state-preview">{instantiateAsset(stateIds[state])}</div>
          </section>
        </section>
      </div>
      <Dialog open={dialog} title="대화상자 상호작용" onClose={() => setDialog(false)}>
        <p>Esc, 바깥 영역 또는 닫기 버튼으로 종료할 수 있습니다.</p>
        <Button variant="primary" onClick={() => setDialog(false)}>
          확인
        </Button>
      </Dialog>
      <Toast open={toast} onClose={() => setToast(false)} />
    </main>
  );
}
