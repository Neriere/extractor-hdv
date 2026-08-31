import React, { useState } from 'react';
import { Radio, Copy, Check, Terminal, Database, Activity, Code2, PlayCircle, ShieldCheck } from 'lucide-react';
import { ServerStats } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: ServerStats | null;
  appUrl: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, stats, appUrl }) => {
  const [copied, setCopied] = useState(false);

  const fullApiUrl = stats?.apiEndpointUrl || `${appUrl}/api/precios`;

  const copyApiUrl = () => {
    navigator.clipboard.writeText(fullApiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'feed', label: 'Mercadillo en Vivo', icon: Activity, badge: stats?.activeItemsCount },
    { id: 'hex', label: 'Inspector Hex & Protocolo', icon: Terminal },
    { id: 'scripts', label: 'Scripts Python & Scapy', icon: Code2 },
    { id: 'dictionary', label: 'Diccionario D2O / D2I', icon: Database },
    { id: 'simulator', label: 'Simulador de Envíos', icon: PlayCircle }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      {/* Top Banner / Status Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-3 border-b border-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold shadow-sm">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">Dofus Market Sniffer Hub</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  API Activa
                </span>
              </div>
              <p className="text-xs text-slate-400 font-normal">Receptor de paquetes Scapy, deserializador binario y base de datos de precios</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 gap-2 max-w-full overflow-hidden">
              <span className="text-slate-500 font-sans font-medium">Endpoint:</span>
              <code className="text-amber-300 truncate max-w-[240px] sm:max-w-xs">{fullApiUrl}</code>
              <button
                id="copy-api-url-btn"
                onClick={copyApiUrl}
                title="Copiar URL para el script de Python"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Paquetes:</span>
                <span className="font-semibold text-slate-200 font-mono">{stats?.totalPacketsReceived || 0}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-slate-400">Objetos:</span>
                <span className="font-semibold text-slate-200 font-mono">{stats?.activeItemsCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 text-xs rounded-full font-mono ${
                    isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
