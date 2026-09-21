import { parseRuleSet } from "@/lib/dqi/schema";
import raw from "./rules.json";

/** The rules every installation runs. Change them in editor mode and ship a new release. */
export const shippedRuleSet = parseRuleSet(raw);
