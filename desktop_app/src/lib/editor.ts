/**
 * Editor mode lets the data team change rules and save a new rules.json.
 * On in `npm run dev` and in builds made with VITE_RULE_EDITOR=true; off in releases.
 */
export const editorMode = import.meta.env.DEV || import.meta.env.VITE_RULE_EDITOR === "true";
