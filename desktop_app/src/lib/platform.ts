/** File saving that works both inside Tauri (native dialog) and in a browser (download). */

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface SaveOptions {
  defaultName: string;
  filterName: string;
  extensions: string[];
  mimeType: string;
}

/** Returns false when the user cancelled the save dialog. */
export async function saveFile(data: Uint8Array | string, opts: SaveOptions): Promise<boolean> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: opts.defaultName,
      filters: [{ name: opts.filterName, extensions: opts.extensions }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  const blob = new Blob([bytes as BlobPart], { type: opts.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
