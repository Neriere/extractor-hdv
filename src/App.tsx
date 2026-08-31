/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { MarketplaceFeed } from './components/MarketplaceFeed';
import { HexInspector } from './components/HexInspector';
import { PythonScriptsView } from './components/PythonScriptsView';
import { DictionaryView } from './components/DictionaryView';
import { ApiSimulator } from './components/ApiSimulator';
import { MarketPriceData, ServerStats, ItemDictionaryEntry } from './types';
import { DEFAULT_ITEM_DICTIONARY } from './data/defaultItems';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('feed');
  const [marketItems, setMarketItems] = useState<MarketPriceData[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [dictionary, setDictionary] = useState<Record<number, ItemDictionaryEntry>>(DEFAULT_ITEM_DICTIONARY);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const fetchMarketData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/precios');
      if (res.ok) {
        const data = await res.json();
        setMarketItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching market items:', err);
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
      console.error('Error fetching server stats:', err);
    }
  }, []);

  const fetchDictionary = useCallback(async () => {
    try {
      const res = await fetch('/api/items/dictionary');
      if (res.ok) {
        const data = await res.json();
        setDictionary(data);
      }
    } catch (err) {
      console.error('Error fetching dictionary:', err);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    fetchStats();
    fetchDictionary();

    // Periodic polling every 4 seconds to catch new incoming packets from Scapy
    const interval = setInterval(() => {
      fetchMarketData();
      fetchStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchMarketData, fetchStats, fetchDictionary]);

  const handleClearMarket = async () => {
    try {
      const res = await fetch('/api/precios', { method: 'DELETE' });
      if (res.ok) {
        setMarketItems([]);
        fetchStats();
      }
    } catch (err) {
      console.error('Error clearing market:', err);
    }
  };

  const handleUpdateDictionary = async (newEntries: Record<string, any>) => {
    try {
      const res = await fetch('/api/items/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntries)
      });
      if (res.ok) {
        fetchDictionary();
      }
    } catch (err) {
      console.error('Error updating dictionary:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        appUrl={appUrl}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'feed' && (
          <MarketplaceFeed
            items={marketItems}
            onRefresh={fetchMarketData}
            onClear={handleClearMarket}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'hex' && (
          <HexInspector
            onInjectDecodedItems={() => {
              fetchMarketData();
              fetchStats();
            }}
          />
        )}

        {activeTab === 'scripts' && (
          <PythonScriptsView appUrl={appUrl} />
        )}

        {activeTab === 'dictionary' && (
          <DictionaryView
            dictionary={dictionary}
            onUpdateDictionary={handleUpdateDictionary}
            onRefresh={fetchDictionary}
          />
        )}

        {activeTab === 'simulator' && (
          <ApiSimulator
            dictionary={dictionary}
            onItemIngested={() => {
              fetchMarketData();
              fetchStats();
            }}
            appUrl={appUrl}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Dofus Market Sniffer & Protocol Studio • Python 3 & Scapy Companion Hub</span>
          <span className="font-mono text-[11px] text-slate-600">
            Receptor REST: POST /api/precios • Filtro BPF: tcp port 5555
          </span>
        </div>
      </footer>
    </div>
  );
}
