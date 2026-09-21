import { z } from "zod";

// Schema for src/rules/rules.json. The file ships inside the app, so this is
// checked by a unit test (and again at startup) rather than trusted blindly.

const column = z.string().min(1);

const ruleBase = {
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "use lowercase letters, digits and dashes"),
  label: z.string().min(1),
  enabled: z.boolean().default(true),
};

export const compareOps = ["<=", "<", ">=", ">", "="] as const;

export const ruleSchema = z.discriminatedUnion("type", [
  z.object({
    ...ruleBase,
    type: z.literal("range"),
    params: z
      .object({ column, min: z.number().nullable(), max: z.number().nullable() })
      .refine((p) => p.min !== null || p.max !== null, "set a minimum, a maximum or both")
      .refine(
        (p) => p.min === null || p.max === null || p.min <= p.max,
        "minimum is above maximum",
      ),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("allowed"),
    params: z.object({ column, values: z.array(z.string()).min(1) }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("compare"),
    params: z.object({ a: column, op: z.enum(compareOps), b: column }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("dateOrder"),
    params: z.object({ earlier: column, later: column }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("sum"),
    params: z.object({
      parts: z.array(column).min(2),
      // A column name, or a fixed number written as a string (e.g. "100").
      total: z.string().min(1),
      tolerance: z.number().min(0).default(0),
    }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("requiredIf"),
    params: z.object({
      when: column,
      equals: z.array(z.string()).min(1),
      then: column,
      expect: z.enum(["filled", "empty"]),
    }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("required"),
    params: z.object({ columns: z.array(column).min(1) }),
  }),
  z.object({
    ...ruleBase,
    type: z.literal("unique"),
    params: z.object({ column }),
  }),
]);

export const builtinSettingsSchema = z.object({
  identical: z.boolean(),
  textInNumbers: z.boolean(),
  future: z.boolean(),
  outliers: z.boolean(),
  /** Tukey fence multiplier (spec §3.6 uses 3). */
  k: z.number().positive(),
  /** Minimum numeric values before outliers are checked (spec §10). */
  minN: z.number().int().min(5),
  spelling: z.boolean(),
  ignoredColumns: z.array(column),
});

export const ruleSetSchema = z
  .object({
    version: z.string().min(1),
    rules: z.array(ruleSchema),
    builtin: builtinSettingsSchema,
  })
  .superRefine((set, ctx) => {
    const seen = new Set<string>();
    set.rules.forEach((r, i) => {
      if (seen.has(r.id))
        ctx.addIssue({ code: "custom", path: ["rules", i, "id"], message: `duplicate id ${r.id}` });
      seen.add(r.id);
    });
  });

export type Rule = z.infer<typeof ruleSchema>;
export type RuleType = Rule["type"];
export type CompareOp = (typeof compareOps)[number];
export type BuiltinSettings = z.infer<typeof builtinSettingsSchema>;
export type RuleSet = z.infer<typeof ruleSetSchema>;

export function parseRuleSet(input: unknown): RuleSet {
  return ruleSetSchema.parse(input);
}
