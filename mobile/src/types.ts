export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
};

export type AgentOrderLine = {
  id: string;
  itemId: string;
  description?: string | null;
  qty: number | string;
  unitPrice: number | string;
  discountPercent?: number | string | null;
  taxPercent: number | string;
  notes?: string | null;
  item?: {
    id: string;
    code: string;
    name: string;
    barcode?: string | null;
  } | null;
};

export type Customer = {
  id: string;
  code?: string | null;
  name: string;
  isActive?: boolean;
};

export type CustomerObject = {
  id: string;
  customerId: string;
  code?: string | null;
  name: string;
  isActive?: boolean;
};

export type Warehouse = {
  id: string;
  code?: string | null;
  name: string;
  isActive?: boolean;
};

export type Item = {
  id: string;
  code?: string | null;
  barcode?: string | null;
  name: string;
  standardSalesPrice?: number | string | null;
  taxRate?: {
    id?: string;
    code?: string | null;
    ratePercent?: number | string | null;
    rate?: number | string | null;
  } | null;
  isActive?: boolean;
};

export type ReturnSource = {
  id: string;
  docNo: string;
  customerId: string;
  customer?: { id?: string; name?: string | null } | null;
  warehouse?: { id?: string; name?: string | null } | null;
  lines: Array<{
    id: string;
    itemId: string;
    qty: number | string;
    unitPrice: number | string;
    taxPercent: number | string;
    item?: { code?: string | null; name?: string | null } | null;
  }>;
};

export type AgentOrder = {
  id: string;
  orderNo: string;
  orderType: string;
  status: string;
  priority: number;
  notes?: string | null;
  docDate?: string | null;
  dueDate?: string | null;
  customerId: string;
  warehouseId: string;
  customer?: { id: string; name: string } | null;
  customerObject?: { id: string; code: string; name: string } | null;
  warehouse?: { id: string; code: string; name: string } | null;
  assignedPickerId?: string | null;
  assignedPicker?: { id: string; fullName: string; email?: string | null } | null;
  salesInvoiceId?: string | null;
  salesReturnId?: string | null;
  salesInvoice?: { id: string; docNo: string; status: string } | null;
  salesReturn?: { id: string; docNo: string; status: string } | null;
  lines?: AgentOrderLine[];
  tasks?: WmsTask[];
};

export type PickerOption = {
  id: string;
  fullName: string;
  email?: string | null;
  role?: { code?: string; name?: string } | null;
};

export type DocumentSeries = {
  id: string;
  code?: string;
  name?: string;
  prefix?: string;
  documentType?: string;
  isActive?: boolean;
};

export type PaymentMethod = {
  id: string;
  code?: string;
  name?: string;
  isActive?: boolean;
};

export type WmsTask = {
  id: string;
  taskType: string;
  status: string;
  qty: number | string;
  lotCode?: string | null;
  serialNo?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  assignedToId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  item?: { id: string; code: string; name: string; barcode?: string | null } | null;
  warehouse?: { id: string; code?: string; name: string } | null;
  sourceLocation?: { id: string; code: string; barcode?: string | null } | null;
  destinationLocation?: { id: string; code: string; barcode?: string | null } | null;
  invoiceWorkflow?: {
    salesInvoiceId: string;
    referenceNo?: string | null;
    reservedCount: number;
    pickedCount: number;
    reservedQty: number | string;
    pickedQty: number | string;
    openPickTasks: number;
    openPackTasks: number;
  } | null;
  agentOrderWorkflow?: {
    agentOrderId: string;
    referenceNo?: string | null;
    openTasks: number;
    doneTasks: number;
  } | null;
};

export type ScanPayload = {
  items: Array<{
    id: string;
    code: string;
    barcode?: string | null;
    name: string;
  }>;
  locations: Array<{
    id: string;
    code: string;
    barcode?: string | null;
    zone?: string | null;
    warehouse?: { name: string } | null;
  }>;
  stocks: Array<{
    id: string;
    lotCode?: string | null;
    serialNo?: string | null;
    qtyOnHand?: number | string | null;
    item?: { code: string; name: string } | null;
    location?: { code: string } | null;
    warehouse?: { name: string } | null;
  }>;
};
