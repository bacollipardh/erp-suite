import * as SecureStore from 'expo-secure-store';

const AGENT_ORDER_QUEUE_KEY = 'erp_mobile_agent_order_queue';
const PICKER_ACTION_QUEUE_KEY = 'erp_mobile_picker_action_queue';

export type QueuedAgentOrderDraft = {
  id: string;
  createdAt: string;
  summary: {
    customerName?: string;
    warehouseName?: string;
    orderType: string;
    lineCount: number;
    totalAmount?: number;
  };
  payload: Record<string, unknown>;
};

export type QueuedPickerAction = {
  id: string;
  createdAt: string;
  taskId: string;
  action:
    | 'pick-confirm'
    | 'short'
    | 'pack'
    | 'start'
    | 'complete'
    | 'reassign';
  path: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  summary: string;
};

async function readQueue<T>(key: string) {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [] as T[];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue<T>(key: string, entries: T[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(entries));
}

export async function listQueuedAgentOrders() {
  return readQueue<QueuedAgentOrderDraft>(AGENT_ORDER_QUEUE_KEY);
}

export async function enqueueAgentOrderDraft(entry: Omit<QueuedAgentOrderDraft, 'id' | 'createdAt'>) {
  const current = await listQueuedAgentOrders();
  const nextEntry: QueuedAgentOrderDraft = {
    id: `draft-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const nextQueue = [nextEntry, ...current].slice(0, 25);
  await writeQueue(AGENT_ORDER_QUEUE_KEY, nextQueue);
  return nextEntry;
}

export async function removeQueuedAgentOrder(id: string) {
  const current = await listQueuedAgentOrders();
  await writeQueue(
    AGENT_ORDER_QUEUE_KEY,
    current.filter((entry) => entry.id !== id),
  );
}

export async function replaceQueuedAgentOrders(entries: QueuedAgentOrderDraft[]) {
  await writeQueue(AGENT_ORDER_QUEUE_KEY, entries);
}

export async function listQueuedPickerActions() {
  return readQueue<QueuedPickerAction>(PICKER_ACTION_QUEUE_KEY);
}

export async function enqueuePickerAction(entry: Omit<QueuedPickerAction, 'id' | 'createdAt'>) {
  const current = await listQueuedPickerActions();
  const nextEntry: QueuedPickerAction = {
    id: `picker-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const nextQueue = [nextEntry, ...current].slice(0, 50);
  await writeQueue(PICKER_ACTION_QUEUE_KEY, nextQueue);
  return nextEntry;
}

export async function removeQueuedPickerAction(id: string) {
  const current = await listQueuedPickerActions();
  await writeQueue(
    PICKER_ACTION_QUEUE_KEY,
    current.filter((entry) => entry.id !== id),
  );
}

export async function replaceQueuedPickerActions(entries: QueuedPickerAction[]) {
  await writeQueue(PICKER_ACTION_QUEUE_KEY, entries);
}
