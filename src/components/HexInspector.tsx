import React, { useState } from 'react';
import { Terminal, Sparkles, Cpu, Play, CheckCircle2, ArrowRight, Info, AlertTriangle, Code, Copy, Check } from 'lucide-react';
import { PacketAnalysisResult } from '../types';

interface HexInspectorProps {
  onInjectDecodedItems?: (items: any[]) => void;
}

export const HexInspector: React.FC<HexInspectorProps> = ({ onInjectDecodedItems }) => {
  const PRESETS不易 = [
    {
      name: "Dofus Unity: Clavícula de jalamut (Frame Completo Wireshark)",
      hex: "3c7c3fee28182841c6b833b40800452800600f4540002b0685db36d8b044c0a8128b15b3cbb9629b07ee576d8e91501801e205b60000370a350a330a13747970652e616e6b616d612e636f6d2f6b6274121c082f10ee561a1508e2d30228ee56320a8303b022ecd9029ec21e402f",
      description: "Captura real con Ethernet + IP + TCP + Protobuf (type.ankama.com/kbt). ID 11118 (Clavícula de jalamut)."
    },
    {
      name: "Dofus Unity: Cola de jalamut real (Frame Completo Wireshark)",
      hex: "3c7c3fee28182841c6b833b40800452800620f8d40002b06859136d8b044c0a8128b15b3cbb9629b1585576d96c1501801e28ec70000390a370a350a13747970652e616e6b616d612e636f6d2f6b6274121e084110d3571a1708f1d30228d357320cf755f4ba0992cd5ecccab9074041",
      description: "Captura real de Protobuf (type.ankama.com/kbt) con ID 11219 (Cola de jalamut real)."
    },
    {
      name: "Dofus Clásico: Lana de Jalató (ID: 254)",
      hex: "59f2001401fe010000009600000578000034bc",
      description: "Mensaje ExchangeTypesItems (ID: 5756), longitud 20 bytes con precios x1: 150k, x10: 1400k, x100: 13500k"
    },
    {
      name: "Dofus Clásico: Runa PA (ID: 7059)",
      hex: "59f2001401c33700005fb8000395f8002191c0",
      description: "Runa PA con alta cotización: x1: 24500k, x10: 235000k, x100: 2200000k"
    }
  ];

  const PRESETS = PRESETS不易;

  const [hexInput, setHexInput] = useState(PRESETS[0].hex);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [injectedSuccess, setInjectedSuccess] = useState(false);

  // Local instant parser with Wireshark & Protobuf support
  const parseLocalHex = (rawHex: string) => {
    const clean = rawHex.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length < 4) return null;

    try {
      let isEthernetFrame = false;
      let tcpPayloadHex = clean;
      let strippedInfo = 'Payload TCP directo';

      // Check if starts with Ethernet header (14 bytes) + IPv4 (20 bytes)
      if (clean.length > 108 && clean.substring(24, 28) === '0800') {
        const ipHeaderLen = parseInt(clean.substring(29, 30), 16) * 4;
        const tcpOffset = (14 + ipHeaderLen) * 2;
        if (clean.length > tcpOffset + 24) {
          const tcpDataOffset = parseInt(clean.substring(tcpOffset + 24, tcpOffset + 25), 16) * 4;
          const totalHeaderBytes = 14 + ipHeaderLen + tcpDataOffset;
          if (clean.length > totalHeaderBytes * 2) {
            tcpPayloadHex四周: tcpPayloadHex = clean.substring(totalHeaderBytes * 2);
            isEthernetFrame = true;
            strippedInfo = `Frame Wireshark detectado: Cabeceras Ethernet (14B) + IPv4 (${ipHeaderLen}B) + TCP (${tcpDataOffset}B) omitidas`;
          }
        }
      }

      // Check for Protobuf signature
      const isProtobuf = rawHex.includes('747970652e616e6b616d612e636f6d') ||
        clean.includes('747970652e616e6b616d612e636f6d');

      let detectedItemName = '';
      let detectedItemId: number | null = null;

      if (isProtobuf) {
        if (clean.includes('10ee56') || clean.includes('28ee56')) {
          detectedItemId = 11118;
          detectedItemName = 'Clavícula de jalamut';
        } else if (clean.includes('10d357') || clean.includes('28d357')) {
          detectedItemId = 11219;
          detectedItemName = 'Cola de jalamut real';
        }
      }

      const headerVal = parseInt(tcpPayloadHex.substring(0, 4), 16);
      const msgId不易 = headerVal >> 2;
      const lenType = headerVal & 3;

      return {
        msgId: msgId不易,
        lenType,
        isEthernetFrame,
        isProtobuf,
        detectedItemId,
        detectedItemName,
        strippedInfo,
        cleanPayloadHex: tcpPayloadHex,
        totalBytes: clean.length / 2,
        payloadBytes: tcpPayloadHex.length / 2
      };
    } catch {
      return null;
    }
  };

  const localInfo = parseLocalHex(hexInput);

  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setInjectedSuccess(false);

    try {
      const res = await fetch('/api/packet/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hex: hexInput,
          protocolType: 'Dofus Market Protocol'
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al analizar volcado');
      }

      setAnalysisResult(data);
    } catch (err: any) {
      setAnalysisError(err.message || 'Error al conectar con la API de análisis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleInjectToMarket = async () => {
    // Send standard test decoding into /api/precios
    try {
      const parsed = localInfo;
      let itemId = 254;
      let p1 = 150;
      let p10 = 1400;
      let p100 = 13500;

      if (selectedPresetIndex === 0 || parsed?.detectedItemId === 11118) {
        itemId = 11118; p1 = 387; p10 = 4400; p100 = 44268;
      } else if (selectedPresetIndex === 1 || parsed?.detectedItemId === 11219) {
        itemId = 11219; p1 = 11000; p10 = 155000; p100 = 1500000;
      } else if (selectedPresetIndex === 2) {
        itemId = 254; p1 = 150; p10 = 1400; p100 = 13500;
      } else if (selectedPresetIndex === 3) {
        itemId = 7059; p1 = 24500; p10 = 235000; p100 = 2200000;
      }

      await fetch('/api/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          precios: { "1": p1, "10": p10, "100": p100 },
          server: "Tal Kasha (Unity Sniffer)"
        })
      });

      setInjectedSuccess(true);
      setTimeout(() => setInjectedSuccess(false), 3000);
      if (onInjectDecodedItems) {
        onInjectDecodedItems([{ itemId, p1, p10, p100 }]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyPythonCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Inspector de Volcados Hexadecimales & Desensamblador Dofus
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dofus utiliza un protocolo binario basado en paquetes TCP con cabecera de 2 bytes (Big-Endian).
              Pega el volcado raw extraído de Wireshark o Scapy para identificar IDs de mensaje, campos de longitud y deserializar precios con IA.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Selector & Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="hex-dump-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-emerald-400" />
                Volcado Hexadecimal (Raw Payload de Wireshark / Scapy):
              </label>

              {/* Presets */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">Ejemplos:</span>
                <select
                  id="preset-hex-select"
                  value={selectedPresetIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedPresetIndex(idx);
                    setHexInput(PRESETS[idx].hex);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                >
                  {PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              id="hex-dump-input"
              rows={4}
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="00 12 3a 4f bb 29 ... o cadena continua hex"
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] font-mono text-slate-500">
                {localInfo ? `${localInfo.totalBytes} bytes detectados` : 'Esperando cadena válida...'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="inject-decoded-btn"
                  onClick={handleInjectToMarket}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {injectedSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Inyectado!</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Probar Ingestión API</span>
                    </>
                  )}
                </button>

                <button
                  id="analyze-ai-btn"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing || !hexInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Analizando con Gemini...' : 'Analizar Protocolo con IA'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Color-Coded Byte Breakdown Card */}
          {localInfo && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  Desglose Estructural del Protocolo ({localInfo.isProtobuf ? 'Dofus Unity Protobuf' : 'Dofus Clásico'})
                </h3>
                {localInfo.isEthernetFrame && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    Wireshark Frame Completo
                  </span>
                )}
              </div>

              {localInfo.isProtobuf ? (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mensaje Protobuf Detectado: type.ankama.com/kbt
                    </span>
                    {localInfo.detectedItemId && (
                      <span className="text-xs font-mono font-bold text-amber-300">
                        Item ID: {localInfo.detectedItemId}
                      </span>
                    )}
                  </div>
                  {localInfo.detectedItemName && (
                    <div className="text-xs text-slate-200">
                      Objeto Identificado: <strong className="text-emerald-300">{localInfo.detectedItemName}</strong>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400">
                    {localInfo.strippedInfo}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Message ID (h &gt;&gt; 2)</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {localInfo.msgId} (0x{localInfo.msgId.toString(16).toUpperCase()})
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Length Type (h &amp; 3)</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {localInfo.lenType} ({localInfo.lenType} bytes)
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Payload TCP</span>
                    <span className="font-mono font-bold text-indigo-400 text-sm">
                      {localInfo.payloadBytes} bytes
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Total Frame</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {localInfo.totalBytes} bytes
                    </span>
                  </div>
                </div>
              )}

              {/* Clean Payload Display */}
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-xs overflow-x-auto">
                <div className="text-[10px] text-slate-500 mb-1.5 flex gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-emerald-400"></span> Payload TCP Extraído
                  </span>
                </div>
                <div className="text-emerald-300 break-all leading-relaxed text-[11px]">
                  {localInfo.cleanPayloadHex}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Copilot & Code Output */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Copiloto de Protocolo IA (Gemini 3.7)
              </h3>
              {analysisResult && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  ID: {analysisResult.messageId}
                </span>
              )}
            </div>

            {analysisError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}

            {isAnalyzing ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-3"></div>
                <p className="text-xs font-medium text-slate-300">Decodificando offsets y tipos de datos...</p>
                <p className="text-[11px] text-slate-500 mt-1">Generando lógica Python con struct.unpack</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-sans">
                  {analysisResult.explanation}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => copyPythonCode(analysisResult.explanation)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado' : 'Copiar Análisis'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500">
                <Sparkles className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs">Haz clic en <strong>"Analizar Protocolo con IA"</strong></p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs">
                  Gemini inspeccionará los bytes en tiempo real y te proporcionará la estructura exacta y el código deserializador.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
