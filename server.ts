import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { MarketItem, IngestPricePayload, ServerStats, PacketLogEntry, ItemCategoryType } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;
const CAPTURED_FILE_PATH = path.join(process.cwd(), 'precios_capturados.json');

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

interface ServerStore {
  items: Map<number, MarketItem>;
  stats: {
    totalPacketsReceived: number;
    totalIngests: number;
    lastIngestTime: string | null;
    serverStartTime: number;
  };
  packetLogs: PacketLogEntry[];
}

const store: ServerStore = {
  items: new Map(),
  stats: {
    totalPacketsReceived: 0,
    totalIngests: 0,
    lastIngestTime: null,
    serverStartTime: Date.now()
  },
  packetLogs: []
};

// Cargar datos previos de precios_capturados.json si existen
function loadSavedCaptures() {
  try {
    if (fs.existsSync(CAPTURED_FILE_PATH)) {
      const fileData = fs.readFileSync(CAPTURED_FILE_PATH, 'utf-8');
      if (fileData.trim()) {
        const parsed = JSON.parse(fileData);
        if (Array.isArray(parsed)) {
          parsed.forEach((raw) => {
            const processed = processIngestItem(raw, false);
            if (processed) {
              store.items.set(processed.itemId, processed);
            }
          });
          console.log(`[Store] ${store.items.size} precios cargados desde precios_capturados.json`);
        }
      }
    }
  } catch (err) {
    console.error('[Store] Error cargando precios_capturados.json:', err);
  }
}

// Guardar colección completa en precios_capturados.json
function persistCapturesToFile() {
  try {
    const list: unknown[] = [];
    store.items.forEach((item) => {
      if (item.itemType === 'equipable' && item.pricesEquipment) {
        list.push({
          item_id: item.itemId,
          item: item.itemName,
          type: 'equipable',
          precios: item.pricesEquipment,
          precio_medio: item.averagePrice,
          precio_min: item.minPrice,
          precio_max: item.maxPrice,
          mediana: item.medianPrice,
          server: item.serverName,
          updated_at: item.updatedAt
        });
      } else {
        list.push({
          item_id: item.itemId,
          item: item.itemName,
          type: 'recurso',
          precios: {
            "1": item.pricesResource?.p1 ?? 0,
            "10": item.pricesResource?.p10 ?? 0,
            "100": item.pricesResource?.p100 ?? 0,
            "1000": item.pricesResource?.p1000 ?? 0
          },
          precios_unitarios: item.unitPrices,
          precio_medio_unitario: item.averagePrice,
          precio_min: item.minPrice,
          precio_max: item.maxPrice,
          server: item.serverName,
          updated_at: item.updatedAt
        });
      }
    });

    fs.writeFileSync(CAPTURED_FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Error guardando precios_capturados.json:', err);
  }
}

// Protobuf VarInt decoder helper
function decodeVarInt(buf: Buffer, offset: number): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < buf.length) {
    const b = buf[offset + bytesRead];
    bytesRead++;
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) break;
  }

  return { value: result, bytesRead };
}

// Extraer payload TCP de cabeceras completas si vienen de Wireshark/Raw Scapy
function extractTcpPayload(buf: Buffer): { payload: Buffer; isProtobuf: boolean } {
  let clean = buf;
  // Si contiene cabecera ethernet + IP + TCP
  if (clean.length > 54 && clean[12] === 0x08 && clean[13] === 0x00 && (clean[14] >> 4) === 4) {
    const ipHeaderLen = (clean[14] & 0x0f) * 4;
    const protocol = clean[23];
    if (protocol === 6) {
      const tcpOffset = 14 + ipHeaderLen;
      if (clean.length > tcpOffset + 12) {
        const tcpDataOffset = (clean[tcpOffset + 12] >> 4) * 4;
        const total = tcpOffset + tcpDataOffset;
        if (clean.length > total) {
          clean = clean.subarray(total);
        }
      }
    }
  }

  const str = clean.toString('latin1');
  const isProtobuf = str.includes('type.ankama.com/') || str.includes('ankama');
  return { payload: clean, isProtobuf };
}

// Parser de Protobuf Dofus Unity (kbt / market price messages)
function parseProtobufMarketPacket(buf: Buffer): { itemId?: number; prices?: number[]; type?: ItemCategoryType } | null {
  try {
    const str = buf.toString('latin1');
    const typeIdx = str.indexOf('type.ankama.com/');
    let offset = typeIdx !== -1 ? typeIdx : 0;
    
    if (typeIdx !== -1) {
      const endIdx = str.indexOf('\x12', typeIdx);
      offset = endIdx !== -1 ? endIdx : typeIdx + 20;
    }

    let itemId: number | undefined;
    const detectedPrices: number[] = [];

    while (offset < buf.length) {
      const tag = buf[offset];
      offset++;
      const field = tag >> 3;
      const wire = tag & 7;

      if (wire === 0) { // Varint
        const { value, bytesRead } = decodeVarInt(buf, offset);
        offset += bytesRead;
        if ((field === 1 || field === 2 || field === 5) && !itemId && value > 0 && value < 200000) {
          itemId = value;
        } else if (value > 0) {
          detectedPrices.push(value);
        }
      } else if (wire === 2) { // Length-delimited sub-message
        const { value: len, bytesRead } = decodeVarInt(buf, offset);
        offset += bytesRead;
        const sub = buf.subarray(offset, offset + len);
        offset += len;

        let subOff = 0;
        while (subOff < sub.length) {
          const subTag = sub[subOff];
          subOff++;
          const subWire = subTag & 7;
          if (subWire === 0) {
            const { value: subVal, bytesRead: sbR } = decodeVarInt(sub, subOff);
            subOff += sbR;
            if (subVal > 0) detectedPrices.push(subVal);
          } else if (subWire === 2) {
            const { value: sLen, bytesRead: sbR2 } = decodeVarInt(sub, subOff);
            subOff += sbR2 + sLen;
          } else {
            subOff++;
          }
        }
      } else if (wire === 5) {
        offset += 4;
      } else if (wire === 1) {
        offset += 8;
      } else {
        break;
      }
    }

    if (itemId) {
      return {
        itemId,
        prices: detectedPrices,
        type: detectedPrices.length > 4 ? 'equipable' : 'recurso'
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Procesa e interpreta cualquier JSON recibido (Recursos x1, x10, x100, x1000 o Equipables)
function processIngestItem(payload: IngestPricePayload, shouldPersist = true): MarketItem | null {
  let itemId = Number(payload.item_id || payload.itemId || payload.id || 0);
  let itemName = payload.item || payload.itemName || payload.name;
  let serverName = payload.server || payload.server_name || 'Draconiros';
  let incomingType: ItemCategoryType | undefined = (payload.type === 'equipable' || payload.type === 'equipment') ? 'equipable' : undefined;

  let rawPrices = payload.precios || payload.prices;
  let p1 = Number(payload.p1 ?? 0);
  let p10 = Number(payload.p10 ?? 0);
  let p100 = Number(payload.p100 ?? 0);
  let p1000 = Number(payload.p1000 ?? 0);
  let equipmentPricesList: number[] = [];

  // Parsear hex de Scapy si viene raw
  const rawHex = payload.raw_hex || payload.hex;
  if (rawHex && typeof rawHex === 'string') {
    const cleanHex = rawHex.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length >= 4) {
      const buffer = Buffer.from(cleanHex, 'hex');
      const { payload: cleanBuf } = extractTcpPayload(buffer);
      const parsed = parseProtobufMarketPacket(cleanBuf);
      if (parsed?.itemId) {
        itemId = itemId || parsed.itemId;
        if (parsed.prices && parsed.prices.length > 0) {
          if (parsed.type === 'equipable' || parsed.prices.length > 4) {
            equipmentPricesList = parsed.prices;
            incomingType = 'equipable';
          } else {
            p1 = p1 || parsed.prices[0] || 0;
            p10 = p10 || parsed.prices[1] || 0;
            p100 = p100 || parsed.prices[2] || 0;
            p1000 = p1000 || parsed.prices[3] || 0;
          }
        }
      }
    }
  }

  // Parsear si viene un Array directo de precios (típico de equipables con varias ofertas)
  if (Array.isArray(rawPrices)) {
    equipmentPricesList = rawPrices.map(Number).filter(n => !isNaN(n) && n > 0);
    incomingType = 'equipable';
  } else if (rawPrices && typeof rawPrices === 'object') {
    const pRecord = rawPrices as Record<string, number | string>;
    if (pRecord["1"] !== undefined || pRecord["1x"] !== undefined) p1 = Number(pRecord["1"] ?? pRecord["1x"] ?? 0);
    if (pRecord["10"] !== undefined || pRecord["10x"] !== undefined) p10 = Number(pRecord["10"] ?? pRecord["10x"] ?? 0);
    if (pRecord["100"] !== undefined || pRecord["100x"] !== undefined) p100 = Number(pRecord["100"] ?? pRecord["100x"] ?? 0);
    if (pRecord["1000"] !== undefined || pRecord["1000x"] !== undefined) p1000 = Number(pRecord["1000"] ?? pRecord["1000x"] ?? 0);
  }

  if (!itemId) {
    return null;
  }

  const existing = store.items.get(itemId);
  const nowStr = new Date().toISOString();
  const captureCount = (existing?.captureCount || 0) + 1;

  let finalItem: MarketItem;

  // CASO 1: EQUIPABLE (múltiples precios de ofertas individuales)
  if (incomingType === 'equipable' || equipmentPricesList.length > 0) {
    const validPrices = equipmentPricesList.filter(p => p > 0);
    const sorted = [...validPrices].sort((a, b) => a - b);
    const count = validPrices.length || 1;
    const sum = validPrices.reduce((acc, curr) => acc + curr, 0);
    
    // Cálculo de la Media
    const averagePrice = count > 0 ? Math.round(sum / count) : 0;
    const minPrice = sorted.length > 0 ? sorted[0] : 0;
    const maxPrice = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
    
    // Mediana
    let medianPrice = averagePrice;
    if (sorted.length > 0) {
      const mid = Math.floor(sorted.length / 2);
      medianPrice = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    const history = existing?.priceHistory || [];
    history.push({
      timestamp: nowStr,
      averagePrice,
      pricesSummary: `${count} ofertas (Min: ${minPrice.toLocaleString()}, Max: ${maxPrice.toLocaleString()})`
    });
    if (history.length > 20) history.shift();

    finalItem = {
      id: `item_${itemId}`,
      itemId,
      itemName: itemName || existing?.itemName || `Equipable #${itemId}`,
      itemType: 'equipable',
      serverName,
      updatedAt: nowStr,
      captureCount,
      pricesEquipment: validPrices,
      averagePrice,
      minPrice,
      maxPrice,
      medianPrice,
      totalOffers: count,
      priceHistory: history,
      rawPayload: payload as unknown
    };
  } 
  // CASO 2: RECURSO (Lotes x1, x10, x100, x1000)
  else {
    const u1 = p1 > 0 ? p1 : 0;
    const u10 = p10 > 0 ? Math.round(p10 / 10) : 0;
    const u100 = p100 > 0 ? Math.round(p100 / 100) : 0;
    const u1000 = p1000 > 0 ? Math.round(p1000 / 1000) : 0;

    const availableUnitPrices: number[] = [];
    if (u1 > 0) availableUnitPrices.push(u1);
    if (u10 > 0) availableUnitPrices.push(u10);
    if (u100 > 0) availableUnitPrices.push(u100);
    if (u1000 > 0) availableUnitPrices.push(u1000);

    // Cálculo de la Media Unitaria entre los lotes disponibles
    const sumUnit = availableUnitPrices.reduce((acc, curr) => acc + curr, 0);
    const averagePrice = availableUnitPrices.length > 0 ? Math.round(sumUnit / availableUnitPrices.length) : 0;
    const minPrice = availableUnitPrices.length > 0 ? Math.min(...availableUnitPrices) : 0;
    const maxPrice = availableUnitPrices.length > 0 ? Math.max(...availableUnitPrices) : 0;

    const history = existing?.priceHistory || [];
    history.push({
      timestamp: nowStr,
      averagePrice,
      pricesSummary: `x1:${p1} x10:${p10} x100:${p100} x1000:${p1000}`
    });
    if (history.length > 20) history.shift();

    finalItem = {
      id: `item_${itemId}`,
      itemId,
      itemName: itemName || existing?.itemName || `Recurso #${itemId}`,
      itemType: 'recurso',
      serverName,
      updatedAt: nowStr,
      captureCount,
      pricesResource: {
        p1,
        p10,
        p100,
        p1000
      },
      unitPrices: {
        u1,
        u10,
        u100,
        u1000
      },
      averagePrice,
      minPrice,
      maxPrice,
      totalOffers: availableUnitPrices.length,
      priceHistory: history,
      rawPayload: payload as unknown
    };
  }

  store.items.set(itemId, finalItem);
  store.stats.totalIngests++;
  store.stats.lastIngestTime = nowStr;

  if (shouldPersist) {
    persistCapturesToFile();
  }

  return finalItem;
}

// Cargar archivo inicial al iniciar servidor
loadSavedCaptures();

// --- RUTAS API ---

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - store.stats.serverStartTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

// 2. Estadísticas generales
app.get('/api/stats', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const fullAppUrl = `${protocol}://${host}`;

  const stats: ServerStats = {
    totalPacketsReceived: store.stats.totalPacketsReceived,
    totalItemsCaptured: store.items.size,
    lastIngestTime: store.stats.lastIngestTime,
    serverUptimeSeconds: Math.floor((Date.now() - store.stats.serverStartTime) / 1000),
    apiEndpointUrl: `${fullAppUrl}/api/precios`,
    savedFile: 'precios_capturados.json'
  };

  res.json({
    ...stats,
    packetLogs: store.packetLogs.slice(0, 15)
  });
});

// 3. GET /api/precios - Obtener lista de precios capturados y sus medias
app.get('/api/precios', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : 'all';

  let list = Array.from(store.items.values());

  if (search) {
    list = list.filter(item =>
      (item.itemName && item.itemName.toLowerCase().includes(search)) ||
      String(item.itemId).includes(search)
    );
  }

  if (type && type !== 'all') {
    list = list.filter(item => item.itemType === type);
  }

  // Ordenar por fecha de última captura descendente
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json({
    success: true,
    total: list.length,
    items: list
  });
});

// 4. POST /api/precios - Receptor JSON para sniffer_scapy.py o peticiones directas
app.post('/api/precios', (req, res) => {
  try {
    store.stats.totalPacketsReceived++;
    const payload = req.body;
    const ingestedItems: MarketItem[] = [];

    if (Array.isArray(payload)) {
      payload.forEach(entry => {
        const processed = processIngestItem(entry);
        if (processed) ingestedItems.push(processed);
      });
    } else if (payload && typeof payload === 'object') {
      const processed = processIngestItem(payload);
      if (processed) ingestedItems.push(processed);
    }

    // Log de actividad
    const logId = `pkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const summary = ingestedItems.length > 0 
      ? `ID: ${ingestedItems.map(i => i.itemId).join(', ')} (${ingestedItems[0].itemType === 'equipable' ? 'Equipable' : 'Recurso'}) • Media: ${ingestedItems[0].averagePrice.toLocaleString()} k`
      : 'Paquete procesado';

    store.packetLogs.unshift({
      id: logId,
      timestamp: new Date().toISOString(),
      source: req.ip || 'localhost',
      itemId: ingestedItems[0]?.itemId,
      summary,
      payload
    });

    if (store.packetLogs.length > 50) {
      store.packetLogs.pop();
    }

    res.json({
      success: true,
      message: `Registrados ${ingestedItems.length} objeto(s) y media calculada`,
      ingestedCount: ingestedItems.length,
      timestamp: store.stats.lastIngestTime,
      items: ingestedItems
    });
  } catch (error: any) {
    console.error('[API] Error procesando POST /api/precios:', error);
    res.status(400).json({
      success: false,
      error: error?.message || 'Error procesando payload JSON'
    });
  }
});

// 5. DELETE /api/precios - Limpiar colección y reiniciar archivo
app.delete('/api/precios', (req, res) => {
  store.items.clear();
  store.packetLogs = [];
  store.stats.lastIngestTime = null;
  persistCapturesToFile();
  res.json({ success: true, message: 'Precios capturados reiniciados' });
});

// 6. DELETE /api/precios/:id - Eliminar un item específico
app.delete('/api/precios/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const deleted = store.items.delete(itemId);
  if (deleted) {
    persistCapturesToFile();
  }
  res.json({ success: deleted, itemId });
});

// 7. GET /api/precios/export - Exportar archivo JSON
app.get('/api/precios/export', (req, res) => {
  try {
    if (fs.existsSync(CAPTURED_FILE_PATH)) {
      res.setHeader('Content-Disposition', 'attachment; filename="precios_capturados.json"');
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(CAPTURED_FILE_PATH);
    }
    res.json(Array.from(store.items.values()));
  } catch {
    res.status(500).json({ error: 'Error exportando archivo' });
  }
});

// 8. GET /api/sniffer-script - Obtener código de sniffer_scapy.py para el usuario
app.get('/api/sniffer-script', (req, res) => {
  try {
    const scriptPath = path.join(process.cwd(), 'sniffer_scapy.py');
    if (fs.existsSync(scriptPath)) {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      res.json({ code: content });
    } else {
      res.status(404).json({ error: 'Script no encontrado' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Integración Vite Middleware / Producción
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Dofus Market API] Receptor activo en http://localhost:${PORT}/api/precios`);
  });
}

startServer();
