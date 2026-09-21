import { FileSpreadsheet, FolderOpen } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { editorMode } from "@/lib/editor";
import { translate, type MessageKey } from "@/lib/i18n";
import { openCsvFile } from "@/lib/openFile";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import { Brand } from "./Brand";

export function OpenFile() {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const ruleSet = useApp((s) => s.ruleSet);
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);

  const open = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    await openCsvFile(file);
    setBusy(false);
  };

  return (
    <div className="flex min-h-full flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <Brand />
        <span className="text-xs text-muted-foreground">
          Rules {ruleSet.version}
          {editorMode && " · editor mode"}
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div
          role="button"
          tabIndex={0}
          aria-label="Open a CSV file"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void open(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card px-8 py-14 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft" : "hover:border-primary/60",
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {busy ? t("checkingFile") : t("checkCsv")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t("dropFile")}</p>
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={(e) => (e.stopPropagation(), input.current?.click())}
          >
            <FolderOpen /> {t("chooseFile")}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              void open(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </main>
    </div>
  );
}
