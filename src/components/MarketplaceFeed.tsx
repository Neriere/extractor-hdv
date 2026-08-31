import React, { useState } from 'react';
import { Search, Filter, RefreshCw, Trash2, ArrowUpRight, TrendingUp, TrendingDown, Clock, Layers, Sparkles, Download, Eye, ExternalLink, Zap } from 'lucide-react';
import { MarketPriceData } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface MarketplaceFeedProps {
  items: MarketPriceData[];
  onRefresh: () => void;
  onClear: () => void;
  isLoading: boolean;
  onSelectItem?: (item: MarketPriceData) => void;
}

export const MarketplaceFeed: React.FC<MarketplaceFeedProps> = ({
  items,
  onRefresh,
  onClear,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedServer, setSelectedServer] = useState('all');
  const [selectedItemForModal, setSelectedItemForModal] = useState<MarketPriceData | null>(null);

  const categories = [
    { id: 'all', label: 'Todas las Categorías' },
    { id: 'recurso', label: 'Recursos Generales' },
    { id: 'cereal', label: 'Cereales (Campesino)' },
    { id: 'mineral', label: 'Minerales (Minero)' },
    { id: 'madera', label: 'Maderas (Leñador)' },
    { id: 'runa', label: 'Runas de Forjamagia' },
    { id: 'jefe', label: 'Botín de Jefes' },
    { id: 'consumible', label: 'Consumibles y Pociones' }
  ];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(item.itemId).includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || item.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesServer = selectedServer === 'all' || item.serverName === selectedServer;
    return matchesSearch && matchesCategory && matchesServer;
  });

  const formatKamas = (amount: number) => {
    if (!amount || amount === 0) return '—';
    return new Intl.NumberFormat('es-ES').format(amount) + ' k';
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dofus_mercadillo_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Objetos Monitorizados</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{items.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Capturas procesadas</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Oportunidades de Ahorro</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {items.filter(i => i.arbitrageSavingPct > 10).length}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">&gt;10% descuento por lote</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Última Actualización</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-sm font-semibold text-slate-200 mt-2 font-mono truncate">
            {items[0]?.updatedAt ? new Date(items[0].updatedAt).toLocaleTimeString() : 'Esperando...'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Sincronización API</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Estado Sniffer</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-medium text-emerald-300">Esperando POST</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Puerto 5555 / 443</p>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              id="search-market-items"
              placeholder="Buscar por nombre o ID (ej. 254 o Lana)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                id="filter-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="refresh-market-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            <button
              id="export-market-json-btn"
              onClick={exportToJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              title="Exportar a JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>

            <button
              id="clear-market-btn"
              onClick={() => {
                if (confirm("¿Estás seguro de limpiar la lista de precios capturados?")) {
                  onClear();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition-colors"
              title="Limpiar registros"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items Table / Cards */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-200">
            Listado de Precios Extraídos ({filteredItems.length})
          </h2>
          <span className="text-xs text-slate-500">
            Formato: [ID Objeto] [x1] [x10] [x100] Kamas
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-500">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300">No hay objetos que coincidan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Inicia el script de Scapy o envía un paquete simulado desde la pestaña de simulador para poblar el mercadillo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-medium">
                  <th className="py-3 px-4">Objeto / ID</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3 text-right">Lote x1</th>
                  <th className="py-3 px-3 text-right">Lote x10</th>
                  <th className="py-3 px-3 text-right">Lote x100</th>
                  <th className="py-3 px-3 text-center">Mejor Precio/u</th>
                  <th className="py-3 px-3 text-right">Actualizado</th>
                  <th className="py-3 px-3 text-center">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedItemForModal(item)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-emerald-400">
                          {item.itemId % 99}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                            {item.itemName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">ID: {item.itemId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-200">
                      {formatKamas(item.price1)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-200">
                      <div>{formatKamas(item.price10)}</div>
                      {item.price10 > 0 && (
                        <div className="text-[10px] text-slate-500">
                          ({formatKamas(Math.round(item.unitPrice10))}/u)
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-200">
                      <div>{formatKamas(item.price100)}</div>
                      {item.price100 > 0 && (
                        <div className="text-[10px] text-slate-500">
                          ({formatKamas(Math.round(item.unitPrice100))}/u)
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {item.arbitrageSavingPct > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <TrendingDown className="w-3 h-3" />
                          x{item.bestUnitOption} (-{item.arbitrageSavingPct}%)
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">x{item.bestUnitOption}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemForModal(item);
                        }}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Ver histórico y JSON"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItemForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{selectedItemForModal.itemName}</h3>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                    ID: {selectedItemForModal.itemId}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedItemForModal.category} • Servidor: {selectedItemForModal.serverName || 'Dofus'}</p>
              </div>
              <button
                onClick={() => setSelectedItemForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Price Cards Summary */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-400 font-medium">Lote x1</span>
                <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                  {formatKamas(selectedItemForModal.price1)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Precio unitario base</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-400 font-medium">Lote x10</span>
                <div className="text-base font-bold text-cyan-400 font-mono mt-1">
                  {formatKamas(selectedItemForModal.price10)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {selectedItemForModal.unitPrice10 > 0 ? `${formatKamas(Math.round(selectedItemForModal.unitPrice10))}/u` : '—'}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-xs text-slate-400 font-medium">Lote x100</span>
                <div className="text-base font-bold text-indigo-400 font-mono mt-1">
                  {formatKamas(selectedItemForModal.price100)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {selectedItemForModal.unitPrice100 > 0 ? `${formatKamas(Math.round(selectedItemForModal.unitPrice100))}/u` : '—'}
                </div>
              </div>
            </div>

            {/* Unit Arbitrage Analysis */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 my-4">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Análisis de Arbitraje y Eficiencia de Compra
              </h4>
              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  • Mejor formato para comprar: <strong className="text-emerald-400 font-mono">Lote x{selectedItemForModal.bestUnitOption}</strong>.
                </p>
                {selectedItemForModal.arbitrageSavingPct > 0 ? (
                  <p className="text-amber-300">
                    • Comprar en lotes de {selectedItemForModal.bestUnitOption} ofrece un ahorro del <strong>{selectedItemForModal.arbitrageSavingPct}%</strong> por unidad comparado con la opción más cara.
                  </p>
                ) : (
                  <p className="text-slate-500">• Los precios unitarios son estables entre lotes.</p>
                )}
              </div>
            </div>

            {/* Price History Chart */}
            <div className="my-4">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Evolución Histórica de Precios</h4>
              <div className="h-48 w-full bg-slate-950 border border-slate-800 rounded-xl p-2">
                {selectedItemForModal.history && selectedItemForModal.history.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedItemForModal.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#64748b"
                        fontSize={10}
                      />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                        formatter={(val: number) => [`${formatKamas(val)}`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="price1" name="Precio x1" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="price10" name="Precio x10" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="price100" name="Precio x100" stroke="#818cf8" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Se requieren múltiples capturas para trazar el histórico temporal.
                  </div>
                )}
              </div>
            </div>

            {/* Raw JSON Payload */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-400">Payload JSON Recibido</span>
                <span className="text-[10px] text-slate-500 font-mono">POST /api/precios</span>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-36">
                {JSON.stringify(selectedItemForModal.rawPayload || selectedItemForModal, null, 2)}
              </pre>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedItemForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
