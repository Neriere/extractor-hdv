import React, { useState } from 'react';
import { PlayCircle, Send, CheckCircle2, AlertCircle, Layers, ArrowRight, Activity, RotateCcw } from 'lucide-react';
import { ItemDictionaryEntry } from '../types';

interface ApiSimulatorProps {
  dictionary: Record<number, ItemDictionaryEntry>;
  onItemIngested: () => void;
  appUrl: string;
}

export const ApiSimulator: React.FC<ApiSimulatorProps> = ({
  dictionary,
  onItemIngested,
  appUrl
}) => {
  const [selectedItemId, setSelectedItemId] = useState<number>(254);
  const [price1, setPrice1] = useState<number>(180);
  const [price10, setPrice10] = useState<number>(1700);
  const [price100, setPrice100] = useState<number>(15500);
  const [serverName, setServerName] = useState<string>("Tal Kasha");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const currentItem = dictionary[selectedItemId] || { id: selectedItemId, name: `Objeto #${selectedItemId}`, category: "Recurso" };

  const buildPayload = () => {
    return {
      item: currentItem.name,
      item_id: selectedItemId,
      category: currentItem.category,
      precios: {
        "1": Number(price1),
        "10": Number(price10),
        "100": Number(price100)
      },
      server: serverName,
      timestamp: new Date().toISOString()
    };
  };

  const handleSendSingle = async () => {
    setIsSending(true);
    const start = performance.now();
    const payload = buildPayload();

    try {
      const res = await fetch('/api/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastResponse({
        status: res.status,
        statusText: res.statusText,
        data
      });

      onItemIngested();
    } catch (err: any) {
      setLastResponse({
        status: 500,
        error: err.message
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendBatch = async () => {
    setIsSending(true);
    const start = performance.now();

    const sampleItems = [
      { id: 254, name: "Lana de Jalató", p1: 160 + Math.floor(Math.random() * 20), p10: 1500, p100: 14000 },
      { id: 679, name: "Trigo", p1: 50 + Math.floor(Math.random() * 10), p10: 480, p100: 4500 },
      { id: 7059, name: "Runa PA", p1: 25000 + Math.floor(Math.random() * 1000), p10: 240000, p100: 2300000 },
      { id: 311, name: "Hierro", p1: 120 + Math.floor(Math.random() * 15), p10: 1100, p100: 10000 },
      { id: 1735, name: "Madera de Fresno", p1: 90 + Math.floor(Math.random() * 10), p10: 850, p100: 8000 }
    ];

    const batchPayload = sampleItems.map(item => ({
      item: item.name,
      item_id: item.id,
      category: dictionary[item.id]?.category || "Recurso",
      precios: {
        "1": item.p1,
        "10": item.p10,
        "100": item.p100
      },
      server: serverName,
      timestamp: new Date().toISOString()
    }));

    try {
      const res = await fetch('/api/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setLastResponse({
        status: res.status,
        statusText: res.statusText,
        data
      });

      onItemIngested();
    } catch (err: any) {
      setLastResponse({
        status: 500,
        error: err.message
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Simulador de Transmisiones de Paquetes Scapy
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Prueba la recepción del backend antes de correr tu script local. Envía paquetes con formato JSON idénticos a los generados por el sniffer de Scapy para verificar la persistencia y la visualización de datos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Controls */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Configuración del Paquete Simulado</span>
              <span className="text-slate-500 font-mono text-[11px]">POST /api/precios</span>
            </h3>

            {/* Select Item */}
            <div>
              <label htmlFor="sim-select-item" className="text-xs text-slate-400 block mb-1">Seleccionar Objeto del Mercadillo</label>
              <select
                id="sim-select-item"
                value={selectedItemId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedItemId(id);
                  // Set default sensible price hints
                  if (id === 254) { setPrice1(180); setPrice10(1700); setPrice100(15500); }
                  else if (id === 7059) { setPrice1(25000); setPrice10(240000); setPrice100(2300000); }
                  else if (id === 679) { setPrice1(50); setPrice10(480); setPrice100(4500); }
                }}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {(Object.values(dictionary) as ItemDictionaryEntry[]).map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.id}] {item.name} ({item.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Server selection */}
            <div>
              <label htmlFor="sim-server-name" className="text-xs text-slate-400 block mb-1">Servidor de Juego</label>
              <input
                type="text"
                id="sim-server-name"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Tal Kasha / Draconiros"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="sim-price-1" className="text-[11px] text-slate-400 block mb-1">Precio x1 (Kamas)</label>
                <input
                  type="number"
                  id="sim-price-1"
                  value={price1}
                  onChange={(e) => setPrice1(Number(e.target.value))}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="sim-price-10" className="text-[11px] text-slate-400 block mb-1">Precio x10 (Kamas)</label>
                <input
                  type="number"
                  id="sim-price-10"
                  value={price10}
                  onChange={(e) => setPrice10(Number(e.target.value))}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="sim-price-100" className="text-[11px] text-slate-400 block mb-1">Precio x100 (Kamas)</label>
                <input
                  type="number"
                  id="sim-price-100"
                  value={price100}
                  onChange={(e) => setPrice100(Number(e.target.value))}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                id="send-single-packet-btn"
                onClick={handleSendSingle}
                disabled={isSending}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Transmitiendo...' : 'Enviar Objeto Individual'}</span>
              </button>

              <button
                id="send-batch-packets-btn"
                onClick={handleSendBatch}
                disabled={isSending}
                className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                title="Envía una ráfaga de 5 items simulando navegación rápida"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Simular Lote (5 Items)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Traffic Inspector */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Monitor de Petición HTTP & Respuesta
              </h3>
              {latencyMs !== null && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 font-mono">
                  {latencyMs} ms
                </span>
              )}
            </div>

            {/* Request Payload */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-500">Payload Enviado:</span>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 max-h-36 overflow-y-auto leading-relaxed">
                {JSON.stringify(buildPayload(), null, 2)}
              </pre>
            </div>

            {/* Response Payload */}
            <div className="space-y-1 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-slate-500">Respuesta Servidor:</span>
                {lastResponse && (
                  <span className={`text-[10px] font-mono font-bold ${lastResponse.status === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    HTTP {lastResponse.status} {lastResponse.status === 200 ? 'OK' : 'ERROR'}
                  </span>
                )}
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-400/90 flex-1 overflow-y-auto max-h-48 leading-relaxed">
                {lastResponse ? JSON.stringify(lastResponse.data || lastResponse, null, 2) : '// Presiona "Enviar Objeto" para registrar la respuesta'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
