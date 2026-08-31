import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { DEFAULT_ITEM_DICTIONARY } from './src/data/defaultItems';
import { MarketPriceData, IngestPricePayload } from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// In-memory Database Store
interface ServerStore {
  items: Map<number, MarketPriceData>;
  dictionary: Record<number, { id: number; name: string; category: string; level?: number }>;
  stats: {
    totalPacketsReceived: number;
    totalIngests: number;
    lastIngestTime: string | null;
    serverStartTime: number;
  };
  packetLogs: Array<{
    id: string;
    timestamp: string;
    source: string;
    itemsCount: number;
    summary: string;
    rawPayload?: unknown;
  }>;
}

const store: ServerStore = {
  items: new Map(),
  dictionary: { ...DEFAULT_ITEM_DICTIONARY },
  stats: {
    totalPacketsReceived: 0,
    totalIngests: 0,
    lastIngestTime: null,
    serverStartTime: Date.now()
  },
  packetLogs: []
};

// Seed some initial realistic market items so the app looks alive on first open
function seedInitialMarket() {
  const seeds: Array<{ id: number; p1: number; p10: number; p100: number; server: string }> = [
    { id: 254, p1: 150, p10: 1400, p100: 13500, server: "Tal Kasha" },
    { id: 255, p1: 320, p10: 3100, p100: 29000, server: "Tal Kasha" },
    { id: 679, p1: 45, p10: 420, p100: 3900, server: "Tal Kasha" },
    { id: 7059, p1: 24500, p10: 235000, p100: 2200000, server: "Tal Kasha" },
    { id: 7060, p1: 48000, p10: 460000, p100: 4400000, server: "Tal Kasha" },
    { id: 1735, p1: 85, p10: 800, p100: 7500, server: "Tal Kasha" },
    { id: 311, p1: 110, p10: 1050, p100: 9800, server: "Tal Kasha" },
    { id: 10842, p1: 185000, p10: 1800000, p100: 0, server: "Tal Kasha" },
    { id: 2412, p1: 1200, p10: 11500, p100: 110000, server: "Tal Kasha" }
  ];

  seeds.forEach(s => {
    processIngestItem({
      item_id: s.id,
      item: store.dictionary[s.id]?.name || `Item ${s.id}`,
      category: store.dictionary[s.id]?.category || "Recurso",
      precios: { "1": s.p1, "10": s.p10, "100": s.p100 },
      server: s.server
    });
  });
}

function processIngestItem(payload: IngestPricePayload): MarketPriceData | null {
  const itemId = Number(payload.item_id || payload.itemId || 0);
  const rawPrecios = payload.precios || payload.prices || {};

  const p1 = Number(rawPrecios["1"] ?? rawPrecios["1x"] ?? 0);
  const p10 = Number(rawPrecios["10"] ?? rawPrecios["10x"] ?? 0);
  const p100 = Number(rawPrecios["100"] ?? rawPrecios["100x"] ?? 0);

  if (!itemId && !payload.item && !payload.itemName) {
    return null;
  }

  // Resolver nombre y categoría con el diccionario
  const dictInfo = itemId ? store.dictionary[itemId] : undefined;
  const itemName = payload.item || payload.itemName || dictInfo?.name || `Objeto #${itemId}`;
  const category = payload.category || dictInfo?.category || "Mercadillo General";
  const serverName = payload.server || payload.server_name || "Servidor Principal";

  const u1 = p1 > 0 ? p1 : 0;
  const u10 = p10 > 0 ? p10 / 10 : 0;
  const u100 = p100 > 0 ? p100 / 100 : 0;

  // Determinar mejor opción por unidad
  const validUnits: Array<{ opt: '1' | '10' | '100'; price: number }> = [];
  if (u1 > 0) validUnits.push({ opt: '1', price: u1 });
  if (u10 > 0) validUnits.push({ opt: '10', price: u10 });
  if (u100 > 0) validUnits.push({ opt: '100', price: u100 });

  let bestUnitOption: '1' | '10' | '100' = '1';
  let arbitrageSavingPct = 0;

  if (validUnits.length > 0) {
    validUnits.sort((a, b) => a.price - b.price);
    bestUnitOption = validUnits[0].opt;
    const maxUnitPrice = Math.max(...validUnits.map(v => v.price));
    const minUnitPrice = validUnits[0].price;
    if (maxUnitPrice > 0 && minUnitPrice < maxUnitPrice) {
      arbitrageSavingPct = Math.round(((maxUnitPrice - minUnitPrice) / maxUnitPrice) * 100);
    }
  }

  const existing = itemId ? store.items.get(itemId) : undefined;
  const nowStr = new Date().toISOString();

  const history = existing?.history || [];
  history.push({
    timestamp: nowStr,
    price1: p1,
    price10: p10,
    price100: p100
  });

  // Limitar historial a los últimos 30 registros
  if (history.length > 30) {
    history.shift();
  }

  const dataItem: MarketPriceData = {
    id: `item_${itemId || Math.random().toString(36).substring(2, 9)}`,
    itemId: itemId || Math.floor(Math.random() * 90000 + 1000),
    itemName,
    category,
    price1: p1,
    price10: p10,
    price100: p100,
    unitPrice1: u1,
    unitPrice10: u10,
    unitPrice100: u100,
    bestUnitOption,
    arbitrageSavingPct,
    serverName,
    updatedAt: nowStr,
    history,
    rawPayload: payload as Record<string, unknown>
  };

  store.items.set(dataItem.itemId, dataItem);
  return dataItem;
}

// Initial seed
seedInitialMarket();

// Lazy Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("Aviso: GEMINI_API_KEY no configurado en entorno.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key || "dummy_key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - store.stats.serverStartTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const fullAppUrl = `${protocol}://${host}`;

  res.json({
    totalPacketsReceived: store.stats.totalPacketsReceived,
    totalItemsTracked: store.items.size,
    activeItemsCount: store.items.size,
    lastIngestTime: store.stats.lastIngestTime,
    serverUptimeSeconds: Math.floor((Date.now() - store.stats.serverStartTime) / 1000),
    apiEndpointUrl: `${fullAppUrl}/api/precios`,
    dictionarySize: Object.keys(store.dictionary).length,
    packetLogs: store.packetLogs.slice(0, 20)
  });
});

// GET /api/precios
app.get('/api/precios', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const server = typeof req.query.server === 'string' ? req.query.server : '';

  let list = Array.from(store.items.values());

  if (search) {
    list = list.filter(item =>
      item.itemName.toLowerCase().includes(search) ||
      String(item.itemId).includes(search)
    );
  }

  if (category && category !== 'all') {
    list = list.filter(item => item.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (server && server !== 'all') {
    list = list.filter(item => item.serverName === server);
  }

  // Ordenar por fecha de actualización descendente
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.json({
    count: list.length,
    total: store.items.size,
    items: list
  });
});

// POST /api/precios (The main receiver endpoint for Python Scapy & clients)
app.post('/api/precios', (req, res) => {
  try {
    const body = req.body;
    store.stats.totalPacketsReceived += 1;
    store.stats.totalIngests += 1;
    store.stats.lastIngestTime = new Date().toISOString();

    const ingestedItems: MarketPriceData[] = [];

    if (Array.isArray(body)) {
      body.forEach(item => {
        const processed = processIngestItem(item);
        if (processed) ingestedItems.push(processed);
      });
    } else if (body && Array.isArray(body.items)) {
      body.items.forEach((item: IngestPricePayload) => {
        const processed = processIngestItem(item);
        if (processed) ingestedItems.push(processed);
      });
    } else if (body && typeof body === 'object') {
      const processed = processIngestItem(body);
      if (processed) ingestedItems.push(processed);
    }

    // Log packet event
    store.packetLogs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      source: req.ip || 'Scapy Sniffer',
      itemsCount: ingestedItems.length,
      summary: ingestedItems.map(i => `${i.itemName} (x1:${i.price1})`).join(', ').substring(0, 120),
      rawPayload: body
    });

    if (store.packetLogs.length > 50) {
      store.packetLogs.pop();
    }

    res.status(200).json({
      success: true,
      message: `Procesados ${ingestedItems.length} objetos del mercadillo exitosamente`,
      ingestedCount: ingestedItems.length,
      timestamp: store.stats.lastIngestTime,
      data: ingestedItems
    });
  } catch (error: any) {
    console.error('Error procesando POST /api/precios:', error);
    res.status(400).json({
      success: false,
      error: error?.message || 'Payload inválido'
    });
  }
});

// DELETE /api/precios (Clear / Reset)
app.delete('/api/precios', (req, res) => {
  store.items.clear();
  store.packetLogs = [];
  res.json({ success: true, message: 'Mercadillo reiniciado' });
});

// DELETE /api/precios/:id
app.delete('/api/precios/:id', (req, res) => {
  const itemId = Number(req.params.id);
  const deleted = store.items.delete(itemId);
  res.json({ success: deleted, itemId });
});

// GET /api/items/dictionary
app.get('/api/items/dictionary', (req, res) => {
  res.json(store.dictionary);
});

// POST /api/items/dictionary (Update dictionary from uploaded id_to_name.json)
app.post('/api/items/dictionary', (req, res) => {
  try {
    const incoming = req.body;
    let count = 0;
    if (typeof incoming === 'object' && incoming !== null) {
      Object.entries(incoming).forEach(([key, val]) => {
        const id = Number(key);
        if (!isNaN(id)) {
          const name = typeof val === 'string' ? val : (val as any).name || `Objeto ${id}`;
          const category = (typeof val === 'object' && (val as any).category) || 'Importado D2O';
          store.dictionary[id] = { id, name, category };
          count++;
        }
      });
    }
    res.json({ success: true, message: `${count} objetos actualizados en el diccionario` });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Helper to strip Ethernet / IP / TCP headers if a full Wireshark frame was copied
function extractTcpPayload(buffer: Buffer): { payload: Buffer; strippedHeaders: string; isUnityProtobuf: boolean } {
  let buf = buffer;
  let headersInfo = 'Payload TCP directo';

  // Check if starts with Ethernet header (MAC dst [6] + MAC src [6] + EtherType [2] = 14 bytes)
  // IPv4 EtherType is 0x0800
  if (buf.length > 54 && buf[12] === 0x08 && buf[13] === 0x00 && (buf[14] >> 4) === 4) {
    const ipHeaderLen = (buf[14] & 0x0f) * 4;
    const protocol = buf[23]; // 6 = TCP
    if (protocol === 6) {
      const tcpOffset = 14 + ipHeaderLen;
      if (buf.length > tcpOffset + 12) {
        const tcpDataOffset = (buf[tcpOffset + 12] >> 4) * 4;
        const totalHeaderLen = tcpOffset + tcpDataOffset;
        if (buf.length > totalHeaderLen) {
          buf = buf.subarray(totalHeaderLen);
          headersInfo = `Cabecera Ethernet (14B) + IPv4 (${ipHeaderLen}B) + TCP (${tcpDataOffset}B) removidas automáticamente`;
        }
      }
    }
  }

  // Check for Protobuf Ankama type signature (ASCII "type.ankama.com/")
  const str = buf.toString('latin1');
  const isUnityProtobuf = str.includes('type.ankama.com/');

  return { payload: buf, strippedHeaders: headersInfo, isUnityProtobuf };
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
    if (shift > 35) break; // protect against overflow
  }

  return { value: result, bytesRead };
}

// Helper to parse Dofus Unity Protobuf Market Price Message (type.ankama.com/kbt)
function parseUnityMarketProtobuf(buf: Buffer) {
  try {
    const str = buf.toString('latin1');
    const typeIndex = str.indexOf('type.ankama.com/');
    if (typeIndex === -1) return null;

    const nullOrEnd = str.indexOf('\x12', typeIndex);
    const typeUri = str.substring(typeIndex, nullOrEnd !== -1 ? nullOrEnd : typeIndex + 25);

    let offset = typeIndex + typeUri.length;
    let itemId: number | null = null;
    const prices: number[] = [];

    // Scan for varints and sub-payloads
    while (offset < buf.length) {
      const tagByte = buf[offset];
      offset++;
      const fieldNum = tagByte >> 3;
      const wireType = tagByte & 7;

      if (wireType === 0) { // Varint
        const { value, bytesRead } = decodeVarInt(buf, offset);
        offset += bytesRead;
        // In kbt message, Tag 2 is often the Item GID (11118, 11219, etc.)
        if (fieldNum === 2 && !itemId && value > 0 && value < 100000) {
          itemId = value;
        } else if (fieldNum === 5 && !itemId && value > 0 && value < 100000) {
          itemId = value;
        }
      } else if (wireType === 2) { // Length-delimited
        const { value: len, bytesRead } = decodeVarInt(buf, offset);
        offset += bytesRead;
        const subBuf = buf.subarray(offset, offset + len);
        offset += len;

        // Inspect inside submessage for prices (Tag 32 = field 6 wireType 2 / packed prices or repeated varints)
        let subOff = 0;
        while (subOff < subBuf.length) {
          const subTag = subBuf[subOff];
          subOff++;
          const subWire = subTag & 7;
          const subField = subTag >> 3;

          if (subWire === 0) {
            const { value: varVal, bytesRead: bR } = decodeVarInt(subBuf, subOff);
            subOff += bR;
            if (subField === 5 && !itemId) itemId = varVal;
            if (subField === 2 && !itemId && varVal > 0) itemId = varVal;
          } else if (subWire === 2) {
            const { value: pLen, bytesRead: pBR } = decodeVarInt(subBuf, subOff);
            subOff += pBR;
            const priceBlock = subBuf.subarray(subOff, subOff + pLen);
            subOff += pLen;

            // Extract all varints inside price block
            let pOff = 0;
            while (pOff < priceBlock.length) {
              const { value: pVal, bytesRead: pR } = decodeVarInt(priceBlock, pOff);
              if (pR === 0) break;
              pOff += pR;
              if (pVal > 0) prices.push(pVal);
            }
          } else {
            break;
          }
        }
      } else {
        offset++;
      }
    }

    return {
      typeUri,
      itemId,
      prices
    };
  } catch (e) {
    return null;
  }
}

// POST /api/packet/analyze (AI Hex Analysis + Local Protobuf Dissector)
app.post('/api/packet/analyze', async (req, res) => {
  try {
    const { hex, protocolType } = req.body;

    if (!hex || typeof hex !== 'string') {
      return res.status(400).json({ error: 'Debes proporcionar una cadena hexadecimal.' });
    }

    const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length < 4) {
      return res.status(400).json({ error: 'La cadena hexadecimal es demasiado corta (mínimo 2 bytes = 4 caracteres hex).' });
    }

    const initialBuffer = Buffer.from(cleanHex, 'hex');
    const { payload: rawBytes, strippedHeaders, isUnityProtobuf } = extractTcpPayload(initialBuffer);

    let msgId = 0;
    let lenType = 0;
    let bodyLength = rawBytes.length;
    let headerLength = 2;
    let unityParsed = null;
    let detectedItemName = '';

    if (isUnityProtobuf) {
      unityParsed = parseUnityMarketProtobuf(rawBytes);
      if (unityParsed?.itemId) {
        detectedItemName = store.dictionary[unityParsed.itemId]?.name || `Objeto #${unityParsed.itemId}`;
      }
    } else if (rawBytes.length >= 2) {
      const headerWord = rawBytes.readUInt16BE(0);
      msgId = headerWord >> 2;
      lenType = headerWord & 3;

      if (lenType === 0) {
        bodyLength = 0;
      } else if (lenType === 1 && rawBytes.length >= 3) {
        bodyLength = rawBytes.readUInt8(2);
        headerLength = 3;
      } else if (lenType === 2 && rawBytes.length >= 4) {
        bodyLength = rawBytes.readUInt16BE(2);
        headerLength = 4;
      } else if (lenType === 3 && rawBytes.length >= 5) {
        bodyLength = (rawBytes.readUInt8(2) << 16) | rawBytes.readUInt16BE(3);
        headerLength = 5;
      }
    }

    // Try AI generation with Gemini if key is provided, or provide comprehensive local explanation
    let aiExplanation = '';

    const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'dummy_key';

    if (hasGeminiKey) {
      try {
        const ai = getGeminiClient();
        const prompt = `Analiza este volcado hexadecimal de red de Dofus (Unity/Protobuf o Dofus 2):
Hexadecimal Payload: "${rawBytes.toString('hex')}"
Protocolo: ${isUnityProtobuf ? 'Dofus Unity (Google Protocol Buffers / Ankama URI)' : 'Dofus Clásico (Big-Endian TCP)'}
${unityParsed ? `Datos detectados: URI=${unityParsed.typeUri}, ItemID=${unityParsed.itemId} (${detectedItemName}), Precios=${JSON.stringify(unityParsed.prices)}` : ''}

Por favor genera:
1. Diagnóstico de estructura (Cabeceras Ethernet/IP removidas, tipo de paquete detectado, campos clave).
2. Código Python conciso para Scapy que filtre este mensaje y envíe los datos a la API.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
        });

        aiExplanation = response.text || '';
      } catch (aiErr) {
        // Fallback to local
      }
    }

    if (!aiExplanation) {
      if (isUnityProtobuf) {
        aiExplanation = `📦 Protocolo Detectado: Dofus Unity (Google Protocol Buffers)\n` +
          `• Mensaje URI: ${unityParsed?.typeUri || 'type.ankama.com/kbt'}\n` +
          `• Item ID decodificado: ${unityParsed?.itemId || 'Detectado'} ${detectedItemName ? `(${detectedItemName})` : ''}\n` +
          `• Precios brutos encontrados: ${unityParsed?.prices && unityParsed.prices.length > 0 ? unityParsed.prices.join(', ') + ' Kamas' : 'Detectando en payload'}\n` +
          `• Diagnóstico de Frame: ${strippedHeaders}\n\n` +
          `💡 En Dofus Unity, Ankama migró el protocolo a Protocol Buffers (google.protobuf.Any). Los mensajes del mercadillo llevan el prefijo 'type.ankama.com/kbt'. Scapy extrae el payload con packet[TCP].payload y con el script en la pestaña 'Scripts Python' puedes enviarlo directamente a la API.`;
      } else {
        aiExplanation = `📦 Protocolo Detectado: Dofus Clásico (Big-Endian)\n` +
          `• Message ID: ${msgId} (0x${msgId.toString(16).toUpperCase()})\n` +
          `• Length Type: ${lenType} (${lenType} bytes para longitud)\n` +
          `• Longitud del cuerpo: ${bodyLength} bytes\n` +
          `• Diagnóstico de Frame: ${strippedHeaders}`;
      }
    }

    res.json({
      success: true,
      messageId: msgId,
      lengthType: lenType,
      payloadLength: bodyLength,
      rawLength: rawBytes.length,
      isUnityProtobuf,
      detectedItem: unityParsed ? {
        id: unityParsed.itemId,
        name: detectedItemName,
        prices: unityParsed.prices
      } : null,
      headerHex: rawBytes.subarray(0, Math.min(headerLength, rawBytes.length)).toString('hex'),
      payloadHex: rawBytes.subarray(headerLength).toString('hex'),
      strippedHeaders,
      explanation: aiExplanation
    });
  } catch (error: any) {
    console.error('Error analizando paquete:', error);
    res.status(500).json({ error: error?.message || 'Error analizando paquete' });
  }
});

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
    console.log(`[Dofus Sniffer Server] Corriendo en http://localhost:${PORT}`);
  });
}

startServer();
