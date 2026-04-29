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
  referenceNo?: string | null;
  notes?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  assignedToId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  item?: { id: string; code: string; name: string; barcode?: string | null } | null;
  warehouse?: { id: string; code?: string; name: string } | null;
  sourceLocation?: { id: string; code: string } | null;
  destinationLocation?: { id: string; code: string } | null;
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
