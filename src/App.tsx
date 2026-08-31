/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { MarketTable } from './components/MarketTable';
import { SnifferPanel } from './components/SnifferPanel';
import { MarketItem, ServerStats } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'prices' | 'sniffer'>('prices');
  const [items, setItems] = useState<MarketItem[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const fetchMarketData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/precios');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Error cargando precios:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    fetchStats();

    // Sondeo periódico cada 3 segundos para refrescar automáticamente al capturar con Scapy
    const interval = setInterval(() => {
      fetchMarketData();
      fetchStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchMarketData, fetchStats]);

  const handleClearMarket = async () => {
    if (!confirm('¿Estás seguro de que deseas limpiar todos los precios capturados?')) {
      return;
    }
    try {
      const res = await fetch('/api/precios', { method: 'DELETE' });
      if (res.ok) {
        setItems([]);
        fetchStats();
      }
    } catch (err) {
      console.error('Error limpiando precios:', err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/precios/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.itemId !== itemId));
        fetchStats();
      }
    } catch (err) {
      console.error('Error eliminando item:', err);
    }
  };

  const handleExportJson = () => {
    window.location.href = '/api/precios/export';
  };

  const handleSendCustomPayload = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchMarketData();
        await fetchStats();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error enviando payload custom:', err);
      return false;
    }
  };

  const handleSendQuickTest = async () => {
    const sampleResource = {
      item_id: 11219,
      item: "Cola de Jalamut Real",
      type: "recurso",
      precios: {
        "1": 18,
        "10": 50,
        "100": 450,
        "1000": 4200
      },
      server: "Draconiros"
    };

    const sampleEquipment = {
      item_id: 8421,
      item: "Gelano",
      type: "equipable",
      precios: [150000, 155000, 160000, 175000, 190000],
      server: "Draconiros"
    };

    await handleSendCustomPayload([sampleResource, sampleEquipment]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        itemsCount={items.length}
        onClear={handleClearMarket}
        onExport={handleExportJson}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'prices' ? (
          <MarketTable
            items={items}
            onDeleteItem={handleDeleteItem}
            onRefresh={fetchMarketData}
            onSendQuickTest={handleSendQuickTest}
            isLoading={isLoading}
          />
        ) : (
          <SnifferPanel
            packetLogs={(stats as any)?.packetLogs || []}
            appUrl={appUrl}
            onSendCustomPayload={handleSendCustomPayload}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Dofus Market Sniffer • Receptor JSON y Captura Pasiva Scapy</span>
          <span className="font-mono text-[11px] text-slate-600">
            Receptor REST: POST http://localhost:3000/api/precios • Filtro: tcp port 5555
          </span>
        </div>
      </footer>
    </div>
  );
}
