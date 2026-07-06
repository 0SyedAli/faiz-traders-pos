# My Store POS + Mini ERP

Admin-only POS + mini ERP starter code for sanitary business.

## Includes

```txt
backend/  Node.js + Express + TypeScript + MongoDB + Mongoose
frontend/ Next.js dashboard skeleton
```

## First Run

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

Backend runs on:

```txt
http://localhost:5001
```

### 2. Frontend

Open new terminal:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend runs on:

```txt
http://localhost:3000
```

## Default Admin

```txt
Email: admin@mystore.com
Password: admin123456
```

## Business Defaults Included

```txt
Brands: Steelex, Pak Arab, Aerofit, Other
Sizes: 1/2, 3/4, 1, 1.25, 1.5, 2, 3, 4, 5, 6
Warehouses: Main Shop, Godown 1
Units: Piece, Box, Dozen, Feet, Meter, Bundle, Carton, Set, Length
Expense Categories: Rent, Electricity, Salary, Transport, Loading / Unloading, Repairs, Tea / Food, Internet, Miscellaneous
Default Customer: Walk-in Customer
```

## Current Build Status

Done:

```txt
Admin login backend
Default seed data
Master data APIs
Product and variant models/APIs
Warehouse-wise stock
Manual stock adjustment
Stock movements
Customer/plumber khata model
Customer payment API
Expense APIs
Dashboard stats API
Next.js dashboard skeleton
```

Next:

```txt
Complete product UI form
Inventory UI
POS cart API + UI
Purchase API
Plumber khata sale flow
Sales return flow
PDF invoice
Reports
```


## Update v2

Products UI completed:

```txt
Create/edit/delete product
Create/edit/delete product variant
Search variants by name/SKU/barcode/brand/size/category
Pipe 20ft preset
Fitting preset
Retail, wholesale, plumber, dealer price fields
Size, brand, category, unit dropdowns
```

Backend product APIs completed:

```txt
GET/POST/PUT/DELETE /api/products
GET/POST/PUT/DELETE /api/products/variants
```


## Update v3

Inventory + godown system completed:

```txt
Opening stock / exact stock adjustment
Warehouse-wise stock list
Search stock by item/SKU/brand/size/warehouse
Low stock and out of stock indicators
Inventory valuation by purchase and retail value
Godown to shop stock transfer
Multi-item stock transfer
Recent transfer history
Stock movement history with filters
```

Backend added:

```txt
StockTransfer model
POST /api/inventory/transfer
GET  /api/inventory/transfers
GET  /api/inventory/valuation
```

Note: Inventory transfer API is local MongoDB friendly and does not require a replica set transaction setup.
