export interface MarketPriceData {
  id: string;
  itemId: number;
  itemName: string;
  category: string;
  price1: number;
  price10: number;
  price100: number;
  unitPrice1: number;
  unitPrice10: number;
  unitPrice100: number;
  bestUnitOption: '1' | '10' | '100';
  arbitrageSavingPct: number;
  serverName?: string;
  updatedAt: string;
  history?: Array<{
    timestamp: string;
    price1: number;
    price10: number;
    price100: number;
  }>;
  rawPayload?: Record<string, unknown>;
}

export interface IngestPricePayload {
  item?: string;
  item_id?: number;
  itemId?: number;
  itemName?: string;
  category?: string;
  precios?: {
    "1"?: number;
    "10"?: number;
    "100"?: number;
    "1x"?: number;
    "10x"?: number;
    "100x"?: number;
  };
  prices?: {
    "1"?: number;
    "10"?: number;
    "100"?: number;
  };
  server?: string;
  server_name?: string;
  timestamp?: string;
}

export interface ItemDictionaryEntry {
  id: number;
  name: string;
  category: string;
  level?: number;
  iconId?: number;
  description?: string;
}

export interface PacketAnalysisResult {
  messageId: number;
  messageName: string;
  lengthType: number;
  payloadLength: number;
  rawLength: number;
  headerHex: string;
  payloadHex: string;
  decodedItems?: Array<{
    itemId: number;
    itemName: string;
    price1: number;
    price10: number;
    price100: number;
  }>;
  explanation: string;
  pythonSnippet: string;
}

export interface ServerStats {
  totalPacketsReceived: number;
  totalItemsTracked: number;
  activeItemsCount: number;
  lastIngestTime: string | null;
  serverUptimeSeconds: number;
  apiEndpointUrl: string;
}
