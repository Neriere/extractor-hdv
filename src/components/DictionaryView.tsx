import React, { useState, useRef } from 'react';
import { Database, Search, Upload, Download, Plus, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { ItemDictionaryEntry } from '../types';

interface DictionaryViewProps {
  dictionary: Record<number, ItemDictionaryEntry>;
  onUpdateDictionary: (newEntries: Record<string, any>) => Promise<void>;
  onRefresh: () => void;
}

export const DictionaryView: React.FC<DictionaryViewProps> = ({
  dictionary,
  onUpdateDictionary,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Recurso');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dictList: ItemDictionaryEntry[] = Object.values(dictionary);

  const filteredList = dictList.filter((item: ItemDictionaryEntry) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.id).includes(searchTerm) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      await onUpdateDictionary(json);
      setStatusMessage(`¡Éxito! Diccionario importado con ${Object.keys(json).length} objetos.`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage(`Error importando JSON: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = Number(newId.trim());
    if (!idNum || !newName.trim()) return;

    await onUpdateDictionary({
      [idNum]: {
        id: idNum,
        name: newName.trim(),
        category: newCategory
      }
    });

    setNewId('');
    setNewName('');
    setShowAddForm(false);
    setStatusMessage(`Objeto ${newName} (ID: ${idNum}) agregado correctamente.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportJson = () => {
    // Generate simple { "254": "Lana de Jalató", ... } format compatible with Python
    const exportMap: Record<string, string> = {};
    (Object.values(dictionary) as ItemDictionaryEntry[]).forEach(item => {
      exportMap[String(item.id)] = item.name;
    });

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportMap, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "id_to_name.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-100">
                Mapeo Estático D2O / D2I (ID Numérico ↔ Nombre en Español)
              </h2>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                <button
                  id="import-d2o-json-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Importar id_to_name.json</span>
                </button>

                <button
                  id="export-d2o-json-btn"
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar id_to_name.json</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              El protocolo de red de Dofus transmite identificadores numéricos en lugar de texto plano (ej. ID: 254 = Lana de Jalató).
              Este diccionario traduce automáticamente los IDs en tiempo real cuando el sniffer de Scapy intercepta los paquetes.
            </p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Control bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              id="search-dictionary-input"
              placeholder="Buscar por ID o Nombre (ej: 7059 o Runa PA)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Objeto Manual</span>
            </button>
            <button
              onClick={onRefresh}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-colors"
              title="Refrescar diccionario"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Add Manual Form */}
        {showAddForm && (
          <form onSubmit={handleAddManual} className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">ID Numérico (ej: 254)</label>
              <input
                type="number"
                required
                placeholder="254"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Nombre en Español</label>
              <input
                type="text"
                required
                placeholder="Lana de Jalató"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Categoría</label>
              <input
                type="text"
                placeholder="Recurso / Cereal / Runa"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Guardar Objeto
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Dictionary Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-200">
            Diccionario Activo ({filteredList.length} objetos)
          </span>
          <span className="text-slate-500 font-mono">
            {dictList.length} mapeados en memoria
          </span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-medium z-10">
              <tr>
                <th className="py-2.5 px-4">ID de Objeto</th>
                <th className="py-2.5 px-3">Nombre en Español</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Nivel</th>
                <th className="py-2.5 px-4 text-slate-500">Descripción / Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-slate-300">
              {filteredList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-4 font-mono text-cyan-400 font-bold">
                    {item.id}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-200">
                    {item.name}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-400 text-xs">
                    {item.level ? `Nvl. ${item.level}` : '—'}
                  </td>
                  <td className="py-2 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                    {item.description || 'Extraído de cliente Dofus'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
