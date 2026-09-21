import { Languages } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useApp } from "@/store/app";

export function Brand() {
  const language = useApp((s) => s.language);
  const toggleLanguage = useApp((s) => s.toggleLanguage);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[12px] font-bold tracking-wide text-primary-foreground">
        DfM
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{translate(language, "dataCheck")}</div>
        <div className="text-xs text-muted-foreground">{translate(language, "brandSubtitle")}</div>
      </div>
      <button
        type="button"
        onClick={toggleLanguage}
        className="ml-1 inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold hover:bg-muted"
        aria-label={language === "en" ? "Passer au français" : "Switch to English"}
        title={language === "en" ? "Passer au français" : "Switch to English"}
      >
        <Languages className="h-3.5 w-3.5" />
        {translate(language, "language")}
      </button>
    </div>
  );
}
