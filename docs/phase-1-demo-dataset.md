# Faza 1 - Demo dataset per testim end-to-end

Data: 2026-04-28  
Branch: `codex/integrim-erp-suite`

Ky dataset sherben per testimin real te rrjedhave:

- Agent Order -> WMS -> Sales Invoice
- WMS scan me barcode/lokacion/serial
- Stok dhe WMS balances
- Finance accounts dhe balanca hapese
- Customer objects per agjentet

## Kredencialet seed

Te gjithe user-at seed perdorin password:

`Admin123!`

User-at:

- `admin@erp.local`
- `manager@erp.local`
- `sales@erp.local`
- `purchase@erp.local`
- `picker@erp.local`

## Te dhenat qe krijohen

### Kliente dhe objekte

- `CUS-001` - Kompania ABC Shpk
  - `ABC-PR-01` - ABC Qendra
  - `ABC-WH-01` - ABC Depo
- `CUS-002` - Biznesi XYZ
  - `XYZ-FZ-01` - XYZ Market Ferizaj
- `CUS-003` - Retail Test Customer
  - `RTL-PR-01` - Retail POS Counter

### Furnitore

- `SUP-001` - Tech Distributors Shpk
- `SUP-002` - Office Wholesale LLC

### Artikuj

- `LAPTOP-001`, barcode `383000000001`, serial tracked demo
- `MONITOR-001`, barcode `383000000002`
- `MOUSE-001`, barcode `383000000003`
- `KEYBOARD-001`, barcode `383000000004`
- `USB-CABLE-001`, barcode `383000000005`
- `COFFEE-001`, barcode `383000000006`, lot/expiry tracked
- `SUGAR-001`, barcode `383000000007`, lot tracked
- `CONSULT-001`, sherbim pa levizje stoku

### Depo dhe WMS lokacione

- `MAIN` - Main Warehouse
- `SECONDARY` - Secondary Warehouse

Lokacionet kryesore WMS:

- `MAIN-REC-01`, barcode `LOC-MAIN-REC-01`
- `MAIN-A01-R01-S01-B01`, barcode `LOC-MAIN-A01-R01-S01-B01`
- `MAIN-A01-R01-S01-B02`, barcode `LOC-MAIN-A01-R01-S01-B02`
- `MAIN-PACK-01`, barcode `LOC-MAIN-PACK-01`
- `MAIN-SHIP-01`, barcode `LOC-MAIN-SHIP-01`
- `MAIN-RET-01`, barcode `LOC-MAIN-RET-01`
- `MAIN-QC-01`, barcode `LOC-MAIN-QC-01`
- `MAIN-DMG-01`, barcode `LOC-MAIN-DMG-01`
- `SEC-A01-R01-S01-B01`, barcode `LOC-SEC-A01-R01-S01-B01`

### WMS stock

Dataset-i krijon stok fizik ne WMS:

- Laptop me serial numbers:
  - `LP15-2026-0001`
  - `LP15-2026-0002`
  - `LP15-2026-0003`
  - `LP15-2026-0004`
  - `LP15-2026-0005`
- Coffee me lote:
  - `LOT-COF-2026-01`
  - `LOT-COF-2026-02`
- Sugar me lot:
  - `LOT-SUG-2026-01`

### WMS tasks

Krijohen 2 task demo:

- `SEED-COUNT-MONITOR`
- `SEED-PUTAWAY-COFFEE`

### Agent order demo

Krijohet nje order demo:

- `AO-DEMO-0001`
- Status: `SUBMITTED`
- Klient: `CUS-001`
- Objekt: `ABC-PR-01`
- Artikuj: `MONITOR-001` dhe `MOUSE-001`

Ky order eshte gati per fazen 2, ku do ta lidhim/praktikojme rrjedhen:

`Agent Order -> assign picker -> WMS picking -> create invoice -> posting`

## Si ta ekzekutosh seed-in

Nese databaza eshte ne Docker dhe porta `5432` eshte e ekspozuar lokalisht:

```powershell
cd "C:\Users\CheBardh\Desktop\erp-suite - codex\erp-suite - codex\backend"
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/erpdb?schema=public'
npm run prisma:seed
```

Nese do ta besh plotesisht nga Docker image:

```powershell
cd "C:\Users\CheBardh\Desktop\erp-suite - codex\erp-suite - codex"
docker compose build backend
docker compose run --rm backend npm run prisma:seed
docker compose up -d backend frontend
```

Seed-i eshte idempotent: mund te ekzekutohet disa here dhe nuk duhet te krijoje dublikat per rekordet demo.

## Smoke checks qe u verifikuan

Pas seed-it u verifikuan:

- Login: `admin@erp.local / Admin123!`
- Kliente: `3`
- Furnitore: `2`
- Artikuj: `8`
- Depo: `2`
- Finance accounts: `3`
- WMS lokacione: `9`
- WMS balance rows: `12`
- WMS tasks: `2`
- Agent orders: `1`
- Customer objects: `4`
- Scan item barcode: `383000000002`
- Scan location barcode: `LOC-MAIN-A01-R01-S01-B02`
- Scan serial: `LP15-2026-0001`
