# ERP Suite - Audit sistemi dhe udhezues funksional

Data e auditimit: 2026-04-28  
Branch: `codex/integrim-erp-suite`  
Commit baze i auditimit: `d7f690e chore: simplify agent orders navigation`

Ky dokument permbledh gjendjen funksionale te sistemit ERP pas bashkimit te branch-eve, pas shtimit te WMS dhe pas shtimit te modulit te Agent Orders. Qellimi eshte te tregoje:

- cfare komponentesh ekzistojne;
- si lidhen departamentet me njera-tjetren;
- cfare u verifikua me teste;
- cfare mungon per secilin departament;
- si perdoret secili funksion kryesor.

## 1. Rezultati i verifikimit teknik

### 1.1 Docker

Statusi i sherbimeve ne Docker ishte funksional:

- `erp-suite-codex-db-1`: PostgreSQL, healthy, port `5432`
- `erp-suite-codex-backend-1`: API backend, healthy, port `3000`
- `erp-suite-codex-frontend-1`: Next.js frontend, port `3001`

Shenim: me heret kishte konflikt ne portin `5432`, por pas ndaljes/rinisjes se stack-ut projekti eshte ngritur.

### 1.2 Testet backend

U ekzekutuan testet lokale backend:

- Komanda: `npm test -- --runInBand`
- Rezultati: `13 test suites passed`, `56 tests passed`

Para testimit u desh `npx prisma generate`, sepse klienti lokal i Prisma ishte i vjeter pas migrimeve te reja.

### 1.3 Typecheck frontend

U ekzekutua verifikimi i TypeScript ne frontend:

- Komanda: `npm run typecheck`
- Rezultati: kaloi pa gabime.

### 1.4 Smoke test API

U testuan endpoint-et kryesore me JWT te perkohshem, pa ndryshuar databazen. Login me kredencialet seed nuk funksionoi ne databazen aktuale, prandaj per auditim read-only u perdor token testues me sekretin lokal nga `.env`.

Endpoint-et kryesore qe kthyen rezultat korrekt:

- `/auth/me`
- `/dashboard/summary`
- `/customers`
- `/suppliers`
- `/items`
- `/warehouses`
- `/document-series`
- `/sales-invoices`
- `/sales-returns`
- `/purchase-invoices`
- `/stock/balance`
- `/stock/movements`
- `/wms/locations`
- `/wms/balances`
- `/wms/tasks`
- `/agent-orders`
- `/agent-orders/customer-objects`
- `/agent-orders/return-sources`
- `/finance-accounts`
- `/finance-accounts/transactions`
- `/accounting/accounts`
- `/accounting/trial-balance`
- `/financial-periods`
- `/reports/sales-summary`
- `/reports/receivables-aging`
- `/reports/payables-aging`
- `/reports/bank-reconciliation`
- `/statements/customers`
- `/control-tower/pulse`
- `/approvals/dashboard`

### 1.5 Smoke test frontend

U testuan faqet kryesore ne frontend dhe faqet u ngarkuan me status `200`:

- `/dashboard`
- `/shitja`
- `/agjenti/orders`
- `/agjenti/orders/new`
- `/agjenti/objects`
- `/sales-invoices`
- `/sales-invoices/new`
- `/sales-returns`
- `/sales-returns/new`
- `/blerja`
- `/purchase-invoices`
- `/purchase-invoices/new`
- `/stoku`
- `/items`
- `/warehouses`
- `/stock/balances`
- `/stock/movements`
- `/stock/operations`
- `/wms`
- `/wms/locations`
- `/wms/balances`
- `/wms/tasks`
- `/wms/picking`
- `/wms/packing`
- `/wms/scanner`
- `/financa`
- `/financa/llogarite`
- `/financa/periudhat`
- `/financa/libri-kontabel`
- `/financa/tvsh`
- `/raportet`
- `/raportet/shitje`
- `/raportet/financa`
- `/raportet/kontabiliteti`
- `/raportet/stoku`
- `/approvals/dashboard`
- `/control-tower/pulse`
- `/audit-logs`

### 1.6 Kufizimi i auditimit

Databaza aktuale ka pak te dhena operative:

- `customers`: 0
- `suppliers`: 0
- `items`: 0
- `sales invoices`: 0
- `purchase invoices`: 0
- `stock/WMS`: 0
- `finance accounts`: 0

Ekzistojne disa konfigurime baze:

- `warehouses`: 1
- `document series`: 5
- `financial periods`: 12
- `accounting accounts`: ekzistojne disa llogari

Per kete arsye, auditimi i lidhjeve u krye kryesisht me smoke tests, lexim kodi dhe verifikim te faqeve. Per testim te plote end-to-end ne prodhim/test duhet te krijohet dataset testues me kliente, furnitore, artikuj, cmime, lokacione WMS, finance accounts dhe stok fillestar.

## 2. Gjetjet kryesore

### 2.1 Gjendja e pergjithshme

Sistemi eshte i lidhur mire ne nivel strukturor: backend, frontend, Prisma schema, migrimet, Docker build dhe typecheck jane ne gjendje funksionale. Modulet kryesore jane tashme te ndara ne faqe me te lexueshme dhe ka ndarje te qarte per Shitje, Blerje, Finance, Stok, WMS, Agjent, Approvals dhe Reports.

### 2.2 Rreziku kryesor funksional

Rrjedha POS / Shitje e shpejte ka konflikt me WMS-in e ri.

Frontend POS krijon fature shitese dhe e poston menjehere. Backend tani kerkon qe fatura te jete e gatshme ne WMS para postimit: picking dhe packing duhet te jene te perfunduara. Kjo eshte logjike e mire per kontroll magazine, por POS duhet te ndryshohet ne njeren nga keto menyra:

- POS krijon vetem draft dhe e dergon ne WMS per picking/packing;
- POS ka modalitet "cash-and-carry" qe ben auto-pick/auto-pack kur stoku eshte ne lokacion valid;
- POS e ndan procesin ne: order -> picking -> packing -> invoice posting.

Ky duhet trajtuar si prioritet i larte para perdorimit real te POS.

### 2.3 Rreziku kryesor teknik/security

`JWT_SECRET` ne `.env` lokal eshte vlera default:

`change-this-to-a-long-random-secret-in-production`

Per prodhim duhet te zevendesohet patjeter me sekret te gjate, random dhe unik. Nese perdoret vlera default, token-at mund te falsifikohen.

### 2.4 Mangesia kryesore e te dhenave

Sistemi ka strukture te mire, por databaza aktuale nuk ka master data per testim real. Duhet krijuar seed/test dataset:

- kliente;
- furnitore;
- artikuj;
- kategori/njesi/taksa;
- barcode dhe kode interne;
- finance accounts;
- lokacione WMS;
- stok fillestar me lot/expiry/serial kur aplikohet.

## 3. Harta e departamenteve dhe moduleve

### 3.1 Administrim, perdorues dhe siguri

Qellimi: kontrollon hyrjen ne sistem, rolet, auditimin dhe konfigurimin baze te kompanise.

Komponente kryesore:

- Auth: login, logout, session, `/auth/me`
- Users: menaxhim i perdoruesve
- Roles/Permissions: role dhe autorizime
- Audit Logs: gjurme te veprimeve kritike
- Company Profile: te dhenat e kompanise
- Middleware frontend: ruan hyrjen dhe mbron faqet private

Si perdoret:

1. Admin krijon/menaxhon perdoruesit.
2. Secilit perdorues i jepet rol.
3. Roli kontrollon qasjen ne faqe dhe endpoint-e.
4. Veprimet e rendesishme ruhen ne audit logs.

Cfare funksionon:

- API dhe faqet baze per administrim ngarkohen.
- Middleware mbron faqet e aplikacionit.
- Guard-at backend jane te lidhur me permissions.

Cfare mungon ose duhet forcuar:

- Password reset.
- 2FA/MFA per admin dhe finance.
- Ndryshim i detyrueshem i password-it fillestar.
- Sekret JWT real per prodhim.
- UI me e plote per matricen e permissions nese do te menaxhohet nga biznesi.

### 3.2 Master Data

Qellimi: mban te dhenat baze qe perdoren nga cdo modul operativ.

Komponente:

- Customers
- Suppliers
- Items
- Item Categories
- Units
- Tax Rates
- Warehouses
- Payment Methods
- Document Series
- Customer Objects per agjentet

Si perdoret:

1. Krijohen njesite, kategorite dhe tax rates.
2. Krijohen artikujt me kode interne dhe barkode.
3. Krijohen depot dhe, per WMS, lokacionet e detajuara.
4. Krijohen kliente/furnitore.
5. Krijohen document series per faturat, kthimet, pagesat dhe dokumentet tjera.

Cfare lidhet me cfare:

- Artikujt perdoren ne shitje, blerje, stok dhe WMS.
- Klientet perdoren ne shitje, agjent, statements dhe risk.
- Furnitoret perdoren ne blerje, pagesa, statements dhe supplier risk.
- Warehouses lidhen me stock balances, WMS locations dhe dokumentet operative.

Cfare mungon ose duhet shtuar:

- Import/export masiv per artikuj, kliente dhe furnitore.
- Printim etiketash barcode.
- Politika artikulli per lot/expiry/serial: p.sh. a kerkon serial number, a kerkon expiry date.
- Customer Object edit/detail page me e plote per historik vizitash dhe koordinata.
- Validime me te forta per duplikime te kodeve interne dhe barkodeve.

### 3.3 Shitje

Qellimi: krijon dokumente shitjeje, faturon klientin, leviz stokun dhe krijon efekt financiar/kontabel.

Komponente:

- Sales Invoices
- Sales Returns
- POS / Shitje e shpejte
- Customer payments
- Customer statements
- Customer risk
- Agent Orders
- Approval gates per kredit/limite

Rrjedha normale:

1. Zgjidhet klienti.
2. Shtohen artikujt dhe sasite.
3. Fatura ruhet si draft.
4. WMS pergatit picking dhe packing nese kerkohet nga stoku.
5. Fatura postohet.
6. Sistemi krijon levizje stoku, kontabilitet dhe borxh ne kartelen e klientit.
7. Pagesa regjistrohet dhe e mbyll pjeserisht ose plotesisht obligimin.

Per cfare perdoret:

- Faturim i shitjes.
- Kontroll i stokut para postimit.
- Krijim i efektit financiar.
- Ndjekje e borxhit te klientit.
- Kthime shitjeje dhe korrigjime.

Cfare funksionon:

- Faqet e shitjes dhe kthimeve ngarkohen.
- Backend ka lidhje me accounting, stock, WMS dhe approvals.
- Sales invoice post kontrollon gjendjen WMS para postimit.
- Sales return ka efekt ne stok dhe finance.

Cfare mungon ose duhet kompletuar:

- POS duhet pershtatur me WMS, sepse nuk mund te postoje menjehere pa picking/packing.
- Duhet flow i qarte per partial delivery dhe backorder.
- Duhet quotation/order/reservation me e plote per shitje para fatures.
- Duhet price list, zbritje, promocione dhe cmime per klient/grup klientesh.
- Duhet reversal/storno me kontroll te plote per dokumentet e postuara.
- Duhet delivery note / shipment document nese biznesi e kerkon ndarje nga fatura.

### 3.4 Agjenti i shitjes

Qellimi: agjenti ne terren regjistron porosi ose kthim nga klienti dhe objekti, pastaj magazina e merr ne pune per picking/return receiving, dhe ne fund krijohet dokumenti financiar.

Komponente:

- Agent Orders list
- New Agent Order
- Customer Objects
- Order type:
  - shitje/order normal;
  - purchase order logjik nga agjenti nese perdoret si kerkese furnizimi;
  - return order;
  - return pa reference/pa afat;
  - order tjeter i konfiguruar sipas procesit.
- Assignment i picker-it
- Lidhje me WMS task
- Konvertim ne fature ose kthim

Rrjedha e rekomanduar:

1. Agjenti zgjedh klientin dhe objektin.
2. Agjenti zgjedh llojin e porosise.
3. Shton artikujt, sasite, lot/serial nese kthimi e kerkon.
4. Porosia ruhet/submetohet.
5. Backoffice ose magazina cakton picker.
6. Picker kryen picking ose return receiving.
7. Pas perfundimit, sistemi krijon fature shitese ose dokument kthimi.
8. Dokumenti postohet dhe jep efekt ne stok, WMS, finance dhe kartelen e klientit.

Cfare funksionon:

- Moduli i agjentit u shtua me navigim te thjeshtuar.
- Faqet `/agjenti/orders`, `/agjenti/orders/new` dhe `/agjenti/objects` ngarkohen.
- Backend endpoint-et per agent orders dhe customer objects pergjigjen.

Cfare mungon ose duhet forcuar:

- Aplikacion/UX mobile per agjente.
- Offline mode per terren.
- Line-level picking quantities dhe short pick.
- Rregulla automatike per konvertim ne fature/kthim.
- Workflow i plote per kthim fizik: pranim, kontroll cilesie, vendosje ne lokacion, bllokim ose lirimi per shitje.
- Njoftime per magazinen kur vjen order i ri nga agjenti.

### 3.5 Blerje

Qellimi: regjistron blerjet nga furnitoret, rrit stokun dhe krijon obligim financiar.

Komponente:

- Purchase Invoices
- Supplier payments
- Supplier statements
- Supplier risk
- Finance documents per pagesa

Rrjedha normale:

1. Zgjidhet furnitori.
2. Shtohen artikujt dhe sasite.
3. Fatura ruhet si draft.
4. Fatura postohet.
5. Sistemi rrit stokun dhe regjistron obligimin ndaj furnitorit.
6. Pagesa regjistrohet nga finance account dhe lidhet me furnitorin.

Per cfare perdoret:

- Hyrje malli ne stok.
- Regjistrim i obligimeve ndaj furnitoreve.
- Ndjekje e borxheve dhe pagesave.

Cfare funksionon:

- Faqet e blerjes ngarkohen.
- Endpoint-et per purchase invoices pergjigjen.
- Logjika baze lidhet me stok dhe accounting.

Cfare mungon ose duhet kompletuar:

- Purchase Order i plote.
- Goods Receipt Note / pranimi ne magazine para fatures.
- Integrim direkt i pranimit me WMS receiving dhe putaway.
- Supplier returns.
- Landed cost: transport, dogane, shpenzime tjera te ndara ne kosto artikulli.
- Three-way matching: PO -> GRN -> Invoice.
- Approval per blerje me vlere te larte.

### 3.6 Stok

Qellimi: mban gjendjen sasiore dhe levizjet e artikujve ne depo.

Komponente:

- Stock balances
- Stock movements
- Stock adjustments
- Stock transfers
- Stock counts
- Warehouse management baze

Si perdoret:

1. Stoku rritet nga purchase invoice, adjustment pozitiv ose return.
2. Stoku ulet nga sales invoice, adjustment negativ ose transfer.
3. Transferi leviz stokun ndermjet depove.
4. Count korrigjon gjendjen sipas inventarizimit fizik.
5. Movements sherbejne si histori per auditim te stokut.

Cfare lidhet me cfare:

- Sales invoices ulin stokun.
- Sales returns rrisin stokun.
- Purchase invoices rrisin stokun.
- WMS balances japin detaj lokacioni/lot/serial.
- Accounting merr vlera per kosto dhe inventar.

Cfare funksionon:

- Faqet e stock balances, movements dhe operations ngarkohen.
- Endpoint-et kryesore per stock pergjigjen.
- Ka operacione per adjustment, transfer dhe count.

Cfare mungon ose duhet forcuar:

- Raport i vleresimit te stokut sipas dates.
- Rezervime te stokut jashte WMS.
- Multi-UOM conversions.
- Rregulla te qarta per artikuj me serial: nuk duhet te shitet dy here i njejti serial.
- Rregulla per bllokim te stokut te skaduar, te demtuar ose ne karantine.

### 3.7 WMS

Qellimi: menaxhon vendndodhjen fizike te stokut ne magazine dhe kontrollon picking, packing, receiving, moving, counting dhe bllokimin e stokut.

Komponente:

- WMS Locations
- WMS Balances
- WMS Tasks
- Picking
- Packing
- Scanner
- Receive
- Putaway
- Move
- Replenishment
- Cycle Count
- Quality/blocked stock
- Expiry/lot/serial tracking

Struktura e lokacionit:

- Zone
- Aisle
- Rack
- Shelf
- Bin

Cdo lokacion mund te kete kod dhe barcode. Kjo e ben te mundur skanimin fizik te lokacionit.

Si perdoret:

1. Krijohen lokacionet WMS per secilen depo.
2. Malli pranohet ne receiving location.
3. Putaway e vendos mallin ne bin.
4. Picking merr mallin nga lokacioni.
5. Packing konfirmon qe mallrat jane te pergatitura per dalje.
6. Vetem pastaj dokumenti i shitjes duhet te postohet.
7. Stoku me lot/expiry/serial kontrollohet ne nivel WMS balance.

Per cfare perdoret:

- Te dihet sakte ku ndodhet malli.
- Te parandalohet shitja nga lokacion i gabuar.
- Te bllokohet malli i skaduar ose i demtuar.
- Te kontrollohen lotet dhe serial numbers.
- Te mbeshtetet puna e picker-it me detyra te qarta.

Cfare funksionon:

- Faqet WMS ngarkohen.
- Endpoint-et per locations, balances dhe tasks pergjigjen.
- Backend kontrollon invoice posting me WMS readiness.
- WMS ka logjike per lot, expiry, serial dhe stock status.

Cfare mungon ose duhet kompletuar:

- Directed putaway me algoritme: lokacion optimal sipas zone, kapacitetit, artikullit.
- Wave picking dhe batch picking.
- Short pick / partial pick.
- Mobile scanner UX me butona te medhenj dhe fokus ne barkod.
- Printim etikete per lokacion, artikull, palete dhe dokument.
- Receiving i lidhur me Purchase Order/GRN.
- Return receiving i lidhur me Sales Return/Agent Return.
- Quality control workflow per mall te kthyer.
- Cycle count approval dhe variance posting me aprovime.
- FEFO/FIFO rules te ekspozuara qarte ne UI.

### 3.8 Finance

Qellimi: menaxhon arkat/bankat, pagesat, borxhet, pajtimet dhe dokumentet financiare.

Komponente:

- Finance Accounts
- Finance Transactions
- Customer Receipts
- Supplier Payments
- Finance Documents
- Finance Reconciliation
- Finance Settlements
- Customer/Supplier Statements
- VAT Settlements
- VAT Returns

Si perdoret:

1. Krijohen finance accounts: arke, banke, POS, etj.
2. Regjistrohen arketimet nga klientet.
3. Regjistrohen pagesat ndaj furnitoreve.
4. Pagesat lidhen me dokumentet e hapura.
5. Bank reconciliation kontrollon transaksionet me llogarine bankare.
6. Statements tregojne kartelen e klientit/furnitorit.
7. VAT reports dhe settlements perdoren per deklarime.

Cfare funksionon:

- Endpoint-et per finance accounts dhe transactions pergjigjen.
- Reports per bank reconciliation dhe aging pergjigjen.
- Statements per kliente/furnitore pergjigjen.
- Finance documents jane te lidhura me workflow aprovimi.

Cfare mungon ose duhet forcuar:

- Finance accounts ne databazen aktuale jane 0, duhet seed/setup.
- Cash register/day close.
- Multi-currency.
- Import bank statement nga CSV/Excel.
- Reversal/storno per pagesat dhe dokumentet financiare.
- Workflow i mbylljes ditore/mujore per arke dhe banke.
- Kontroll i roles: jo cdo user duhet te mund te postoje apo te fshije dokument financiar.

### 3.9 Kontabilitet

Qellimi: regjistron efektin kontabel te dokumenteve dhe raporton gjendjen financiare.

Komponente:

- Chart of Accounts
- Journal Entries
- Manual Journals
- Trial Balance
- General Ledger
- Closing Entries
- Financial Periods
- Approval gate per manual journals

Si perdoret:

1. Krijohet chart of accounts.
2. Hapen periudhat financiare.
3. Dokumentet e shitjes, blerjes, pagesave dhe kthimeve krijojne entries.
4. Manual journals perdoren per korrigjime te kontrolluara.
5. Trial balance dhe ledger perdoren per kontroll.
6. Closing entries mbyllin periudhat.

Cfare funksionon:

- Accounting accounts dhe trial balance endpoint-et pergjigjen.
- Financial periods ekzistojne.
- Manual journal approval gate ekziston.
- Ledger pages dhe export ekzistojne.

Cfare mungon ose duhet forcuar:

- Setup wizard per chart of accounts.
- Lock period rules me kontroll me te forte.
- Audit i plote per ndryshime ne journal entries.
- Raporte financiare standarde: bilanc, pasqyra e te ardhurave, cash flow.
- Mapping i llogarive kontabel per artikuj/kategori/taksa/depo.

### 3.10 Raportet

Qellimi: jep pamje per shitje, finance, kontabilitet, stok dhe performancen operative.

Komponente:

- Sales reports
- Receivables aging
- Payables aging
- Bank reconciliation report
- Stock reports
- Accounting reports
- Ledger exports
- Dashboard summary

Si perdoret:

1. Perdoruesi zgjedh periudhen.
2. Zgjedh filtrat: klient, furnitor, depo, artikull, status.
3. Raporti shfaq rezultate dhe, ku ekziston, mund te eksportohet.

Cfare funksionon:

- Endpoint-et kryesore te raporteve pergjigjen.
- Faqet e raporteve ngarkohen.
- Ekziston eksport per ledger.

Cfare mungon ose duhet forcuar:

- Eksport ne Excel/PDF per te gjitha raportet.
- Raporte te planifikuara me email.
- Dashboard per role te ndryshme.
- Drill-down nga raporti ne dokument burimor.
- Raport per WMS productivity: picker, koha e picking, gabime, short picks.

### 3.11 Approvals

Qellimi: kontrollon veprimet qe kerkojne miratim para postimit ose ekzekutimit.

Komponente:

- Approval Requests
- Approval Dashboard
- Approval Policies
- Policy Steps
- Approval Decision Actions
- Approval gates per credit, supplier payment, manual journal, sales return

Si perdoret:

1. Admin krijon policy per llojin e dokumentit.
2. Caktohen hapat dhe approver-at.
3. Kur dokumenti kalon limitin ose rregullin, krijohet approval request.
4. Approver e aprovon/refuzon.
5. Vetem pas aprovimit vazhdon postimi ose veprimi.

Cfare funksionon:

- Faqet e approvals ngarkohen.
- Dashboard dhe policies endpoint-et pergjigjen.
- Disa module jane lidhur me approval gates.

Cfare mungon ose duhet forcuar:

- Notifications per approver.
- Delegim aprovimi kur approver mungon.
- SLA/afate per approval.
- Audit trail i detajuar per cdo hap.
- Simulim/testim i policy para aktivizimit.

### 3.12 Control Tower dhe Risk

Qellimi: jep sinjale operative per perjashtime, risk klienti/furnitori dhe gjendjen e kompanise.

Komponente:

- Company Pulse
- Control Tower Exceptions
- Customer Risk
- Supplier Risk
- Exception workflow modal/actions

Si perdoret:

1. Menaxheri hap dashboard-in e pulse ose exceptions.
2. Sistemi tregon problematika: dokumente te vonuara, risqe, obligime, perjashtime.
3. User-i mund te caktoje/ndryshoje statusin e exception.
4. Risk pages tregojne ekspozimin per kliente/furnitore.

Cfare funksionon:

- Faqet ngarkohen.
- Endpoint-et kryesore per pulse dhe dashboards pergjigjen.

Cfare mungon ose duhet forcuar:

- Alert rules te konfigurueshme.
- Notifications.
- Lidhje direkte nga exception ne dokumentin burimor.
- Scorecards te dokumentuara: si llogaritet risku.
- Historik i vendimeve mbi exception.

## 4. Rrjedhat nder-departamentale

### 4.1 Setup fillestar

Rradha e sakte e konfigurimit:

1. Company profile
2. Users/Roles
3. Financial periods
4. Chart of accounts
5. Finance accounts
6. Tax rates, units, categories
7. Warehouses
8. WMS locations
9. Customers/Suppliers
10. Items me kode interne, barkode dhe politika lot/serial/expiry
11. Document series
12. Stock opening balances

Pa kete setup, shumica e moduleve hapen, por nuk mund te testohen realisht end-to-end.

### 4.2 Shitje me WMS

Rrjedha ideale:

1. Sales order ose agent order krijohet.
2. Sistemi rezervon ose planifikon stokun.
3. WMS krijon picking task.
4. Picker skanon lokacionin dhe artikullin.
5. Packing konfirmon daljen.
6. Sales invoice postohet.
7. Stoku ulet.
8. Kontabiliteti krijon entry.
9. Customer statement rrit borxhin.
10. Pagesa e klientit e mbyll borxhin.

Status aktual:

- Backend e kerkon WMS readiness para postimit te sales invoice.
- Faqet WMS ekzistojne.
- POS duhet pershtatur per kete rrjedhe.

### 4.3 Blerje me WMS

Rrjedha ideale:

1. Purchase order krijohet.
2. Malli pranohet ne receiving.
3. WMS ben putaway.
4. Supplier invoice regjistrohet.
5. Stoku dhe kontabiliteti perditesohen.
6. Pagesa e furnitorit lidhet me dokumentin.

Status aktual:

- Purchase invoice ekziston dhe lidhet me stok/accounting.
- WMS receiving nuk eshte i lidhur plotesisht me Purchase Order/GRN.

### 4.4 Kthime

Rrjedha ideale per kthim shitjeje:

1. Klienti kthen mallin.
2. Agjenti ose backoffice hap return order.
3. WMS e pranon mallin ne lokacion kthimi.
4. QC vendos: i shitshem, i bllokuar, i demtuar, skaduar.
5. Sales return postohet.
6. Stoku dhe kartela e klientit perditesohen.

Status aktual:

- Sales returns ekzistojne.
- WMS return receiving duhet lidhur me kthimin/agjent order.

### 4.5 Finance dhe kontabilitet

Rrjedha:

1. Dokumenti operativ postohet.
2. Krijohet entry kontabel.
3. Krijohet obligim ose arketim/pagesa.
4. Finance settlement e lidh pagesen me dokumentin.
5. Statements tregojne historikun.
6. Reports permbledhin gjendjen.

Status aktual:

- Struktura ekziston.
- Duhet master data financiare dhe testim me dokumente reale.

## 5. Prioritetet e rekomanduara

### P0 - Para perdorimit ne prodhim

- Ndrysho `JWT_SECRET` ne prodhim.
- Rivendos/konfirmo kredencialet admin.
- Krijo seed/setup zyrtar per master data minimale.
- Mos lejo POS te postoje fature nese WMS nuk eshte perfunduar, ose implemento auto-pick/auto-pack te kontrolluar.

### P1 - Per kompletim operacional

- Lidh Agent Orders me WMS task dhe me krijim automatik te fatures/kthimit.
- Lidh Purchase Order/GRN me WMS receiving dhe putaway.
- Lidh Sales Return/Agent Return me WMS return receiving dhe QC.
- Shto short pick, partial delivery dhe backorder.
- Shto label/barcode printing.
- Shto import/export per master data.
- Shto E2E tests me dataset real.

### P2 - Per rritje profesionale te sistemit

- Mobile scanner UX.
- Wave/batch picking.
- Multi-currency.
- Landed cost.
- Full financial statements.
- Scheduled reports dhe notifications.
- Risk scoring te dokumentuar.
- Reversal/storno te standardizuar per te gjitha dokumentet e postuara.

## 6. Dokumentim i shpejte sipas funksionit

| Funksioni | Cfare ben | Per cfare perdoret | Si perdoret |
| --- | --- | --- | --- |
| Dashboard | Jep permbledhje te kompanise | Monitorim ditor | Hape `/dashboard` dhe kontrollo KPI |
| Customers | Mban klientet | Shitje, arketim, risk | Krijo klientin para fatures |
| Suppliers | Mban furnitoret | Blerje, pagesa, risk | Krijo furnitorin para blerjes |
| Items | Mban artikujt | Shitje, blerje, stok, WMS | Vendos kod, barkod, njesi, takse |
| Warehouses | Mban depot | Stok dhe WMS | Krijo depo para lokacioneve WMS |
| WMS Locations | Mban bin/lokacion fizik | Picking, putaway, skanim | Krijo Zone/Aisle/Rack/Shelf/Bin |
| WMS Balances | Tregon stok ne lokacion | Kontroll fizik | Shiko sasite sipas lokacionit/lotit |
| WMS Tasks | Menaxhon detyrat e magazines | Picking, putaway, move, count | Cakto user dhe perfundo task-un |
| Picking | Merr mallin per dalje | Shitje/dergesa | Picker skanon lokacion dhe artikull |
| Packing | Konfirmon pergatitjen | Para postimit te fatures | Paketo dhe konfirmo sasite |
| Sales Invoice | Faturon klientin | Efekt financiar dhe stok | Krijo draft, pergatit WMS, posto |
| Sales Return | Kthen mall nga klienti | Korrigjim stok/finance | Lidhe me klient/dokument dhe posto |
| Agent Order | Regjistron porosi nga terreni | Agjent, objekt, kthim, shitje | Agjenti krijon order, magazina e proceson |
| Purchase Invoice | Regjistron blerjen | Hyrje stoku dhe obligim furnitori | Krijo draft dhe posto |
| Stock Adjustment | Korrigjon stokun | Inventarizim/korrigjim | Zgjidh artikull/depo/sasi dhe posto |
| Stock Transfer | Leviz stokun | Transfer depo-depo | Zgjidh burim/destinacion dhe artikuj |
| Stock Count | Numron stokun | Inventarizim fizik | Regjistro sasine reale dhe diferencen |
| Finance Accounts | Arka/banka/POS | Pagesa dhe arketim | Krijo llogari financiare |
| Customer Receipt | Arketon klient | Mbyll borxhin | Zgjidh klient, shume, account |
| Supplier Payment | Paguan furnitor | Mbyll obligimin | Zgjidh furnitor, shume, account |
| Statements | Kartela klient/furnitor | Kontroll i borxhit | Hap statement sipas subjektit |
| Accounting Accounts | Chart of accounts | Kontabilitet | Krijo/mirambo llogari kontabel |
| Journal Entries | Regjistrime kontabel | Efekt financiar | Gjenerohen nga dokumentet ose manual |
| Trial Balance | Bilanc prove | Kontroll kontabel | Zgjidh periudhe dhe analizo |
| Financial Periods | Periudha fiskale | Kontroll postimi | Hape/mbyll periudhat |
| VAT Returns | TVSH | Deklarime | Kontrollo periudhen dhe dokumentet |
| Reports | Raporte operative | Analiza | Zgjidh raport, periudhe dhe filtra |
| Approvals | Miratime | Kontroll i dokumenteve | Policy -> request -> approve/refuse |
| Control Tower | Perjashtime dhe pulse | Menaxhim operativ | Ndiq exceptions dhe risk |
| Audit Logs | Gjurme veprimesh | Siguri/audit | Kerko veprime sipas user/modul |

## 7. Konkluzion

Sistemi eshte ne faze te mire integrimi: modulet kryesore jane ngritur, Docker dhe build-et kalojne, backend tests kalojne, frontend typecheck kalon, dhe faqet kryesore hapen. Puna me e rendesishme tani eshte kompletimi i rrjedhave reale end-to-end me te dhena testuese dhe mbyllja e boshlleqeve ndermjet POS/Agent/WMS/Sales/Purchase/Finance.

Prioriteti i pare praktik eshte: krijimi i dataset-it minimal dhe testimi real i rrjedhes `Agent Order -> WMS Picking/Packing -> Sales Invoice -> Posting -> Customer Statement -> Payment`.
