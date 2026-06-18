export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "text/javascript": "JS",
  "text/typescript": "TS",
  "text/css": "CSS",
  "text/html": "HTML",
  "text/markdown": "MD",
  "text/csv": "CSV",
  "application/json": "JSON",
  "application/xml": "XML",
  "text/x-python": "PY",
  "text/x-java": "JAVA",
  "text/x-c": "C",
  "text/x-c++": "CPP",
  "text/x-rust": "RS",
  "text/x-go": "GO",
  "text/x-ruby": "RB",
  "text/x-php": "PHP",
  "text/x-sh": "SH",
  "text/yaml": "YAML",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

export const MAX_FILE_SIZE = 20 * 1024 * 1024;

const FILE_EXT_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".jsx": "text/javascript",
  ".tsx": "text/typescript",
  ".css": "text/css",
  ".html": "text/html",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".py": "text/x-python",
  ".java": "text/x-java",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
  ".rb": "text/x-ruby",
  ".php": "text/x-php",
  ".sh": "text/x-sh",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function normalizeFileType(file: File): string {
  if (file.type && file.type !== "application/octet-stream" && file.type !== "") return file.type;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return FILE_EXT_MAP[ext] || "application/octet-stream";
}

export function validateFile(file: File): string | null {
  const type = normalizeFileType(file);
  if (!(type in ALLOWED_TYPES)) {
    return `File type "${file.type || file.name.split('.').pop()}" is not supported.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 20MB.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

export function isDocumentType(type: string): boolean {
  return type === "application/pdf" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || type === "text/plain";
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export async function extractPDFText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) });
  const doc = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    parts.push(tc.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return parts.join("\n\n");
}

export async function extractDOCXText(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractFileText(type: string, buffer: ArrayBuffer): Promise<string> {
  if (type === "application/pdf") {
    return extractPDFText(buffer);
  }
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDOCXText(buffer);
  }
  if (type.startsWith("text/") || type === "application/json" || type === "application/xml") {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }
  return "";
}
