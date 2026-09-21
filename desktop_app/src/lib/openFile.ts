import { toast } from "sonner";
import { CsvError, ExcelError, parseCsv, parseExcel } from "@/lib/dqi/parse";
import { useApp } from "@/store/app";

/** Read, parse and check a supported CSV or Excel file. */
export async function openCsvFile(file: File): Promise<void> {
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase();
  if (!extension || !["csv", "xls", "xlsx"].includes(extension)) {
    toast.error(`${file.name} isn't a supported data file`, {
      description: "Choose a CSV, XLS, or XLSX file and open it again.",
    });
    return;
  }
  try {
    const dataset =
      extension === "csv"
        ? parseCsv(await file.text(), file.name)
        : parseExcel(await file.arrayBuffer(), file.name);
    // Let the "Checking…" state paint before the synchronous check runs.
    await new Promise((r) => setTimeout(r, 0));
    useApp.getState().openDataset(dataset);
  } catch (e) {
    const message =
      e instanceof CsvError || e instanceof ExcelError ? e.message : "The file couldn't be read.";
    toast.error(`Couldn't open ${file.name}`, { description: message });
  }
}
