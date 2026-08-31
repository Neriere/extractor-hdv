import React, { useState } from 'react';
import { Code2, Download, Copy, Check, Terminal, FileText, CheckCircle2, ShieldAlert, Zap, BookOpen } from 'lucide-react';
import { PYTHON_SCRIPTS } from '../data/pythonTemplates';

interface PythonScriptsViewProps {
  appUrl: string;
}

export const PythonScriptsView: React.FC<PythonScriptsViewProps> = ({ appUrl }) => {
  // Replace ais-dev- with ais-pre- for public access without Google authentication
  const defaultPublicUrl = appUrl.includes('ais-dev-') 
    ? appUrl.replace('ais-dev-', 'ais-pre-') 
    : appUrl;

  const [customApiUrl, setCustomApiUrl] = useState(defaultPublicUrl);
  const [selectedScript, setSelectedScript] = useState<'scapy' | 'd2o' | 'socket' | 'req'>('scapy');
  const [copied, setCopied] = useState(false);

  const scripts = {
    scapy: {
      name: 'sniffer_scapy.py',
      title: 'Sniffer Scapy + Reensamblaje TCP + API',
      content: PYTHON_SCRIPTS.scapy_sniffer(customApiUrl),
      desc: 'Intercepta paquetes TCP en puertos 5555/443, reensambla los fragmentos y envía los precios al servidor web mediante aiohttp asíncrono.'
    },
    d2o: {
      name: 'd2o_d2i_extractor.py',
      title: 'Extractor D2O/D2I (id_to_name.json)',
      content: PYTHON_SCRIPTS.d2o_parser(),
      desc: 'Lee los archivos Items.d2o y i18n_es.d2i de la carpeta de Dofus y exporta un archivo JSON con la traducción de todos los IDs a nombres en español.'
    },
    socket: {
      name: 'fast_socket_sniffer.py',
      title: 'Sniffer de Alta Velocidad (Pyshark)',
      content: PYTHON_SCRIPTS.fast_socket_sniffer(customApiUrl),
      desc: 'Alternativa rápida con Pyshark para evitar la pérdida de paquetes si te mueves velozmente entre categorías en el mercadillo.'
    },
    req: {
      name: 'requirements.txt',
      title: 'Dependencias de Python (requirements.txt)',
      content: PYTHON_SCRIPTS.requirements_txt,
      desc: 'Librerías necesarias: scapy, aiohttp, requests, pydofus, pyshark.'
    }
  };

  const current = scripts[selectedScript];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    element.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Code2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-100">
              Herramienta de Sniffing y Deserialización en Python 3
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Estos scripts corren en tu máquina local junto al cliente de Dofus. Capturan el tráfico del mercadillo en segundo plano,
              traducen los IDs binarios a nombres usando los archivos del juego y hacen <code className="text-emerald-400 font-mono">POST /api/precios</code> a este servidor web.
            </p>
          </div>
        </div>

        {/* API Endpoint Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">URL de Destino API:</span>
            <input
              type="text"
              value={customApiUrl}
              onChange={(e) => setCustomApiUrl(e.target.value)}
              placeholder="https://..."
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-emerald-400 font-mono text-xs w-72 sm:w-96 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCustomApiUrl('https://ais-pre-cx6exc4vq35bkdtxll42vs-826482666792.us-east1.run.app')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
            >
              URL Pública (ais-pre)
            </button>
            <button
              onClick={() => setCustomApiUrl('http://localhost:3000')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
            >
              Localhost (3000)
            </button>
          </div>
        </div>
      </div>

      {/* Auth Notice Box */}
      <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200/90 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-amber-300 block">¿Por qué falló la conexión con la URL ais-dev?...</strong>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            La URL privada de desarrollo (<code className="text-amber-300 font-mono">ais-dev-...</code>) requiere inicio de sesión en Google mediante navegador. 
            Para scripts externos de Python, debes usar la URL pública compartida:
          </p>
          <div className="bg-slate-950 p-2 rounded border border-amber-500/20 font-mono text-emerald-300 text-[11px] flex items-center justify-between">
            <span>python sniffer.py https://ais-pre-cx6exc4vq35bkdtxll42vs-826482666792.us-east1.run.app/api/precios</span>
          </div>
        </div>
      </div>

      {/* Script Selector Tabs & Action Buttons */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedScript('scapy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScript === 'scapy'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              1. sniffer_scapy.py
            </button>
            <button
              onClick={() => setSelectedScript('d2o')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScript === 'd2o'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              2. d2o_d2i_extractor.py
            </button>
            <button
              onClick={() => setSelectedScript('socket')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScript === 'socket'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              3. fast_socket_sniffer.py
            </button>
            <button
              onClick={() => setSelectedScript('req')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScript === 'req'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              requirements.txt
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              id="copy-script-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Código'}</span>
            </button>

            <button
              id="download-script-btn"
              onClick={() => handleDownload(current.name, current.content)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar {current.name}</span>
            </button>
          </div>
        </div>

        {/* Script Description */}
        <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between">
          <span>{current.desc}</span>
          <span className="text-[11px] font-mono text-emerald-400/80">API URL preconfigurada</span>
        </div>

        {/* Code Editor Preview */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span>{current.name}</span>
            <span>Python 3.9+</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[480px] leading-relaxed select-all">
            {current.content}
          </pre>
        </div>
      </div>

      {/* Step-by-Step Setup Guide */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Guía de Puesta en Marcha Paso a Paso en Windows / Linux
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">1</span>
              Instalación de Npcap y Dependencias
            </div>
            <p className="text-slate-400 leading-relaxed">
              En Windows, descarga e instala <strong className="text-slate-200">Npcap</strong> asegurándote de marcar la casilla <em>"Install Npcap in WinPcap API-compatible Mode"</em>.
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-400">
              pip install -r requirements.txt
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">2</span>
              Extraer Diccionario de IDs (D2O/D2I)
            </div>
            <p className="text-slate-400 leading-relaxed">
              Ejecuta el script extractor para generar tu <strong className="text-slate-200">id_to_name.json</strong> local. El script buscará automáticamente tu carpeta de Dofus.
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-400">
              python d2o_d2i_extractor.py
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">3</span>
              Ejecutar Sniffer con Permisos
            </div>
            <p className="text-slate-400 leading-relaxed">
              Abre una terminal como Administrador (en Windows) o con sudo (en Linux) para permitir a Scapy acceder a la interfaz de red:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-400">
              python sniffer_scapy.py
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">4</span>
              Abrir Mercadillo en el Juego
            </div>
            <p className="text-slate-400 leading-relaxed">
              Ingresa al juego, abre el mercadillo de recursos, forjamagia o consumibles y haz clic en los objetos. Verás los precios aparecer en tiempo real en la pestaña <strong>Mercadillo en Vivo</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
