import { useEffect, useRef, useState } from "react";
import { apiPath } from "../../api-path.js";
import { documentClient, type DocumentRecord } from "./document-client.js";

interface PdfViewport {
  width: number;
  height: number;
}
interface PdfPage {
  getViewport(value: { scale: number }): PdfViewport;
  render(value: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport; transform: number[] }): {
    promise: Promise<void>;
    cancel(): void;
  };
}
interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<PdfPage>;
}
interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
  destroy(): Promise<void>;
}
interface PdfModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(value: Record<string, unknown>): PdfLoadingTask;
}

function PdfViewer({
  blob,
  title,
  rootPath,
  downloadUrl,
}: {
  blob: Blob;
  title: string;
  rootPath: string;
  downloadUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const taskRef = useRef<PdfLoadingTask | null>(null);
  const renderRef = useRef<{ cancel(): void } | null>(null);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState("PDF를 준비하는 중입니다.");

  useEffect(() => {
    let active = true;
    const base = `${rootPath}/static/vendor/pdfjs/6.3.289/`;
    const moduleUrl = `${base}legacy/build/pdf.mjs`;
    void import(/* @vite-ignore */ moduleUrl)
      .then(async (module: unknown) => {
        if (!active) return;
        const pdfjs = module as PdfModule;
        pdfjs.GlobalWorkerOptions.workerSrc = `${base}legacy/build/pdf.worker.mjs`;
        const data = new Uint8Array(await blob.arrayBuffer());
        if (!active) return;
        const task = pdfjs.getDocument({
          data,
          cMapUrl: `${base}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${base}standard_fonts/`,
          wasmUrl: `${base}wasm/`,
          isEvalSupported: false,
          useWasm: false,
          disableFontFace: true,
        });
        taskRef.current = task;
        const loaded = await task.promise;
        if (active) setPdf(loaded);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "PDF를 열지 못했습니다.");
      });
    return () => {
      active = false;
      renderRef.current?.cancel();
      void taskRef.current?.destroy().catch(() => undefined);
    };
  }, [blob, rootPath]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let active = true;
    void pdf.getPage(page).then(async (pdfPage) => {
      if (!active || !canvasRef.current) return;
      const viewport = pdfPage.getViewport({ scale: zoom });
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(8_000_000 / (viewport.width * viewport.height)),
      );
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF canvas를 초기화하지 못했습니다.");
      const render = pdfPage.render({
        canvasContext: context,
        viewport,
        transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      renderRef.current = render;
      await render.promise;
      if (active) setMessage(`${page} / ${pdf.numPages} · ${Math.round(zoom * 100)}%`);
    });
    return () => {
      active = false;
      renderRef.current?.cancel();
    };
  }, [page, pdf, zoom]);

  return (
    <div className="af-document-pdf">
      <div className="af-document-editor__toolbar" aria-label="PDF 도구">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
          이전 페이지
        </button>
        <span role="status">{message}</span>
        <button
          type="button"
          onClick={() => setPage((value) => Math.min(pdf?.numPages ?? value, value + 1))}
          disabled={!pdf || page >= pdf.numPages}
        >
          다음 페이지
        </button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>
          축소
        </button>
        <button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>
          확대
        </button>
        <a href={downloadUrl} download={title}>
          다운로드
        </a>
      </div>
      <canvas ref={canvasRef} role="img" aria-label={`${title} ${page}페이지`} />
    </div>
  );
}

export function DocumentViewer({
  document,
  organizationId,
  workspaceId,
  revision,
}: {
  document: DocumentRecord;
  organizationId: string;
  workspaceId: string;
  revision: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "permission" | "error">("loading");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mediaType, setMediaType] = useState("");
  const [text, setText] = useState("");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const rootPath = apiPath("").replace(/\/$/, "");

  useEffect(() => {
    const request = new AbortController();
    setPhase("loading");
    setBlob(null);
    setText("");
    void documentClient
      .content(organizationId, workspaceId, document.id, revision, request.signal)
      .then(async (result) => {
        if (request.signal.aborted) return;
        setBlob(result.blob);
        setMediaType(result.mediaType);
        if (result.mediaType.startsWith("text/") || result.mediaType === "application/json") {
          const source = await result.blob.text();
          if (request.signal.aborted) return;
          if (result.mediaType === "application/json") {
            try {
              setText(JSON.stringify(JSON.parse(source), null, 2));
            } catch {
              setText(source);
            }
          } else setText(source);
        }
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return;
        const status = typeof error === "object" && error && "status" in error ? error.status : null;
        setPhase(status === 401 || status === 403 ? "permission" : "error");
      });
    return () => request.abort();
  }, [attempt, document.id, organizationId, revision, workspaceId]);

  useEffect(() => {
    setObjectUrl(null);
    if (
      !blob ||
      !(mediaType.startsWith("image/") || mediaType === "application/pdf" || mediaType.includes("officedocument"))
    )
      return;
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob, mediaType]);

  if (phase === "loading") return <p role="status">문서를 불러오는 중입니다.</p>;
  if (phase === "permission")
    return (
      <div role="alert">
        <p>문서에 접근할 권한이 없습니다.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          다시 시도
        </button>
      </div>
    );
  if (phase === "error")
    return (
      <div role="alert">
        <p>문서를 불러오지 못했습니다.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          다시 시도
        </button>
      </div>
    );
  if (!blob) return <p>표시할 revision 내용이 없습니다.</p>;
  if (mediaType.startsWith("text/") || mediaType === "application/json")
    return <pre className="af-document-text">{text}</pre>;
  if (mediaType === "application/pdf" && objectUrl)
    return <PdfViewer blob={blob} title={document.title} rootPath={rootPath} downloadUrl={objectUrl} />;
  if (mediaType.startsWith("image/") && objectUrl)
    return <img className="af-document-image" src={objectUrl} alt={document.title} />;
  if (mediaType === "application/zip" && document.document_type === "specification")
    return (
      <iframe
        className="af-document-package-preview"
        title={`${document.title} 격리 미리보기`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        src={apiPath(documentClient.packagePreview(organizationId, workspaceId, document.id, revision))}
      />
    );
  return (
    <a
      href={objectUrl ?? apiPath(documentClient.contentPath(organizationId, workspaceId, document.id, revision))}
      download
    >
      파일 다운로드
    </a>
  );
}
