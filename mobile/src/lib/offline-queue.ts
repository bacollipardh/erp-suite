import * as SecureStore from 'expo-secure-store';

const AGENT_ORDER_QUEUE_KEY = 'erp_mobile_agent_order_queue';

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

async function readQueue() {
  const raw = await SecureStore.getItemAsync(AGENT_ORDER_QUEUE_KEY);
  if (!raw) return [] as QueuedAgentOrderDraft[];
  try {
    const parsed = JSON.parse(raw) as QueuedAgentOrderDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(entries: QueuedAgentOrderDraft[]) {
  await SecureStore.setItemAsync(AGENT_ORDER_QUEUE_KEY, JSON.stringify(entries));
}

export async function listQueuedAgentOrders() {
  return readQueue();
}

export async function enqueueAgentOrderDraft(entry: Omit<QueuedAgentOrderDraft, 'id' | 'createdAt'>) {
  const current = await readQueue();
  const nextEntry: QueuedAgentOrderDraft = {
    id: `draft-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const nextQueue = [nextEntry, ...current].slice(0, 25);
  await writeQueue(nextQueue);
  return nextEntry;
}

export async function removeQueuedAgentOrder(id: string) {
  const current = await readQueue();
  await writeQueue(current.filter((entry) => entry.id !== id));
}

export async function replaceQueuedAgentOrders(entries: QueuedAgentOrderDraft[]) {
  await writeQueue(entries);
}
