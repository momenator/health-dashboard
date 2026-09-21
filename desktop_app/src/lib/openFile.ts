import { toast } from "sonner";
import { CsvError, parseCsv } from "@/lib/dqi/parse";
import { useApp } from "@/store/app";

/** Read, parse and check a CSV the user picked or dropped. */
export async function openCsvFile(file: File): Promise<void> {
  if (!/\.(csv|txt)$/i.test(file.name)) {
    toast.error(`${file.name} isn't a CSV file`, {
      description: "Save the sheet as CSV (comma or semicolon separated) and open it again.",
    });
    return;
  }
  try {
    const text = await file.text();
    // Let the "Checking…" state paint before the synchronous check runs.
    await new Promise((r) => setTimeout(r, 0));
    useApp.getState().openDataset(parseCsv(text, file.name));
  } catch (e) {
    const message = e instanceof CsvError ? e.message : "The file couldn't be read as CSV.";
    toast.error(`Couldn't open ${file.name}`, { description: message });
  }
}
