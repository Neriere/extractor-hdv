import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, Play, Send, Activity, ShieldCheck, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { PacketLogEntry } from '../types';

interface SnifferPanelProps {
  packetLogs: PacketLogEntry[];
  appUrl: string;
  onSendCustomPayload: (payload: any) => Promise<boolean>;
}

export const SnifferPanel: React.FC<SnifferPanelProps> = ({
  packetLogs,
  appUrl,
  onSendCustomPayload
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const [testMode, setTestMode] = useState<'resource' | 'equipment' | 'custom'>('resource');
  
  // Custom JSON editor state
  const [customJson, setCustomJson] = useState<string>(
`{
  "item_id": 11219,
  "item": "Cola de Jalamut Real",
  "type": "recurso",
  "precios": {
    "1": 18,
    "10": 50,
    "100": 450,
    "1000": 4200
  },
  "server": "Draconiros"
}`
  );

  const pythonScriptCode = `#!/usr/bin/env python3
"""
Dofus Market Sniffer (Scapy - Pasivo y Seguro)
-----------------------------------------------
Captura pasivamente paquetes de red del mercadillo de Dofus (puerto TCP 5555)
sin inyección de paquetes ni modificaciones de memoria.

Envía la información capturada en formato JSON al endpoint REST:
  POST ${appUrl}/api/precios
"""

import sys
import time
import requests
from datetime import datetime

API_URL = "${appUrl}/api/precios"
DOFUS_PORTS = "tcp port 5555"

def log(msg, level="INFO"):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] [{level}] {msg}")

def send_to_api(payload):
    try:
        res = requests.post(API_URL, json=payload, timeout=0.5)
        if res.status_code == 200:
            data = res.json()
            log(f"-> Precios enviados a la API ({data.get('ingestedCount', 1)} items).", "OK")
    except requests.exceptions.ConnectionError:
        log("No se pudo conectar con la interfaz web en ${appUrl}", "ERR")
    except Exception as e:
        log(f"Error enviando payload: {e}", "ERR")

def process_packet(pkt):
    try:
        from scapy.all import TCP, Raw
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        payload = bytes(pkt[Raw].load)
        if len(payload) < 4:
            return
        if b"type.ankama.com/kbt" in payload or b"ankama" in payload:
            log(f"Paquete mercadillo detectado ({len(payload)} bytes). Enviando...", "SNIFF")
            send_to_api({
                "raw_hex": payload.hex(),
                "server": "Draconiros",
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        log(f"Error: {e}", "WARN")

def start_sniffing():
    try:
        from scapy.all import sniff
    except ImportError:
        log("Falta Scapy. Instálala con: pip install scapy requests", "ERR")
        sys.exit(1)

    print("=" * 60)
    print("  DOFUS MARKET SNIFFER (SCAPY)")
    print(f"  Filtro BPF: {DOFUS_PORTS}")
    print(f"  Destino API: {API_URL}")
    print("=" * 60)
    log("Escuchando tráfico en paralelo... (Abre el mercadillo en Dofus)")
    sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)

if __name__ == "__main__":
    start_sniffing()
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadPy = () => {
    const blob = new Blob([pythonScriptCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sniffer_scapy.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendTest = async (type: 'resource' | 'equipment' | 'custom') => {
    try {
      setIsSending(true);
      setSendSuccess(null);

      let payloadToSend: any;

      if (type === 'resource') {
        payloadToSend = {
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
      } else if (type === 'equipment') {
        payloadToSend = {
          item_id: 8421,
          item: "Gelano",
          type: "equipable",
          precios: [150000, 155000, 160000, 175000, 190000],
          server: "Draconiros"
        };
      } else {
        payloadToSend = JSON.parse(customJson);
      }

      const ok = await onSendCustomPayload(payloadToSend);
      if (ok) {
        setSendSuccess('¡Payload recibido y guardado con éxito!');
        setTimeout(() => setSendSuccess(null), 3000);
      }
    } catch (err: any) {
      alert('Error en formato JSON: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Columna Izquierda: Script Scapy & Guía Local (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Guía de Ejecución */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-slate-100">
                Guía de Ejecución de <code className="text-emerald-400 font-mono">sniffer_scapy.py</code>
              </h2>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Pasivo (Sin Inyección)
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            El script escucha pasivamente los paquetes TCP del puerto 5555 enviados por el servidor del juego y despacha los datos en formato JSON a esta interfaz web en <strong className="text-slate-200">http://localhost:3000/api/precios</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[11px]">1. Instalar dependencias</span>
              <div className="text-emerald-300 font-semibold select-all">
                pip install scapy requests
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[11px]">2. Ejecutar en paralelo</span>
              <div className="text-emerald-300 font-semibold select-all">
                python sniffer_scapy.py
              </div>
            </div>
          </div>

          {/* Visualizador de Código Python */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <FileCode className="w-4 h-4 text-slate-400" />
                sniffer_scapy.py
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-py-code"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans transition-colors"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCode ? 'Copiado' : 'Copiar Código'}
                </button>
                <button
                  id="btn-download-py-code"
                  onClick={handleDownloadPy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Descargar .py
                </button>
              </div>
            </div>

            <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/90 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed selection:bg-emerald-500/30">
              {pythonScriptCode}
            </pre>
          </div>
        </div>

      </div>

      {/* Columna Derecha: Probador de JSON API & Registro en Vivo (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Probador / Ingestador Manual */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              Probar Receptor de la API (JSON)
            </h3>
            <span className="text-[10px] font-mono text-slate-500">POST /api/precios</span>
          </div>

          <p className="text-xs text-slate-400">
            Prueba cómo la interfaz procesa recursos (x1, x10, x100, x1000) o equipables y calcula el precio medio automáticamente:
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTestMode('resource');
                handleSendTest('resource');
              }}
              disabled={isSending}
              className="flex-1 py-2 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Play className="w-3 h-3 text-cyan-400" />
              Probar Recurso (x1/x10/x100/x1000)
            </button>

            <button
              onClick={() => {
                setTestMode('equipment');
                handleSendTest('equipment');
              }}
              disabled={isSending}
              className="flex-1 py-2 px-2.5 rounded-lg bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 border border-amber-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Play className="w-3 h-3 text-amber-400" />
              Probar Equipable (Lista Ofertas)
            </button>
          </div>

          {/* Editor JSON Personalizado */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Editor JSON de prueba</span>
              <button
                onClick={() => handleSendTest('custom')}
                disabled={isSending}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Send className="w-3 h-3" />
                Enviar JSON
              </button>
            </div>
            <textarea
              id="input-custom-json"
              rows={7}
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              className="w-full p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {sendSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sendSuccess}</span>
            </div>
          )}
        </div>

        {/* Registro de Paquetes en Tiempo Real */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Monitor de Paquetes Recibidos
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {packetLogs.length} eventos
            </span>
          </div>

          {packetLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800/80">
              Esperando paquetes de red desde Scapy o peticiones a <code className="text-slate-400">POST /api/precios</code>...
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {packetLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 text-xs font-mono space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-slate-400 font-sans">{log.source}</span>
                  </div>
                  <div className="text-emerald-300 font-sans font-medium">
                    {log.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
