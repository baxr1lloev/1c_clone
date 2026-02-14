# User Guide — 1C-Style Accounting & Warehouse

This guide explains how to use the application from login to daily operations and reports.

---

## 1. Getting Started

### 1.1 Log in
- Open the application in your browser.
- Log in with your **email** and **password**.
- Your user must be linked to a **tenant** (company). If you see errors about "no tenant", ask an administrator to assign your user to a company.

### 1.2 Dashboard (Getting Started)
- After login you see the **main dashboard**.
- Use the **sidebar** to open: Sales, Purchases, Warehouse, Bank and Cash, Operations, Reports, Directories, Administration.

### 1.3 First-time setup (recommended order)
1. **Currencies** — Directories → Currencies. Add base currency and others; set exchange rates if needed.
2. **Warehouses** — Warehouse → Warehouses. Create at least one warehouse (e.g. "Main Warehouse").
3. **Nomenclature (items)** — Sales → Nomenclature (Items) or Warehouse → Nomenclature.
   - Add categories (e.g. "Goods", "Services") with **New** / **Subcategory**.
   - Add products: **New Item** (opens item form: name, SKU, type, unit, prices, category). Or click **Create sample items** to add demo products.
4. **Counterparties** — Sales → Counterparties (or Purchases). Add customers and suppliers (name, INN, type).
5. **Contracts** — Sales → Contracts. For each counterparty you use in sales/purchases, create a contract (number, date, currency, type: Sales/Purchase).
6. **Bank accounts** (optional) — For payments and bank statements. Directories or Bank section, depending on menu.

After this you can create **Sales (Realization)**, **Purchases**, **Transfers**, and use **Reports**.

---

## 2. Sales (Продажи)

### 2.1 Sales (Realization) — Реализации
- **Sales → Sales (Realization)**.
- **Create** a new document: choose counterparty, contract, warehouse, currency, date.
- **Lines**: click the **Item** cell and select a product from your **nomenclature** (the list is loaded from Warehouse → Nomenclature). Enter quantity and price; amount is calculated.
- **Save** (draft). When ready, **Post** the document. Posting writes stock movements and accounting entries.
- If the item list is empty: go to **Nomenclature (Items)** and add items or click **Create sample items**.

### 2.2 Sales Orders
- **Sales → Sales Orders**. Create orders (draft → post to reserve stock). You can later create a Sales (Realization) document from an order.

### 2.3 Counterparties and Contracts
- **Sales → Counterparties** — add/edit customers and suppliers.
- **Sales → Contracts** — manage contracts per counterparty (needed for sales and purchase documents).

### 2.4 Nomenclature (Items)
- **Sales → Nomenclature (Items)** (or Warehouse → Nomenclature).
- **Categories**: **New** (root category), **Subcategory** (under selected category).
- **New Item** — create product or service (name, SKU, type, unit, purchase/selling price, category).
- **Create sample items** — adds demo products so you can immediately use them in Sales/Purchases.

---

## 3. Purchases (Закупки)

- **Purchases → Purchases (Receipts)**.
- Create a document: counterparty (supplier), contract, warehouse, currency, date.
- **Lines**: select **Item** from nomenclature, enter quantity and price. Post when ready.
- Counterparties and contracts are shared with Sales; create them once and use in both.

---

## 4. Warehouse (Склад)

### 4.1 Stock balance
- **Warehouse → Stock Balance** (or Reports → Stock Balance). View current stock by item and warehouse.

### 4.2 Transfers
- **Warehouse → Transfers**. Create transfer documents between warehouses (item, quantity, from/to warehouse). Post to move stock.

### 4.3 Inventories
- **Warehouse → Inventories**. Create inventory (stock-taking) documents; post to adjust balances.

### 4.4 Nomenclature and Warehouses
- **Warehouse → Nomenclature** — same as Sales → Nomenclature (items and categories).
- **Warehouse → Warehouses** — create and edit warehouses.

---

## 5. Bank and Cash

- **Bank Statements** — upload or enter bank statements; link to bank account.
- **Cash Orders** — cash in/out documents.
- **Payments** — payment documents (to suppliers, from customers). Select counterparty, contract, amount, currency; post.

---

## 6. Operations (Операции)

- **Journal Entries** — manual accounting entries (debit/credit accounts, amount). Used for adjustments and non-document operations.
- **Period Closing** — close a period (month): run closing tasks (e.g. depreciation, VAT, P&L). Only closed periods are locked for posting.

---

## 7. Reports (Отчеты)

- **Trial Balance** — оборотно-сальдовая ведомость by account.
- **Profit & Loss** — income statement.
- **Stock Balance / Stock report** — stock levels and movements.
- Other reports (settlements, reconciliation, etc.) from the Reports section.

---

## 8. Directories (Справочники)

- **Contracts** — all contracts (same as under Sales).
- **Currencies** — list and exchange rates.
- **All Directories** — hub to all reference data.

---

## 9. Administration

- **Users** — manage users and roles (admin).
- **Settings** — application settings.
- **All Functions** — system functions (if available).

---

## 10. Typical Workflows

### Sell goods (full flow)
1. Nomenclature: ensure items exist (or **Create sample items**).
2. Counterparties: add customer.
3. Contracts: add contract for that customer (type Sales).
4. Sales → Sales (Realization): new document, select customer, contract, warehouse, add lines (item, qty, price), Save, Post.

### Buy goods
1. Counterparties: add supplier.
2. Contracts: add contract (type Purchase).
3. Purchases → Purchases (Receipts): new document, select supplier, contract, warehouse, add lines, Post.

### Move stock
1. Warehouses: ensure at least two warehouses.
2. Warehouse → Transfers: new document, from/to warehouse, add lines (item, quantity), Post.

---

## 11. Clean Data (Keep Only Users)

To remove all business data but **keep users and tenants** (e.g. after testing or to start fresh), run from the project root:

```bash
python manage.py clean_data
```

You will be asked to type `yes` to confirm. To skip confirmation (e.g. in scripts), use:

```bash
python manage.py clean_data --no-input
```

This deletes:
- All documents (sales, purchases, transfers, inventory, orders, payments, bank statements, cash orders, production, opening balances, etc.) and their lines
- All register data (stock balances, movements, settlements, reservations, batches, goods in transit)
- All directory data: items, categories, counterparties, contracts, warehouses, bank accounts, employees, departments, projects, exchange rates
- Accounting entries, period-closing records, trial balance snapshots, and operations
- Fixed assets and intangible assets data (if the module is installed)

**Kept:**
- Users and authentication
- Tenants (companies)
- Chart of Accounts (so you don’t have to reconfigure accounts)
- Currencies (global list)

After running `clean_data`, run **Create sample items** from Nomenclature or run `python manage.py seed_sample_items` to quickly get items again, then follow the first-time setup above.
