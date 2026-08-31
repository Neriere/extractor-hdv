import React from 'react';
import { Activity, Radio, Download, Trash2, ShieldCheck, Terminal, Layers } from 'lucide-react';
import { ServerStats } from '../types';

interface NavbarProps {
  activeTab: 'prices' | 'sniffer';
  setActiveTab: (tab: 'prices' | 'sniffer') => void;
  stats: ServerStats | null;
  itemsCount: number;
  onClear: () => void;
  onExport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  itemsCount,
  onClear,
  onExport,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-400 p-0.5 shadow-lg shadow-emerald-500/10">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  Dofus Market Sniffer
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Pasivo (Scapy)
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Receptor JSON • Recursos x1/x10/x100/x1000 & Equipables con Precio Medio
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800">
            <button
              id="tab-prices"
              onClick={() => setActiveTab('prices')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'prices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Precios Capturados
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'prices' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {itemsCount}
              </span>
            </button>

            <button
              id="tab-sniffer"
              onClick={() => setActiveTab('sniffer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'sniffer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Sniffer Scapy & API
              {stats?.lastIngestTime && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              id="btn-export-json"
              onClick={onExport}
              title="Descargar precios_capturados.json"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Exportar JSON
            </button>

            <button
              id="btn-clear-market"
              onClick={onClear}
              disabled={itemsCount === 0}
              title="Limpiar todos los precios guardados"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                itemsCount > 0
                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
                  : 'bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Limpiar</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
