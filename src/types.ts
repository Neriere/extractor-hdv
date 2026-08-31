export type ItemCategoryType = 'recurso' | 'equipable';

export interface MarketItem {
  id: string; // internal unique key (e.g. "item_11219" or "item_65")
  itemId: number;
  itemName?: string;
  itemType: ItemCategoryType;
  serverName: string;
  updatedAt: string;
  captureCount: number;

  // Recursos (x1, x10, x100, x1000)
  pricesResource?: {
    p1: number;
    p10: number;
    p100: number;
    p1000: number;
  };
  unitPrices?: {
    u1: number;
    u10: number;
    u100: number;
    u1000: number;
  };

  // Equipables (Lista de precios detectados)
  pricesEquipment?: number[];

  // Métricas estadísticas calculadas en cualquier situación
  averagePrice: number;       // Precio Medio (Media unitaria en recursos o media de ofertas en equipables)
  minPrice: number;           // Precio mínimo (unitario en recurso, o mínima oferta en equipable)
  maxPrice: number;           // Precio máximo (unitario en recurso, o máxima oferta en equipable)
  medianPrice?: number;       // Mediana
  totalOffers: number;        // Cantidad de ofertas o lotes registrados
  
  // Historial de cambios
  priceHistory?: Array<{
    timestamp: string;
    averagePrice: number;
    pricesSummary: string;
  }>;

  rawPayload?: unknown;
}

export interface IngestPricePayload {
  item_id?: number | string;
  itemId?: number | string;
  id?: number | string;
  item?: string;
  itemName?: string;
  name?: string;
  type?: 'recurso' | 'resource' | 'equipable' | 'equipment';
  
  // Para recursos: {"1": 18, "10": 5, "100": 8, "1000": 65} o similar
  precios?: Record<string, number | string> | number[];
  prices?: Record<string, number | string> | number[];
  
  // O campos planos
  p1?: number;
  p10?: number;
  p100?: number;
  p1000?: number;

  server?: string;
  server_name?: string;
  timestamp?: string;
  raw_hex?: string;
  hex?: string;
}

export interface PacketLogEntry {
  id: string;
  timestamp: string;
  source: string;
  itemId?: number;
  summary: string;
  payload: unknown;
}

export interface ServerStats {
  totalPacketsReceived: number;
  totalItemsCaptured: number;
  lastIngestTime: string | null;
  serverUptimeSeconds: number;
  apiEndpointUrl: string;
  savedFile: string;
}
