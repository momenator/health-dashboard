import { FileDown, FolderOpen, ListChecks } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { editorMode } from "@/lib/editor";
import { exportWorkbook } from "@/lib/exportActions";
import { translate, type MessageKey } from "@/lib/i18n";
import { openCsvFile } from "@/lib/openFile";
import { displayMeta, useApp } from "@/store/app";
import { Brand } from "./Brand";
import { DetailPanel } from "./DetailPanel";
import { ProblemNav } from "./ProblemNav";
import { RecordDrawer } from "./RecordDrawer";
import { RulesDrawer } from "./RulesDrawer";

export function Results() {
  const input = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const openRules = useApp((s) => s.openRules);
  const version = useApp((s) => s.ruleSet.version);
  const language = useApp((s) => s.language);
  const t = (key: MessageKey) => translate(language, key);

  const onExport = async () => {
    const s = useApp.getState();
    const meta = displayMeta(s);
    if (!s.dataset || !s.result || !meta) return;
    setExporting(true);
    try {
      if (await exportWorkbook(s.dataset, s.result, meta)) toast.success("Excel file saved");
    } catch (e) {
      toast.error("The Excel file couldn't be saved", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6">
        <div className="mr-auto">
          <Brand />
        </div>
        <span className="text-xs text-muted-foreground">
          Rules {version}
          {editorMode && " · editor mode"}
        </span>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          <FolderOpen /> {t("openAnother")}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void openCsvFile(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" onClick={() => openRules()}>
          <ListChecks /> {t("viewRules")}
        </Button>
        <Button size="sm" onClick={onExport} disabled={exporting}>
          <FileDown /> {exporting ? t("saving") : t("exportExcel")}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <ProblemNav />
          <DetailPanel />
        </div>
      </div>

      <RecordDrawer />
      <RulesDrawer />
    </div>
  );
}
