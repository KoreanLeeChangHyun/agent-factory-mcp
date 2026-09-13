import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("web routes", () => {
  it("retains the normal Documents health route", () => {
    const html = renderToStaticMarkup(<App path="/" />);
    expect(html).toContain("<main");
    expect(html).toContain("문서 탐색기");
    expect(html).toContain("documents");
  });

  it("renders the separate catalog author surface", () => {
    const html = renderToStaticMarkup(<App path="/catalog" />);
    expect(html).toContain("공통 에셋 카탈로그");
    expect(html).toContain("tree@1");
  });

  it("uses the authenticated shared shell for production Workbench deep links", () => {
    const html = renderToStaticMarkup(<App path="/factory/workbench/documents/example" />);
    expect(html).toContain("불러오는 중");
    expect(html).not.toContain("공유 계약 fixture가 유효합니다");
  });
});
