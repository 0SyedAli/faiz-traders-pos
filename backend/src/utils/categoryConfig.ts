export type CategoryFieldKey =
  | "brand"
  | "size"
  | "gauge"
  | "lengthFeet"
  | "description"
  | "minimumStock";

export type CategoryConfig = {
  key: string;
  label: string;
  aliases: string[];
  fields: CategoryFieldKey[];
  sizes: string[];
  fixedLengthFeet?: number;
  brandRequired?: boolean;
  gaugeRequired?: boolean;
  defaultProductNames?: string[];
};

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: "gi-fitting",
    label: "GI Fitting",
    aliases: ["gi", "iron", "iron fitting", "fitting"],
    fields: ["size", "description", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4", "5", "6"],
    defaultProductNames: ["Elbow", "Socket", "Tee", "Union", "Bush", "Nipple", "Plug", "Cap"]
  },
  {
    key: "upvc-fitting",
    label: "UPVC Fitting",
    aliases: ["upvc", "upvc fitting", "fitting"],
    fields: ["brand", "size", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4", "5", "6"],
    brandRequired: false,
    defaultProductNames: ["Elbow", "Socket", "Tee", "Union", "Reducer", "Valve Socket", "End Cap"]
  },
  {
    key: "cpvc-fitting",
    label: "CPVC Fitting",
    aliases: ["cpvc", "cpvc fitting", "fitting"],
    fields: ["brand", "size", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2"],
    brandRequired: false,
    defaultProductNames: ["Elbow", "Socket", "Tee", "Union", "Reducer", "End Cap"]
  },
  {
    key: "ppr-fitting",
    label: "PPR Fitting",
    aliases: ["ppr", "ppr fitting", "fitting"],
    fields: ["brand", "size"],
    sizes: ["20mm", "25mm", "32mm", "40mm", "50mm", "63mm", "75mm", "90mm"],
    brandRequired: false,
    defaultProductNames: ["Elbow", "Socket", "Tee", "Union", "Reducer", "Valve Socket", "End Cap"]
  },
  {
    key: "gi-pipe",
    label: "GI Pipe",
    aliases: ["gi", "iron", "iron pipe", "pipe"],
    fields: ["size", "gauge", "lengthFeet", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4", "5", "6"],
    fixedLengthFeet: 20,
    gaugeRequired: true
  },
  {
    key: "upvc-pipe",
    label: "UPVC Pipe",
    aliases: ["upvc", "upvc pipe", "pipe"],
    fields: ["brand", "size", "gauge", "lengthFeet", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4", "5", "6"],
    fixedLengthFeet: 20,
    brandRequired: false,
    gaugeRequired: true
  },
  {
    key: "cpvc-pipe",
    label: "CPVC Pipe",
    aliases: ["cpvc", "cpvc pipe", "pipe"],
    fields: ["brand", "size", "gauge", "lengthFeet", "minimumStock"],
    sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2"],
    fixedLengthFeet: 20,
    brandRequired: false,
    gaugeRequired: true
  },
  {
    key: "ppr-pipe",
    label: "PPR Pipe",
    aliases: ["ppr", "ppr pipe", "pipe"],
    fields: ["brand", "size", "lengthFeet", "minimumStock"],
    sizes: ["20mm", "25mm", "32mm", "40mm", "50mm", "63mm", "75mm", "90mm"],
    fixedLengthFeet: 10,
    brandRequired: false
  },
  { key: "muslim-shower", label: "Muslim Shower", aliases: ["muslim", "shower"], fields: ["brand", "description", "minimumStock"], sizes: [] },
  { key: "basin-tap", label: "Basin Tap", aliases: ["basin", "tap"], fields: ["brand", "description", "minimumStock"], sizes: [] },
  { key: "basin-mixer", label: "Basin Mixer", aliases: ["basin", "mixer"], fields: ["brand", "description", "minimumStock"], sizes: [] },
  { key: "wall-shower-set", label: "Wall Shower Set", aliases: ["wall", "shower", "set"], fields: ["brand", "description", "minimumStock"], sizes: [] },
  { key: "commode", label: "Commode", aliases: ["commode", "seat"], fields: ["brand", "description", "minimumStock"], sizes: [] },
  { key: "valves", label: "Valves", aliases: ["valve", "valves"], fields: ["brand", "size", "description", "minimumStock"], sizes: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "3", "4"] },
  { key: "accessories", label: "Accessories", aliases: ["accessory", "accessories"], fields: ["brand", "description", "minimumStock"], sizes: [] }
];

const normalize = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const slugifyCategory = (name?: string | null) =>
  normalize(name)
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getCategoryConfigByName = (name?: string | null) => {
  const slug = slugifyCategory(name);
  return CATEGORY_CONFIGS.find((config) => config.key === slug || slugifyCategory(config.label) === slug) || null;
};

export const getCategorySearchAliases = (categoryName?: string | null) => {
  const config = getCategoryConfigByName(categoryName);
  if (!config) return categoryName ? [categoryName] : [];
  return [config.label, ...config.aliases];
};

export const buildSearchText = ({
  name,
  categoryName,
  brandName,
  sizeLabel,
  gauge,
  sku
}: {
  name?: string;
  categoryName?: string;
  brandName?: string;
  sizeLabel?: string;
  gauge?: string;
  sku?: string;
}) => {
  const aliases = getCategorySearchAliases(categoryName);
  return [name, sku, categoryName, ...aliases, brandName, sizeLabel, gauge]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

export const buildDuplicateKey = ({
  name,
  categoryName,
  brandName,
  sizeLabel,
  gauge,
  lengthFeet
}: {
  name?: string;
  categoryName?: string;
  brandName?: string;
  sizeLabel?: string;
  gauge?: string;
  lengthFeet?: number;
}) =>
  [name, categoryName, brandName || "no-brand", sizeLabel || "no-size", gauge || "no-gauge", lengthFeet || 0]
    .map((part) => normalize(String(part)))
    .join("|");
