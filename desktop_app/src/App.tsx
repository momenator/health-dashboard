import { Toaster } from "sonner";
import { OpenFile } from "@/components/OpenFile";
import { Results } from "@/components/Results";
import { useApp } from "@/store/app";

export function App() {
  const hasDataset = useApp((s) => s.dataset !== null);
  return (
    <>
      {hasDataset ? <Results /> : <OpenFile />}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
