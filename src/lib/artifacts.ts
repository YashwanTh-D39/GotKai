export type ArtifactType = "html" | "code" | "markdown" | "svg" | "chart";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language: string;
  createdAt: number;
};

export function detectArtifactType(
  language: string,
  content: string,
): ArtifactType {
  const htmlLangs = new Set(["html", "htm", "jsx", "tsx"]);
  const svgLangs = new Set(["svg", "svg+xml"]);
  const mdLangs = new Set(["markdown", "md", "mdx"]);

  if (htmlLangs.has(language)) return "html";
  if (svgLangs.has(language)) return "svg";
  if (mdLangs.has(language)) return "markdown";
  if (language === "chart" || language === "mermaid") return "chart";

  // Detect from content
  if (content.trim().startsWith("<svg")) return "svg";
  if (content.trim().startsWith("<!DOCTYPE html") || content.trim().startsWith("<html")) return "html";
  if (content.trim().startsWith("# ") || content.trim().startsWith("## ")) return "markdown";

  return "code";
}

export function canRenderLive(artifact: Artifact): boolean {
  return artifact.type === "html" || artifact.type === "svg" || artifact.type === "markdown";
}

export function wrapHtmlPreview(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:1rem;line-height:1.6;color:#e4e4e7;background:#18181b;max-width:100%;overflow-x:auto}pre{background:#27272a;padding:1rem;border-radius:8px;overflow-x:auto}code{font-family:monospace}img{max-width:100%}a{color:#818cf8}table{border-collapse:collapse;width:100%}td,th{border:1px solid #3f3f46;padding:0.5rem;text-align:left}</style></head><body>${content}</body></html>`;
}

export function generateFileName(artifact: Artifact): string {
  const extMap: Record<string, string> = {
    html: "html",
    code: "txt",
    markdown: "md",
    svg: "svg",
    chart: "txt",
  };
  const ext = extMap[artifact.type] || "txt";
  const safeName = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
  return `${safeName || "artifact"}.${ext}`;
}

export function downloadArtifact(artifact: Artifact): void {
  const mimeMap: Record<string, string> = {
    html: "text/html",
    code: "text/plain",
    markdown: "text/markdown",
    svg: "image/svg+xml",
    chart: "text/plain",
  };
  const mime = mimeMap[artifact.type] || "text/plain";
  const blob = new Blob([artifact.content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = generateFileName(artifact);
  a.click();
  URL.revokeObjectURL(url);
}
