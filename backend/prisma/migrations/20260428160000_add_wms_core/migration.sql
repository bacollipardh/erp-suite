CREATE TYPE "wms_location_type" AS ENUM (
  'RECEIVING',
  'STORAGE',
  'PICKING',
  'PACKING',
  'SHIPPING',
  'QUARANTINE',
  'RETURNS',
  'DAMAGED'
);

CREATE TYPE "wms_location_status" AS ENUM (
  'ACTIVE',
  'BLOCKED',
  'QUARANTINE',
  'FULL',
  'DAMAGED',
  'INACTIVE'
);

CREATE TYPE "wms_inventory_status" AS ENUM (
  'AVAILABLE',
  'QUARANTINE',
  'DAMAGED',
  'EXPIRED'
);

CREATE TYPE "wms_movement_type" AS ENUM (
  'RECEIVE',
  'PUTAWAY',
  'MOVE',
  'RESERVE',
  'PICK',
  'RELEASE',
  'SHIP',
  'COUNT_ADJUSTMENT',
  'QUARANTINE',
  'RELEASE_QUARANTINE',
  'DAMAGE',
  'SCRAP',
  'RETURN'
);

CREATE TYPE "wms_task_type" AS ENUM (
  'RECEIVE',
  'PUTAWAY',
  'PICK',
  'PACK',
  'SHIP',
  'MOVE',
  'COUNT',
  'REPLENISH',
  'QC'
);

CREATE TYPE "wms_task_status" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
  'SHORT',
  'BLOCKED'
);

CREATE TYPE "wms_reservation_status" AS ENUM (
  'RESERVED',
  'PICKED',
  'RELEASED',
  'SHIPPED',
  'CANCELLED',
  'SHORT'
);

CREATE TABLE "wms_locations" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "barcode" VARCHAR(120),
  "zone" VARCHAR(40) NOT NULL,
  "aisle" VARCHAR(40),
  "rack" VARCHAR(40),
  "shelf" VARCHAR(40),
  "bin" VARCHAR(40),
  "location_type" "wms_location_type" NOT NULL DEFAULT 'STORAGE',
  "status" "wms_location_status" NOT NULL DEFAULT 'ACTIVE',
  "max_weight" DECIMAL(18,3),
  "max_volume" DECIMAL(18,3),
  "max_qty" DECIMAL(18,3),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wms_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_stocks" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "lot_code" VARCHAR(80),
  "serial_no" VARCHAR(120),
  "expiry_date" DATE,
  "manufacturing_date" DATE,
  "qty_on_hand" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "reserved_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "picked_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "inventory_status" "wms_inventory_status" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wms_stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_movements" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "from_location_id" UUID,
  "to_location_id" UUID,
  "movement_type" "wms_movement_type" NOT NULL,
  "qty" DECIMAL(18,3) NOT NULL,
  "lot_code" VARCHAR(80),
  "serial_no" VARCHAR(120),
  "expiry_date" DATE,
  "source_type" VARCHAR(60),
  "source_id" UUID,
  "reference_no" VARCHAR(80),
  "notes" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wms_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_tasks" (
  "id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "item_id" UUID,
  "source_location_id" UUID,
  "destination_location_id" UUID,
  "task_type" "wms_task_type" NOT NULL,
  "status" "wms_task_status" NOT NULL DEFAULT 'PENDING',
  "qty" DECIMAL(18,3),
  "lot_code" VARCHAR(80),
  "serial_no" VARCHAR(120),
  "expiry_date" DATE,
  "source_type" VARCHAR(60),
  "source_id" UUID,
  "reference_no" VARCHAR(80),
  "assigned_to" UUID,
  "priority" INTEGER NOT NULL DEFAULT 5,
  "notes" TEXT,
  "created_by" UUID,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wms_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_reservations" (
  "id" UUID NOT NULL,
  "sales_invoice_id" UUID NOT NULL,
  "sales_invoice_line_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "qty_reserved" DECIMAL(18,3) NOT NULL,
  "qty_picked" DECIMAL(18,3) NOT NULL DEFAULT 0,
  "lot_code" VARCHAR(80),
  "serial_no" VARCHAR(120),
  "expiry_date" DATE,
  "status" "wms_reservation_status" NOT NULL DEFAULT 'RESERVED',
  "created_by" UUID,
  "picked_at" TIMESTAMPTZ(6),
  "shipped_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wms_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_locations_barcode_key" ON "wms_locations"("barcode");
CREATE UNIQUE INDEX "wms_locations_warehouse_id_code_key" ON "wms_locations"("warehouse_id", "code");
CREATE INDEX "wms_locations_warehouse_id_status_idx" ON "wms_locations"("warehouse_id", "status");
CREATE INDEX "wms_locations_zone_aisle_rack_shelf_bin_idx" ON "wms_locations"("zone", "aisle", "rack", "shelf", "bin");

CREATE UNIQUE INDEX "wms_stocks_item_id_serial_no_key" ON "wms_stocks"("item_id", "serial_no");
CREATE INDEX "wms_stocks_warehouse_id_item_id_idx" ON "wms_stocks"("warehouse_id", "item_id");
CREATE INDEX "wms_stocks_location_id_item_id_idx" ON "wms_stocks"("location_id", "item_id");
CREATE INDEX "wms_stocks_lot_code_idx" ON "wms_stocks"("lot_code");
CREATE INDEX "wms_stocks_expiry_date_idx" ON "wms_stocks"("expiry_date");
CREATE INDEX "wms_stocks_inventory_status_idx" ON "wms_stocks"("inventory_status");

CREATE INDEX "wms_movements_warehouse_id_item_id_idx" ON "wms_movements"("warehouse_id", "item_id");
CREATE INDEX "wms_movements_from_location_id_idx" ON "wms_movements"("from_location_id");
CREATE INDEX "wms_movements_to_location_id_idx" ON "wms_movements"("to_location_id");
CREATE INDEX "wms_movements_movement_type_idx" ON "wms_movements"("movement_type");
CREATE INDEX "wms_movements_source_type_source_id_idx" ON "wms_movements"("source_type", "source_id");
CREATE INDEX "wms_movements_created_at_idx" ON "wms_movements"("created_at");

CREATE INDEX "wms_tasks_warehouse_id_status_idx" ON "wms_tasks"("warehouse_id", "status");
CREATE INDEX "wms_tasks_task_type_idx" ON "wms_tasks"("task_type");
CREATE INDEX "wms_tasks_source_type_source_id_idx" ON "wms_tasks"("source_type", "source_id");
CREATE INDEX "wms_tasks_assigned_to_idx" ON "wms_tasks"("assigned_to");

CREATE INDEX "wms_reservations_sales_invoice_id_status_idx" ON "wms_reservations"("sales_invoice_id", "status");
CREATE INDEX "wms_reservations_sales_invoice_line_id_idx" ON "wms_reservations"("sales_invoice_line_id");
CREATE INDEX "wms_reservations_warehouse_id_item_id_idx" ON "wms_reservations"("warehouse_id", "item_id");
CREATE INDEX "wms_reservations_location_id_idx" ON "wms_reservations"("location_id");

ALTER TABLE "wms_locations" ADD CONSTRAINT "wms_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_stocks" ADD CONSTRAINT "wms_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_stocks" ADD CONSTRAINT "wms_stocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "wms_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_stocks" ADD CONSTRAINT "wms_stocks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_movements" ADD CONSTRAINT "wms_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_movements" ADD CONSTRAINT "wms_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_movements" ADD CONSTRAINT "wms_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "wms_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wms_movements" ADD CONSTRAINT "wms_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "wms_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_tasks" ADD CONSTRAINT "wms_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_tasks" ADD CONSTRAINT "wms_tasks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wms_tasks" ADD CONSTRAINT "wms_tasks_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "wms_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wms_tasks" ADD CONSTRAINT "wms_tasks_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "wms_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_reservations" ADD CONSTRAINT "wms_reservations_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_reservations" ADD CONSTRAINT "wms_reservations_sales_invoice_line_id_fkey" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_reservations" ADD CONSTRAINT "wms_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_reservations" ADD CONSTRAINT "wms_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "wms_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_reservations" ADD CONSTRAINT "wms_reservations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
