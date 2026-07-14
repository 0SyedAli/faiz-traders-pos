"use client";

import { FormEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DashboardLayout } from "@/components/DashboardLayout";
import { api } from "@/lib/api";

const template = `categoryName,productName,brandName,size,gauge,lengthFeet,purchasePrice,retailPrice,wholesalePrice,distributorPrice,stock,minimumStock,warehouseName,description
GI Fitting,Elbow,,1,,0,120,160,150,145,100,20,Main Shop,Iron elbow 1 inch
UPVC Pipe,UPVC Pipe,Master,2,SCH40,20,900,1200,1150,1100,50,5,Main Shop,Master UPVC pipe
PPR Fitting,Elbow,Popular,25mm,,0,80,120,110,105,200,25,Main Shop,PPR elbow 25mm
Muslim Shower,Muslim Shower,Sonex,,,0,350,500,475,450,30,5,Main Shop,Muslim shower`;

type ImportResult = {
  created: { row: number; sku: string; name: string }[];
  skipped: { row: number; sku: string; reason: string }[];
  errors: { row: number; sku: string; message: string }[];
  totalRows: number;
};

const parseBool = (value: any) => ["true", "yes", "1", "y"].includes(String(value || "").trim().toLowerCase());
const parseNum = (value: any) => Number(String(value || "0").trim() || 0);

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
  "categoryName",
  "productName",
  "purchasePrice",
  "retailPrice"
];

const normalizeHeader = (value: any) => String(value || "").trim();

const rowsToCsv = (rows: Record<string, any>[]) => {
  if (!rows.length) return template;
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
};

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

  const handleFileUpload = async (file?: File | null) => {
    if (!file) return;

    setError("");
    setResult(null);

    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "xlsx" || ext === "xls") {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames.includes("Products")
          ? "Products"
          : workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: "",
          raw: false as any
        } as any);

        if (!jsonRows.length) throw new Error("Excel sheet empty hai.");

        const normalizedRows = jsonRows.map((row) => {
          const next: Record<string, any> = {};
          Object.entries(row).forEach(([key, value]) => {
            next[normalizeHeader(key)] = value;
          });
          return next;
        });

        setCsv(rowsToCsv(normalizedRows));
      } else {
        const text = await file.text();
        setCsv(text);
      }
    } catch (err: any) {
      setError(err.message || "File read failed.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setSaving(true);

    try {
      const lines = csv.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length <= 1) throw new Error("CSV/Excel me header aur kam az kam 1 product row honi chahiye.");

      const headers = parseCsvLine(lines[0]).map((h) => h.trim());
      const missing = requiredHeaders.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

      const duplicateSku = new Map<string, number>();
      const duplicateCombo = new Map<string, number>();

      const items = lines.slice(1).map((line, rowIndex) => {
        const cols = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
          row[header] = cols[i] || "";
        });

        const rowNo = rowIndex + 2;
        const skuKey = String(row.sku || "").trim().toUpperCase();
        const comboKey = [row.productName, row.brandName, row.categoryName, row.size || row.sizeName, row.gauge, row.lengthFeet]
          .map((x) => String(x || "").trim().toLowerCase()).join("|");

        if (skuKey) {
          if (duplicateSku.has(skuKey)) {
            throw new Error(`Duplicate upload row: SKU "${row.sku}" row ${rowNo} me duplicate hai. Pehle row ${duplicateSku.get(skuKey)} me aa chuka hai.`);
          }
          duplicateSku.set(skuKey, rowNo);
        }

        if (duplicateCombo.has(comboKey)) {
          throw new Error(`Duplicate upload row: same product/category/brand/size/gauge row ${rowNo} me duplicate hai. Pehle row ${duplicateCombo.get(comboKey)} me aa chuka hai.`);
        }
        duplicateCombo.set(comboKey, rowNo);

        return {
          categoryName: row.categoryName,
          productName: row.productName,
          brandName: row.brandName,
          size: row.size || row.sizeName,
          gauge: row.gauge,
          lengthFeet: parseNum(row.lengthFeet),
          sku: row.sku,
          purchasePrice: parseNum(row.purchasePrice),
          retailPrice: parseNum(row.retailPrice),
          wholesalePrice: parseNum(row.wholesalePrice),
          distributorPrice: parseNum(row.distributorPrice),
          stock: parseNum(row.stock || row.openingStock),
          minimumStock: parseNum(row.minimumStock || row.lowStockAlertQty || "5"),
          warehouseName: row.warehouseName || "Main Shop",
          description: row.description || ""
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
          <p>Excel .xlsx ya CSV file upload karo. Gauge/thickness bhi supported hai.</p>
        </div>
        <a className="btn btn-light" href="/templates/product-import-template.xlsx" download>
          Download Template
        </a>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      {result ? (
        <div className="notice success">
          Import done: {result.created.length} created, {result.skipped.length} skipped, {result.errors.length} errors.
        </div>
      ) : null}

      <div className="card">
        <div className="section-title">
          <h3>Upload Excel / CSV</h3>
          <button className="small-btn" type="button" onClick={() => setCsv(template)}>
            Load Sample
          </button>
        </div>

        <div className="upload-box">
          <input
            className="input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
          />
          <p>
            Client se Excel sheet lo, yahan upload karo, preview check karo, phir import.
            Duplicate same Product + Category + Brand + Size + Gauge ko system reject karega. SKU optional hai.
          </p>
        </div>

        <form onSubmit={submit}>
          <textarea
            className="input csv-textarea"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            spellCheck={false}
          />

          <div className="bulk-help">
            <strong>Required columns:</strong> categoryName, productName, purchasePrice, retailPrice
            <br />
            <strong>Gauge example:</strong> UPVC Pipe ke liye size = 2 aur gauge = SCH40. GI Fitting me brand/gauge/length blank rakho.
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
                  <th>Size/Gauge</th>
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
                    <td>{row.sizeName || "-"} / {row.gauge || "-"}</td>
                    <td>{row.retailPrice}</td>
                    <td>{row.openingStock || "0"} {row.warehouseName || "Main Shop"}</td>
                  </tr>
                ))}
                {rows.length === 0 ? <tr><td colSpan={7}>No rows to preview.</td></tr> : null}
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
                {result.created.slice(0, 30).map((item) => (
                  <li key={`${item.row}-${item.sku}`}>Row {item.row}: {item.sku} — {item.name}</li>
                ))}
              </ul>

              <h4>Skipped</h4>
              <ul className="result-list">
                {result.skipped.slice(0, 30).map((item) => (
                  <li key={`${item.row}-${item.sku}`}>Row {item.row}: {item.sku} — {item.reason}</li>
                ))}
              </ul>

              <h4>Errors</h4>
              <ul className="result-list error-list">
                {result.errors.slice(0, 50).map((item) => (
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
