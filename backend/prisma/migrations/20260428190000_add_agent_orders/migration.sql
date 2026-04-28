CREATE TYPE "agent_order_type" AS ENUM (
  'SALES_ORDER',
  'RETURN_ORDER',
  'OPEN_RETURN_ORDER',
  'EXCHANGE_ORDER'
);

CREATE TYPE "agent_order_status" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'WMS_ASSIGNED',
  'PICKING',
  'PICKED',
  'RECEIVED',
  'READY_FOR_DOCUMENT',
  'DOCUMENT_CREATED',
  'CANCELLED'
);

CREATE TABLE "customer_objects" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "address" VARCHAR(255),
  "city" VARCHAR(100),
  "contact_name" VARCHAR(120),
  "phone" VARCHAR(50),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_objects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_orders" (
  "id" UUID NOT NULL,
  "order_no" VARCHAR(50) NOT NULL,
  "order_type" "agent_order_type" NOT NULL,
  "status" "agent_order_status" NOT NULL DEFAULT 'DRAFT',
  "customer_id" UUID NOT NULL,
  "customer_object_id" UUID,
  "warehouse_id" UUID NOT NULL,
  "source_sales_invoice_id" UUID,
  "sales_invoice_id" UUID,
  "sales_return_id" UUID,
  "doc_date" DATE NOT NULL,
  "due_date" DATE,
  "priority" INTEGER NOT NULL DEFAULT 5,
  "assigned_picker_id" UUID,
  "assigned_at" TIMESTAMPTZ(6),
  "picked_at" TIMESTAMPTZ(6),
  "received_at" TIMESTAMPTZ(6),
  "ready_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agent_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_order_lines" (
  "id" UUID NOT NULL,
  "agent_order_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "sales_invoice_line_id" UUID,
  "line_no" INTEGER NOT NULL,
  "description" VARCHAR(255),
  "qty" DECIMAL(18,3) NOT NULL,
  "unit_price" DECIMAL(18,2) NOT NULL,
  "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tax_percent" DECIMAL(5,2) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agent_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_objects_customer_id_code_key" ON "customer_objects"("customer_id", "code");
CREATE INDEX "customer_objects_customer_id_is_active_idx" ON "customer_objects"("customer_id", "is_active");

CREATE UNIQUE INDEX "agent_orders_order_no_key" ON "agent_orders"("order_no");
CREATE INDEX "agent_orders_order_type_status_idx" ON "agent_orders"("order_type", "status");
CREATE INDEX "agent_orders_customer_id_idx" ON "agent_orders"("customer_id");
CREATE INDEX "agent_orders_customer_object_id_idx" ON "agent_orders"("customer_object_id");
CREATE INDEX "agent_orders_warehouse_id_idx" ON "agent_orders"("warehouse_id");
CREATE INDEX "agent_orders_assigned_picker_id_idx" ON "agent_orders"("assigned_picker_id");
CREATE INDEX "agent_orders_sales_invoice_id_idx" ON "agent_orders"("sales_invoice_id");
CREATE INDEX "agent_orders_sales_return_id_idx" ON "agent_orders"("sales_return_id");

CREATE UNIQUE INDEX "agent_order_lines_agent_order_id_line_no_key" ON "agent_order_lines"("agent_order_id", "line_no");
CREATE INDEX "agent_order_lines_item_id_idx" ON "agent_order_lines"("item_id");
CREATE INDEX "agent_order_lines_sales_invoice_line_id_idx" ON "agent_order_lines"("sales_invoice_line_id");

ALTER TABLE "customer_objects" ADD CONSTRAINT "customer_objects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_customer_object_id_fkey" FOREIGN KEY ("customer_object_id") REFERENCES "customer_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_source_sales_invoice_id_fkey" FOREIGN KEY ("source_sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_assigned_picker_id_fkey" FOREIGN KEY ("assigned_picker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_orders" ADD CONSTRAINT "agent_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_order_lines" ADD CONSTRAINT "agent_order_lines_agent_order_id_fkey" FOREIGN KEY ("agent_order_id") REFERENCES "agent_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_order_lines" ADD CONSTRAINT "agent_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_order_lines" ADD CONSTRAINT "agent_order_lines_sales_invoice_line_id_fkey" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
