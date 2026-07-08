"use client";

import { FormEvent, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

const template = `productName,variantName,sku,barcode,brandName,categoryName,sizeName,unitName,saleUnit,baseUnit,lengthPerPiece,purchasePrice,retailPrice,wholesalePrice,plumberPrice,dealerPrice,lowStockAlertQty,allowDecimalQty,openingStock,warehouseName
PVC Pipe,PVC Pipe 1/2 Steelex 20ft,STX-PIPE-12,,Steelex,Pipes,1/2,Length,length,feet,20,500,650,620,600,590,5,false,20,Main Shop
PVC Pipe,PVC Pipe 3/4 Steelex 20ft,STX-PIPE-34,,Steelex,Pipes,3/4,Length,length,feet,20,700,850,820,800,790,5,false,15,Main Shop
Elbow,Elbow 1/2 Steelex,STX-ELBOW-12,,Steelex,Pipe Fittings,1/2,Piece,piece,piece,0,35,50,48,45,45,20,false,100,Main Shop`;

type ImportResult = {
  created: { row: number; sku: string; name: string }[];
  skipped: { row: number; sku: string; reason: string }[];
  errors: { row: number; sku: string; message: string }[];
  totalRows: number;
};

const parseBool = (value: string) => ["true", "yes", "1", "y"].includes(String(value || "").trim().toLowerCase());
const parseNum = (value: string) => Number(String(value || "0").trim() || 0);

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const requiredHeaders = [
  "productName",
  "variantName",
  "sku",
  "brandName",
  "categoryName",
  "unitName",
  "purchasePrice",
  "retailPrice"
];

export default function BulkProductsPage() {
  const [csv, setCsv] = useState(template);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length <= 1) return [];

    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map((line, index) => {
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header.trim()] = cols[i] || "";
      });
      return { index: index + 2, row };
    });
  }, [csv]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setSaving(true);

    try {
      const lines = csv.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length <= 1) throw new Error("CSV me header aur kam az kam 1 product row honi chahiye.");

      const headers = parseCsvLine(lines[0]).map((h) => h.trim());
      const missing = requiredHeaders.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

      const items = lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
          row[header] = cols[i] || "";
        });

        return {
          productName: row.productName,
          variantName: row.variantName,
          sku: row.sku,
          barcode: row.barcode,
          brandName: row.brandName,
          categoryName: row.categoryName,
          sizeName: row.sizeName,
          unitName: row.unitName,
          saleUnit: row.saleUnit || "piece",
          baseUnit: row.baseUnit || "piece",
          lengthPerPiece: parseNum(row.lengthPerPiece),
          purchasePrice: parseNum(row.purchasePrice),
          retailPrice: parseNum(row.retailPrice),
          wholesalePrice: parseNum(row.wholesalePrice),
          plumberPrice: parseNum(row.plumberPrice),
          dealerPrice: parseNum(row.dealerPrice),
          lowStockAlertQty: parseNum(row.lowStockAlertQty || "5"),
          allowDecimalQty: parseBool(row.allowDecimalQty),
          openingStock: parseNum(row.openingStock),
          warehouseName: row.warehouseName || "Main Shop"
        };
      });

      const res = await api<{ data: ImportResult }>("/products/variants/bulk", {
        method: "POST",
        body: JSON.stringify({ items })
      });

      setResult(res.data);
    } catch (err: any) {
      setError(err.message || "Bulk import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Bulk Product Import">
      <div className="page-header">
        <div>
          <h2>Bulk Product Import</h2>
          <p>CSV paste karo aur multiple products/variants ek sath import karo. Stock bhi auto add ho sakta hai.</p>
        </div>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      {result ? (
        <div className="notice success">
          Import done: {result.created.length} created, {result.skipped.length} skipped, {result.errors.length} errors.
        </div>
      ) : null}

      <div className="card">
        <div className="section-title">
          <h3>CSV Data</h3>
          <button className="small-btn" type="button" onClick={() => setCsv(template)}>
            Load Sample
          </button>
        </div>

        <form onSubmit={submit}>
          <textarea
            className="input csv-textarea"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            spellCheck={false}
          />

          <div className="bulk-help">
            <strong>Required columns:</strong> productName, variantName, sku, brandName, categoryName, unitName, purchasePrice, retailPrice
            <br />
            <strong>Tip:</strong> Excel/Google Sheet me data banao, CSV copy karke yahan paste kar do.
          </div>

          <button className="btn" disabled={saving || rows.length === 0}>
            {saving ? "Importing..." : `Import ${rows.length} Rows`}
          </button>
        </form>
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="section-title">
            <h3>Preview</h3>
            <span className="badge">{rows.length} rows</span>
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Brand</th>
                  <th>Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 30).map(({ index, row }) => (
                  <tr key={index}>
                    <td>{index}</td>
                    <td>
                      <strong>{row.variantName}</strong>
                      <div className="muted-small">{row.productName}</div>
                    </td>
                    <td>{row.sku}</td>
                    <td>{row.brandName}</td>
                    <td>{row.retailPrice}</td>
                    <td>{row.openingStock || "0"} {row.warehouseName || "Main Shop"}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={6}>No rows to preview.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <h3>Result</h3>
            <span className="badge">After Import</span>
          </div>

          {!result ? (
            <p className="placeholder">Import ke baad created/skipped/error rows yahan show hongi.</p>
          ) : (
            <>
              <h4>Created</h4>
              <ul className="result-list">
                {result.created.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.sku}`}>Row {item.row}: {item.sku} — {item.name}</li>
                ))}
              </ul>

              <h4>Skipped</h4>
              <ul className="result-list">
                {result.skipped.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.sku}`}>Row {item.row}: {item.sku} — {item.reason}</li>
                ))}
              </ul>

              <h4>Errors</h4>
              <ul className="result-list error-list">
                {result.errors.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.sku}`}>Row {item.row}: {item.sku} — {item.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
