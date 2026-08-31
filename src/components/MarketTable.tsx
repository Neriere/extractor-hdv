import React, { useState } from 'react';
import { Search, Filter, Trash2, ArrowUpDown, Clock, Sparkles, Coins, Package, Shield, Info, RefreshCw } from 'lucide-react';
import { MarketItem, ItemCategoryType } from '../types';

interface MarketTableProps {
  items: MarketItem[];
  onDeleteItem: (id: number) => void;
  onRefresh: () => void;
  onSendQuickTest: () => void;
  isLoading: boolean;
}

export const MarketTable: React.FC<MarketTableProps> = ({
  items,
  onDeleteItem,
  onRefresh,
  onSendQuickTest,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'recurso' | 'equipable'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'id' | 'avgPrice'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filtrado
  const filtered = items.filter(item => {
    const matchesSearch = 
      String(item.itemId).includes(searchTerm) ||
      (item.itemName && item.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || item.itemType === filterType;
    return matchesSearch && matchesType;
  });

  // Ordenación
  const sorted = [...filtered].sort((a, b) => {
    let comp = 0;
    if (sortBy === 'updated') {
      comp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    } else if (sortBy === 'id') {
      comp = a.itemId - b.itemId;
    } else if (sortBy === 'avgPrice') {
      comp = b.averagePrice - a.averagePrice;
    }
    return sortOrder === 'desc' ? comp : -comp;
  });

  const toggleSort = (column: 'updated' | 'id' | 'avgPrice') => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatKamas = (val: number) => {
    if (!val || val === 0) return '0 k';
    return `${val.toLocaleString()} k`;
  };

  const getTimeAgo = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 5) return 'justo ahora';
      if (diffSec < 60) return `hace ${diffSec}s`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `hace ${diffMin}m`;
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-900/70 rounded-xl border border-slate-800">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="input-search-items"
            type="text"
            placeholder="Buscar por ID de item o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Type Filter & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterType === 'all' ? 'bg-slate-800 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setFilterType('recurso')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterType === 'recurso' ? 'bg-slate-800 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recursos
            </button>
            <button
              onClick={() => setFilterType('equipable')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterType === 'equipable' ? 'bg-slate-800 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Equipables
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refrescar lista"
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lista de Items Capturados */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500">
            <Coins className="w-8 h-8 text-emerald-500/60 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">No hay precios capturados aún</h3>
          <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
            Inicia <code className="text-emerald-400 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">python sniffer_scapy.py</code> en tu PC para capturar paquetes mientras miras el mercadillo en Dofus, o envía una prueba rápida.
          </p>
          <button
            id="btn-quick-test-empty"
            onClick={onSendQuickTest}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4" />
            Enviar paquetes de prueba (Recursos y Equipable)
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400">
          No se encontraron items que coincidan con &ldquo;{searchTerm}&rdquo;
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-xs">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">
                    <span>ID / Item</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">
                  Precios Capturados (x1, x10, x100, x1000 / Ofertas)
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort('avgPrice')}>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-400 font-bold">PRECIO MEDIO</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-500" />
                  </div>
                </th>
                <th className="px-4 py-3">Mín / Máx</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort('updated')}>
                  <div className="flex items-center gap-1">
                    <span>Última Captura</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {sorted.map((item) => {
                const isResource = item.itemType === 'recurso';

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* ID & Name */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-950 font-bold text-amber-400 border border-slate-800 text-xs">
                          #{item.itemId}
                        </span>
                        <div className="font-sans font-semibold text-slate-100 text-sm">
                          {item.itemName || `Objeto ${item.itemId}`}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Servidor: {item.serverName} • {item.captureCount} captura(s)
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {isResource ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/50">
                          <Package className="w-3 h-3 text-cyan-400" />
                          Recurso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-amber-950/70 text-amber-300 border border-amber-800/50">
                          <Shield className="w-3 h-3 text-amber-400" />
                          Equipable ({item.totalOffers} ofertas)
                        </span>
                      )}
                    </td>

                    {/* Prices Breakdown */}
                    <td className="px-4 py-3.5">
                      {isResource ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* x1 */}
                          {item.pricesResource?.p1 ? (
                            <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-[11px]">
                              <span className="text-slate-400">x1:</span> <span className="text-emerald-400 font-semibold">{formatKamas(item.pricesResource.p1)}</span>
                            </div>
                          ) : null}

                          {/* x10 */}
                          {item.pricesResource?.p10 ? (
                            <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-[11px]">
                              <span className="text-slate-400">x10:</span> <span className="text-emerald-400 font-semibold">{formatKamas(item.pricesResource.p10)}</span>
                              <span className="text-[10px] text-slate-500 ml-1">({formatKamas(item.unitPrices?.u10 || 0)}/u)</span>
                            </div>
                          ) : null}

                          {/* x100 */}
                          {item.pricesResource?.p100 ? (
                            <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-[11px]">
                              <span className="text-slate-400">x100:</span> <span className="text-emerald-400 font-semibold">{formatKamas(item.pricesResource.p100)}</span>
                              <span className="text-[10px] text-slate-500 ml-1">({formatKamas(item.unitPrices?.u100 || 0)}/u)</span>
                            </div>
                          ) : null}

                          {/* x1000 */}
                          {item.pricesResource?.p1000 ? (
                            <div className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-[11px]">
                              <span className="text-slate-400">x1000:</span> <span className="text-emerald-400 font-semibold">{formatKamas(item.pricesResource.p1000)}</span>
                              <span className="text-[10px] text-slate-500 ml-1">({formatKamas(item.unitPrices?.u1000 || 0)}/u)</span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {item.pricesEquipment && item.pricesEquipment.length > 0 ? (
                            item.pricesEquipment.slice(0, 5).map((p, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[11px]"
                              >
                                {formatKamas(p)}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">Sin ofertas listadas</span>
                          )}
                          {item.pricesEquipment && item.pricesEquipment.length > 5 && (
                            <span className="text-[10px] text-slate-400 font-sans">
                              +{item.pricesEquipment.length - 5} más
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Calculated Average */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-bold text-sm shadow-sm">
                        <Coins className="w-3.5 h-3.5 text-emerald-400" />
                        {formatKamas(item.averagePrice)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {isResource ? 'Media unitaria de lotes' : `Media de ${item.totalOffers} ofertas`}
                      </div>
                    </td>

                    {/* Min / Max */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 text-xs">
                      <div><span className="text-slate-500 text-[10px]">Mín:</span> {formatKamas(item.minPrice)}</div>
                      <div><span className="text-slate-500 text-[10px]">Máx:</span> {formatKamas(item.maxPrice)}</div>
                    </td>

                    {/* Updated Time */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-xs font-sans">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{getTimeAgo(item.updatedAt)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => onDeleteItem(item.itemId)}
                        title="Eliminar este registro"
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
