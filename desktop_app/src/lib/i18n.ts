import type { Rule, RuleType, RichText } from "@/lib/dqi/types";
import { fmt, rangeText } from "@/lib/dqi/values";
import { totalIsColumn } from "@/lib/dqi/rules";

export type Language = "en" | "fr";

const messages = {
  en: {
    language: "FR",
    dataCheck: "Data Check",
    brandSubtitle: "Doctors for Madagascar · M&E",
    rules: "Rules",
    editorMode: "editor mode",
    checkingFile: "Checking the file…",
    checkCsv: "Check a CSV or Excel file for data-quality problems",
    dropFile:
      "Drop a CSV or Excel export here. The app scores it with the Data Quality Index and shows which values don't make sense. Nothing leaves this computer.",
    chooseFile: "Choose a CSV or Excel file",
    openAnother: "Open another file",
    viewRules: "Rules",
    exportExcel: "Export to Excel",
    saving: "Saving…",
    nothingToShow: "Nothing to show",
    everyCheckPassed:
      "Every check that applies to this file passed. Open Rules to see which rules ran.",
    pickProblem: "Pick a rule, column or person on the left.",
    details: "Details",
    records: "records",
    rulesRan: "rules ran",
    doNotApply: "don't apply",
    byRule: "By rule",
    byColumn: "By column",
    byPerson: "By person",
    needsFixing: "Needs fixing",
    worthLook: "Worth a look",
    noRuleViolations: "No rule violations.",
    nothingUnusual: "Nothing unusual found.",
    passed: "Passed",
    noDataEntry: "No data-entry column found",
    column: "Column",
    columnsMostFlagged: "Columns with the most flagged rows",
    noFlags: "No flags",
    cleanSheet: "Clean sheet",
    row: "Row",
    close: "Close",
    issue: "issue",
    issues: "issues",
    enteredBy: "Entered by",
    issuesPerDimension: "Issues per dimension",
    issueTip:
      "One issue is usually a typo. Several in the same record point to a pattern worth following up with the person who entered it.",
    allFields: "All fields",
    empty: "empty",
    noIssues: "No issues.",
    rowLabel: "Row",
    cleanSheetLabel: "Clean sheet",
    flaggedRows: "rows flagged",
    firstOccurrence: "First occurrence (kept)",
    whyFlagged: "Why it was flagged",
    addColumn: "Add a column…",
    chooseColumn: "Choose a column…",
    fillFromFile: "Fill from this file",
    minimum: "Minimum",
    maximum: "Maximum",
    allowedValues: "Allowed values, one per line",
    columnA: "Column A",
    columnB: "Column B",
    earlierColumn: "Earlier column",
    laterColumn: "Later column",
    columnsToAdd: "Columns to add",
    mustEqual: "Must equal (column or number)",
    allowedDifference: "Allowed difference",
    whenColumn: "When column",
    thenColumn: "Then column",
    filled: "filled",
    name: "Name",
    ruleType: "Rule type",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    newRule: "New rule",
    on: "On",
    off: "Off",
    unsavedChanges: "Unsaved changes",
    saveRules: "Save rules.json",
    addRule: "Add rule",
    resetRules: "Rules reset to the shipped version",
    everyInstallation:
      "Every installation runs these same rules. A rule runs whenever a file has the columns it needs. Ask the data team to change a rule.",
    editorDescription:
      "Editor mode. Changes re-check the open file straight away. Save rules.json and ship it in a release so every installation gets them.",
    dataQualityIndex: "Data Quality Index by dimension",
    reportedOnly: "reported only",
    weight: "weight",
    noCheckApplies: "No check applies to this file.",
    columnsFlagged: "Columns with the most flagged rows",
    chooseEnteredBy:
      "Choose the column that records who entered each row under Details → Entered by",
    editRule: "Edit rule",
    viewRule: "View rule",
    dataEntryBy: "Data entry by",
    everyFlagged:
      "Every flagged record entered by this person. Export the list to send it to them for correction.",
    nothingFlagged: "Nothing flagged",
    mustBe: "Must be",
    requiredColumns: "Columns that must be filled",
    valuesOnePerLine: "…has one of these values (one per line)",
    ruleId: "ID (used in rules.json)",
    saveRecheck: "Save and re-check",
    deleteRule: "Delete rule",
    resetShipped: "Reset to shipped rules",
    waitingOtherFiles: "Waiting for other files",
    builtInChecks: "Built-in checks · run on every file",
    noRuleMatches: "No rule matches this file's columns. The built-in checks below still run.",
    applyTo: "Apply to",
    needsColumns: "Needs column",
    rowsFlagged: "rows flagged",
    checkAgain: "Check this column again",
    notChecked: "Not checked",
    skippedInFile: "Skipped in this file",
    spreadMultiplier: "Spread multiplier",
    minimumValues: "Minimum values",
    identicalRows: "Identical rows",
    identicalRowsDescription: "Every field matches another row. Counts toward Uniqueness.",
    textInNumbers: "Text in number columns",
    textInNumbersDescription: "Flags text such as “n/a” or “12kg” in a mostly numeric column.",
    futureDates: "Dates in the future",
    futureDatesDescription: "Any date after today.",
    unusualValues: "Unusual values",
    unusualValuesDescription: "Tukey fence per numeric column. Counts toward Plausibility.",
    spellingVariants: "Spelling variants",
    spellingVariantsDescription:
      "Values that differ only in capitals, accents or one or two letters. Not scored.",
    rangeType: "Range",
    allowedType: "Allowed values",
    compareType: "Compare two columns",
    dateOrderType: "Date/time order",
    sumType: "Sum",
    requiredIfType: "Required if",
    requiredType: "Required",
    uniqueType: "Unique",
    op_at_most: "at most",
    op_less_than: "less than",
    op_at_least: "at least",
    op_more_than: "more than",
    op_equal_to: "equal to",
  },
  fr: {
    language: "EN",
    dataCheck: "Contrôle des données",
    brandSubtitle: "Doctors for Madagascar · S&E",
    rules: "Règles",
    editorMode: "mode éditeur",
    checkingFile: "Vérification du fichier…",
    checkCsv: "Vérifier un fichier CSV ou Excel",
    dropFile:
      "Déposez ici un export CSV ou Excel. L'application le vérifie avec l'indice de qualité des données et signale les valeurs incohérentes. Rien ne quitte cet ordinateur.",
    chooseFile: "Choisir un fichier CSV ou Excel",
    openAnother: "Ouvrir un autre fichier",
    viewRules: "Règles",
    exportExcel: "Exporter vers Excel",
    saving: "Enregistrement…",
    nothingToShow: "Rien à afficher",
    everyCheckPassed:
      "Toutes les vérifications applicables à ce fichier sont réussies. Ouvrez les règles pour voir celles qui ont été exécutées.",
    pickProblem: "Sélectionnez une règle, une colonne ou une personne à gauche.",
    details: "Détails",
    records: "enregistrements",
    rulesRan: "règles exécutées",
    doNotApply: "non applicables",
    byRule: "Par règle",
    byColumn: "Par colonne",
    byPerson: "Par personne",
    needsFixing: "À corriger",
    worthLook: "À vérifier",
    noRuleViolations: "Aucune violation de règle.",
    nothingUnusual: "Aucune anomalie trouvée.",
    passed: "Réussi",
    noDataEntry: "Aucune colonne de saisie trouvée",
    column: "Colonne",
    columnsMostFlagged: "Colonnes avec le plus de lignes signalées",
    noFlags: "Aucun signalement",
    cleanSheet: "Feuille conforme",
    row: "Ligne",
    close: "Fermer",
    issue: "problème",
    issues: "problèmes",
    enteredBy: "Saisie par",
    issuesPerDimension: "Problèmes par dimension",
    issueTip:
      "Un problème est généralement une faute de frappe. Plusieurs problèmes dans le même enregistrement peuvent révéler une tendance à suivre avec la personne qui l'a saisi.",
    allFields: "Tous les champs",
    empty: "vide",
    noIssues: "Aucun problème.",
    rowLabel: "Ligne",
    cleanSheetLabel: "Feuille conforme",
    flaggedRows: "lignes signalées",
    firstOccurrence: "Première occurrence (conservée)",
    whyFlagged: "Pourquoi cette ligne est signalée",
    addColumn: "Ajouter une colonne…",
    chooseColumn: "Choisir une colonne…",
    fillFromFile: "Remplir depuis ce fichier",
    minimum: "Minimum",
    maximum: "Maximum",
    allowedValues: "Valeurs autorisées, une par ligne",
    columnA: "Colonne A",
    columnB: "Colonne B",
    earlierColumn: "Colonne antérieure",
    laterColumn: "Colonne ultérieure",
    columnsToAdd: "Colonnes à additionner",
    mustEqual: "Doit être égal à (colonne ou nombre)",
    allowedDifference: "Différence autorisée",
    whenColumn: "Colonne conditionnelle",
    thenColumn: "Colonne concernée",
    filled: "rempli",
    name: "Nom",
    ruleType: "Type de règle",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    newRule: "Nouvelle règle",
    on: "Activé",
    off: "Désactivé",
    unsavedChanges: "Modifications non enregistrées",
    saveRules: "Enregistrer rules.json",
    addRule: "Ajouter une règle",
    resetRules: "Règles réinitialisées à la version fournie",
    everyInstallation:
      "Chaque installation utilise ces mêmes règles. Une règle s'exécute lorsque le fichier contient les colonnes nécessaires. Demandez à l'équipe des données de modifier une règle.",
    editorDescription:
      "Mode éditeur. Les modifications revérifient immédiatement le fichier ouvert. Enregistrez rules.json et incluez-le dans une version pour toutes les installations.",
    dataQualityIndex: "Indice de qualité des données par dimension",
    reportedOnly: "rapporté uniquement",
    weight: "poids",
    noCheckApplies: "Aucune vérification ne s'applique à ce fichier.",
    columnsFlagged: "Colonnes avec le plus de lignes signalées",
    chooseEnteredBy:
      "Choisissez la colonne indiquant qui a saisi chaque ligne dans Détails → Saisie par",
    editRule: "Modifier la règle",
    viewRule: "Voir la règle",
    dataEntryBy: "Saisie par",
    everyFlagged:
      "Chaque enregistrement signalé saisi par cette personne. Exportez la liste pour lui demander une correction.",
    nothingFlagged: "Aucun signalement",
    mustBe: "Doit être",
    requiredColumns: "Colonnes qui doivent être remplies",
    valuesOnePerLine: "…a l'une de ces valeurs (une par ligne)",
    ruleId: "ID (utilisé dans rules.json)",
    saveRecheck: "Enregistrer et revérifier",
    deleteRule: "Supprimer la règle",
    resetShipped: "Réinitialiser aux règles fournies",
    waitingOtherFiles: "En attente d'autres fichiers",
    builtInChecks: "Vérifications intégrées · exécutées sur chaque fichier",
    noRuleMatches:
      "Aucune règle ne correspond aux colonnes de ce fichier. Les vérifications intégrées ci-dessous s'exécutent quand même.",
    applyTo: "Appliquer à",
    needsColumns: "Colonne nécessaire",
    rowsFlagged: "lignes signalées",
    checkAgain: "Vérifier à nouveau cette colonne",
    notChecked: "Non vérifiées",
    skippedInFile: "Ignorées dans ce fichier",
    spreadMultiplier: "Multiplicateur de dispersion",
    minimumValues: "Valeurs minimales",
    identicalRows: "Lignes identiques",
    identicalRowsDescription: "Chaque champ correspond à une autre ligne. Compte pour l'unicité.",
    textInNumbers: "Texte dans les colonnes numériques",
    textInNumbersDescription:
      "Signale les textes comme « n/a » ou « 12kg » dans une colonne principalement numérique.",
    futureDates: "Dates futures",
    futureDatesDescription: "Toute date postérieure à aujourd'hui.",
    unusualValues: "Valeurs inhabituelles",
    unusualValuesDescription:
      "Détection de Tukey pour chaque colonne numérique. Compte pour la plausibilité.",
    spellingVariants: "Variantes orthographiques",
    spellingVariantsDescription:
      "Valeurs qui diffèrent seulement par les majuscules, accents ou une ou deux lettres. Non noté.",
    rangeType: "Plage",
    allowedType: "Valeurs autorisées",
    compareType: "Comparer deux colonnes",
    dateOrderType: "Ordre date/heure",
    sumType: "Somme",
    requiredIfType: "Obligatoire si",
    requiredType: "Obligatoire",
    uniqueType: "Unique",
    op_at_most: "au plus",
    op_less_than: "moins de",
    op_at_least: "au moins",
    op_more_than: "plus de",
    op_equal_to: "égal à",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function translate(language: Language, key: MessageKey): string {
  return messages[language][key];
}

const TYPE_KEYS: Record<RuleType, MessageKey> = {
  range: "rangeType",
  allowed: "allowedType",
  compare: "compareType",
  dateOrder: "dateOrderType",
  sum: "sumType",
  requiredIf: "requiredIfType",
  required: "requiredType",
  unique: "uniqueType",
};

const OP_KEYS: Record<string, MessageKey> = {
  "<=": "op_at_most",
  "<": "op_less_than",
  ">=": "op_at_least",
  ">": "op_more_than",
  "=": "op_equal_to",
};

export function ruleTypeLabel(language: Language, type: RuleType): string {
  return translate(language, TYPE_KEYS[type]);
}

const FRENCH_RULE_LABELS: Record<string, string> = {
  "Age between 0 and 110": "Âge entre 0 et 110",
  "Sex is female or male": "Le sexe est féminin ou masculin",
  "One row per patient": "Une ligne par patient",
  "One row per record ID": "Une ligne par identifiant d'enregistrement",
  "Discharge is not before inclusion": "La sortie n'est pas antérieure à l'inclusion",
  "Patient + DfM amount = invoice": "Montant patient + DfM = facture",
  "Payment shares add up to 100%": "Les parts de paiement totalisent 100 %",
  "Household size 1–30": "Taille du ménage entre 1 et 30",
  "Consent is yes or no": "Le consentement est oui ou non",
  "Surgical treatment names the intervention": "Le traitement chirurgical précise l'intervention",
  "Key intake fields are filled": "Les champs essentiels d'admission sont remplis",
  "Result is not before screening": "Le résultat n'est pas antérieur au dépistage",
  "Treatment start is not before screening": "Le traitement ne commence pas avant le dépistage",
  "Treatment end is not before its start": "La fin du traitement n'est pas antérieure à son début",
  "Positive TB result has a treatment start":
    "Un résultat TB positif a une date de début de traitement",
  "Weight 1–200 kg": "Poids entre 1 et 200 kg",
  "Height 0.3–2.3 m": "Taille entre 0,3 et 2,3 m",
  "BMI 10–60": "IMC entre 10 et 60",
  "Screening result uses known codes": "Le résultat du dépistage utilise des codes connus",
  "Key screening fields are filled": "Les champs essentiels du dépistage sont remplis",
  "Men + women = total participants": "Hommes + femmes = total des participants",
  "Age groups add up to total participants": "Les groupes d'âge totalisent les participants",
  "Activity ends after it starts": "L'activité se termine après son début",
  "Trip legs add up to total trip time": "Les étapes totalisent la durée du trajet",
  "Distance 0–500 km": "Distance entre 0 et 500 km",
  "Case count is at least 1": "Le nombre de cas est d'au moins 1",
  "Start date is not after record date":
    "La date de début n'est pas postérieure à la date de l'enregistrement",
};

export function ruleLabel(language: Language, label: string): string {
  return language === "fr" ? (FRENCH_RULE_LABELS[label] ?? label) : label;
}

export function describeRuleTranslated(rule: Rule, language: Language): RichText {
  const c = (value: string) => ({ code: value });
  switch (rule.type) {
    case "range":
      return [
        c(rule.params.column),
        language === "fr"
          ? ` doit être ${rangeText(rule.params.min, rule.params.max)}.`
          : ` must be ${rangeText(rule.params.min, rule.params.max)}.`,
      ];
    case "allowed":
      return [
        c(rule.params.column),
        language === "fr" ? " doit être l'une de ces valeurs : " : " must be one of: ",
        ...rule.params.values.flatMap((v, i) => (i ? [", ", c(v)] : [c(v)])),
        ".",
      ];
    case "compare":
      return [
        c(rule.params.a),
        language === "fr"
          ? ` doit être ${translate(language, OP_KEYS[rule.params.op])} `
          : ` must be ${translate(language, OP_KEYS[rule.params.op])} `,
        c(rule.params.b),
        ".",
      ];
    case "dateOrder":
      return [
        c(rule.params.later),
        language === "fr" ? " ne doit pas précéder " : " must not be before ",
        c(rule.params.earlier),
        language === "fr"
          ? ". Les lignes où l'une des dates est vide sont ignorées."
          : ". Rows where either is empty are skipped.",
      ];
    case "sum": {
      const total = totalIsColumn(rule.params.total) ? c(rule.params.total) : rule.params.total;
      return [
        ...rule.params.parts.flatMap((v, i) => (i ? [" + ", c(v)] : [c(v)])),
        language === "fr" ? " doit être égal à " : " must equal ",
        total,
        rule.params.tolerance ? ` (±${fmt(rule.params.tolerance)}).` : ".",
        language === "fr"
          ? " Les lignes dont une partie est vide sont ignorées."
          : " Rows with an empty part are skipped.",
      ];
    }
    case "requiredIf":
      return [
        language === "fr" ? "Lorsque " : "When ",
        c(rule.params.when),
        language === "fr" ? " est " : " is ",
        ...rule.params.equals.flatMap((v, i) =>
          i ? [language === "fr" ? " ou " : " or ", c(v)] : [c(v)],
        ),
        ", ",
        c(rule.params.then),
        language === "fr"
          ? ` doit être ${rule.params.expect === "filled" ? "rempli" : "vide"}.`
          : ` must be ${rule.params.expect}.`,
      ];
    case "required":
      return [
        rule.params.columns.join(", "),
        language === "fr"
          ? " doit être rempli dans chaque ligne."
          : " must be filled in every row.",
      ];
    case "unique":
      return [
        language === "fr" ? "Chaque valeur de " : "Each value of ",
        c(rule.params.column),
        language === "fr" ? " ne peut apparaître qu'une seule fois." : " may appear only once.",
      ];
  }
}
