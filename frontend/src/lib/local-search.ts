import FlexSearch from "flexsearch";
import type { LocalProduct } from "@/types/offline";

export type SearchableProduct = LocalProduct & { salePrice: number };

type FlexIndex = {
  add: (id: string, text: string) => void;
  search: (query: string, options?: { limit?: number }) => Array<string | number>;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/["'’]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const productSearchText = (product: Pick<LocalProduct, "name" | "sku" | "brand" | "category" | "size" | "gauge">) =>
  normalize([product.name, product.sku, product.brand, product.category, product.size, product.gauge].filter(Boolean).join(" "));

export class FastProductSearch {
  private index: FlexIndex;
  private rows = new Map<string, LocalProduct>();

  constructor(products: LocalProduct[]) {
    this.index = new (FlexSearch as unknown as { Index: new (options: object) => FlexIndex }).Index({
      tokenize: "forward",
      cache: 200,
      resolution: 9,
    });

    for (const product of products) {
      this.rows.set(product.id, product);
      this.index.add(product.id, product.searchText || productSearchText(product));
    }
  }

  search(query: string, categoryId: string, limit = 120): LocalProduct[] {
    const normalizedQuery = normalize(query);
    const tokens = normalizedQuery.split(" ").filter(Boolean);

    if (!tokens.length) {
      return Array.from(this.rows.values())
        .filter((row) => !categoryId || row.categoryId === categoryId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit);
    }

    const tokenResults = tokens.map((token) => new Set(this.index.search(token, { limit: 600 }).map(String)));
    const [first, ...rest] = tokenResults;
    const ids = Array.from(first || []).filter((id) => rest.every((set) => set.has(id)));

    return ids
      .map((id) => this.rows.get(id))
      .filter((row): row is LocalProduct => Boolean(row))
      .filter((row) => !categoryId || row.categoryId === categoryId)
      .filter((row) => tokens.every((token) => row.searchText.includes(token)))
      .slice(0, limit);
  }
}
