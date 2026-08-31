export const PYTHON_SCRIPTS = {
  scapy_sniffer: (apiUrl: string) => `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Dofus Market Packet Sniffer (Scapy + TCP Reassembly + Async API Dispatch)
=============================================================================
 Requisitos:
   pip install scapy requests aiohttp pydofus
   Instalar Npcap en Windows (marcar 'WinPcap API-compatible Mode')
"""

import sys
import os
import json
import struct
import asyncio
import aiohttp
from scapy.all import sniff, TCP, IP, Raw

# =============================================================================
# CONFIGURACIÓN
# =============================================================================
# NOTA: Usa la URL Pública Compartida (ais-pre-...) o tu localhost. 
# La URL ais-dev-... requiere inicio de sesión en Google y bloquea scripts externos.
DEFAULT_API_URL = "${apiUrl.replace('ais-dev-', 'ais-pre-')}/api/precios"
SERVER_API_URL = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_API_URL
SERVER_NAME = "Tal Kasha" # o tu servidor (Draconiros, Imagiro, etc.)
DOFUS_PORTS = "tcp port 5555 or tcp port 443"
DICTIONARY_FILE = "id_to_name.json"
LOCAL_OUTPUT_FILE = "precios_capturados.json"

# IDs conocidos de mensajes de mercadillo de Dofus (Protocolo Dofus 2 / Unity)
MSG_EXCHANGE_TYPES_ITEMS = 5752  # ExchangeTypesItemsExchangerDescriptionMessage
MSG_EXCHANGE_BID_PRICE   = 5755  # ExchangeBidPriceForSellerMessage
MSG_EXCHANGE_SEARCH_OK   = 5753  # ExchangeTypesExchangerDescriptionMessage

# Diccionario de IDs numéricos -> Nombres en Español
id_to_name = {}

# Buffer de reensamblaje TCP por flujo de conexión (IP:Puerto -> bytes)
tcp_streams = {}

# Cola asíncrona de envío a la API
send_queue = asyncio.Queue() if sys.version_info >= (3, 7) else None

# Registro local de items guardados
local_records = []

# =============================================================================
# CARGA DE DICCIONARIO ESTÁTICO (D2O / D2I)
# =============================================================================
def load_dictionary():
    global id_to_name
    if os.path.exists(DICTIONARY_FILE):
        try:
            with open(DICTIONARY_FILE, "r", encoding="utf-8") as f:
                id_to_name = json.load(f)
            print(f"[+] Diccionario cargado con {len(id_to_name)} objetos.")
        except Exception as e:
            print(f"[!] Error leyendo {DICTIONARY_FILE}: {e}")
    else:
        print(f"[*] Aviso: No se encontro {DICTIONARY_FILE}. Se usaran IDs numericos.")
        # Mapeo inicial por defecto
        id_to_name = {
            "254": "Lana de Jalató",
            "255": "Cuero de Jalató",
            "679": "Trigo",
            "7059": "Runa PA",
            "7060": "Runa PM",
            "1735": "Madera de Fresno",
            "311": "Hierro",
            "10842": "Ojo de Golosotrón Real"
        }

# =============================================================================
# DESERIALIZADOR UNIVERSAL (DOFUS UNITY PROTOBUF + DOFUS CLÁSICO)
# =============================================================================
def decode_varint(data: bytes, offset: int = 0):
    """Decodifica un VarInt estándar de Protobuf / Protocolo Dofus"""
    res = 0
    shift = 0
    bytes_read = 0
    while offset + bytes_read < len(data):
        b = data[offset + bytes_read]
        bytes_read += 1
        res |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
        if shift > 35:
            break
    return res, bytes_read

def parse_unity_protobuf_market(payload: bytes):
    """
    Decodifica paquetes de Dofus Unity (Google Protobuf Any)
    Firma típica: type.ankama.com/kbt (Mensaje de precios de mercadillo)
    """
    if b"type.ankama.com/kbt" not in payload:
        return []

    try:
        type_idx = payload.find(b"type.ankama.com/kbt")
        offset = type_idx + len(b"type.ankama.com/kbt")
        
        item_id = None
        prices = []

        while offset < len(payload):
            tag_byte = payload[offset]
            offset += 1
            field_num = tag_byte >> 3
            wire_type = tag_byte & 7

            if wire_type == 0: # Varint
                val, read_bytes = decode_varint(payload, offset)
                offset += read_bytes
                if (field_num == 2 or field_num == 5) and not item_id and 0 < val < 100000:
                    item_id = val
            elif wire_type == 2: # Length-delimited submessage
                length, read_bytes = decode_varint(payload, offset)
                offset += read_bytes
                sub_bytes = payload[offset:offset + length]
                offset += length

                # Escanear dentro del submensaje precios o subcampos
                sub_off = 0
                while sub_off < len(sub_bytes):
                    stag = sub_bytes[sub_off]
                    sub_off += 1
                    swire = stag & 7
                    sfield = stag >> 3
                    if swire == 0:
                        sval, sread = decode_varint(sub_bytes, sub_off)
                        sub_off += sread
                        if (sfield == 2 or sfield == 5) and not item_id and 0 < sval < 100000:
                            item_id = sval
                    elif swire == 2:
                        plen, pread = decode_varint(sub_bytes, sub_off)
                        sub_off += pread
                        pblock = sub_bytes[sub_off:sub_off + plen]
                        sub_off += plen
                        # Extraer varints de precios
                        poff = 0
                        while poff < len(pblock):
                            pval, pb_read = decode_varint(pblock, poff)
                            if pb_read == 0: break
                            poff += pb_read
                            if pval > 0: prices.append(pval)
                    else:
                        break
            else:
                offset += 1

        if item_id:
            p1 = prices[0] if len(prices) > 0 else 0
            p10 = prices[1] if len(prices) > 1 else 0
            p100 = prices[2] if len(prices) > 2 else 0
            name = id_to_name.get(str(item_id), f"Objeto #{item_id}")
            return [{
                "item": name,
                "item_id": item_id,
                "precios": {"1": p1, "10": p10, "100": p100},
                "server": SERVER_NAME
            }]
    except Exception as e:
        print(f"[!] Error decodificando Protobuf Unity: {e}")
    return []

class DofusReader:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    def read_byte(self) -> int:
        val = self.data[self.offset]
        self.offset += 1
        return val

    def read_short(self) -> int:
        val = struct.unpack_from(">h", self.data, self.offset)[0]
        self.offset += 2
        return val

    def read_ushort(self) -> int:
        val = struct.unpack_from(">H", self.data, self.offset)[0]
        self.offset += 2
        return val

    def read_int(self) -> int:
        val = struct.unpack_from(">i", self.data, self.offset)[0]
        self.offset += 4
        return val

    def read_uint(self) -> int:
        val = struct.unpack_from(">I", self.data, self.offset)[0]
        self.offset += 4
        return val

    def read_var_int(self) -> int:
        """Lee enteros de longitud variable (VarInt de Protocolo Dofus Clásico)"""
        val, r = decode_varint(self.data, self.offset)
        self.offset += r
        return val

    def has_remaining(self, count: int = 1) -> bool:
        return self.offset + count <= len(self.data)

def parse_dofus_packet(payload: bytes):
    """
    Decodifica el encabezado Dofus:
    - 2 bytes de cabecera:
        messageId = header >> 2
        lengthType = header & 3 (0=0b, 1=1b, 2=2b, 3=3b)
    """
    if len(payload) < 2:
        return None

    reader = DofusReader(payload)
    header = reader.read_ushort()
    msg_id = header >> 2
    len_type = header & 3

    # Determinar longitud del cuerpo
    if len_type == 0:
        body_len = 0
    elif len_type == 1:
        if not reader.has_remaining(1): return None
        body_len = reader.read_byte()
    elif len_type == 2:
        if not reader.has_remaining(2): return None
        body_len = reader.read_ushort()
    elif len_type == 3:
        if not reader.has_remaining(3): return None
        # 3 bytes Big-Endian
        b1, b2, b3 = reader.read_byte(), reader.read_byte(), reader.read_byte()
        body_len = (b1 << 16) | (b2 << 8) | b3
    else:
        return None

    if len(payload) < reader.offset + body_len:
        # Paquete fragmentado (esperar más bytes en stream)
        return None

    body = payload[reader.offset:reader.offset + body_len]
    return msg_id, body, reader.offset + body_len

def decode_market_payload(msg_id: int, body: bytes):
    """Extrae items y precios (x1, x10, x100) del payload del mercadillo"""
    parsed_items = []
    reader = DofusReader(body)

    try:
        if msg_id == MSG_EXCHANGE_TYPES_ITEMS or msg_id == MSG_EXCHANGE_SEARCH_OK:
            # Estructura típica:
            # objectGID (VarInt / UShort)
            # count (UShort)
            # lista de items con precios x1, x10, x100
            item_gid = reader.read_var_int() if reader.has_remaining(2) else 0
            
            # En mercadillos con múltiples ítems o lista de precios:
            p1, p10, p100 = 0, 0, 0
            if reader.has_remaining(4): p1 = reader.read_var_int()
            if reader.has_remaining(4): p10 = reader.read_var_int()
            if reader.has_remaining(4): p100 = reader.read_var_int()

            name = id_to_name.get(str(item_gid), f"Objeto #{item_gid}")
            parsed_items.append({
                "item": name,
                "item_id": item_gid,
                "precios": {
                    "1": max(0, p1),
                    "10": max(0, p10),
                    "100": max(0, p100)
                },
                "server": SERVER_NAME
            })

        # También escanear patrones repetitivos de precios si el paquete contiene lote
        while reader.has_remaining(12):
            try:
                gid = reader.read_var_int()
                p1 = reader.read_var_int()
                p10 = reader.read_var_int()
                p100 = reader.read_var_int()
                if gid > 0 and (p1 > 0 or p10 > 0 or p100 > 0):
                    name = id_to_name.get(str(gid), f"Objeto #{gid}")
                    parsed_items.append({
                        "item": name,
                        "item_id": gid,
                        "precios": {"1": p1, "10": p10, "100": p100},
                        "server": SERVER_NAME
                    })
            except Exception:
                break

    except Exception as e:
        print(f"[!] Error decodificando estructura del mensaje {msg_id}: {e}")

    return parsed_items

# =============================================================================
# DISPATCHER ASÍNCRONO HTTP A TU SERVIDOR WEB Y LOG LOCAL
# =============================================================================
def save_local_record(item_data):
    """Guarda una copia en el archivo JSON local en tu disco duro"""
    try:
        local_records.append(item_data)
        with open(LOCAL_OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(local_records, f, indent=2, ensure_ascii=False)
    except Exception as e:
        pass

async def api_worker(session: aiohttp.ClientSession):
    while True:
        payload = await send_queue.get()
        item_name = payload.get("item", payload.get("item_id", "Objeto"))
        p1 = payload['precios'].get('1', 0)
        p10 = payload['precios'].get('10', 0)
        p100 = payload['precios'].get('100', 0)

        # 1. Registro visual inmediato en la terminal
        print(f"[🔥 SNIFFED] {item_name} (ID: {payload.get('item_id')}) -> 1x:{p1}k | 10x:{p10}k | 100x:{p100}k")
        save_local_record(payload)

        # 2. Despacho HTTP hacia el servidor
        try:
            async with session.post(SERVER_API_URL, json=payload, timeout=5) as resp:
                content_type = resp.headers.get("Content-Type", "")
                if resp.status in (200, 201) and "json" in content_type:
                    print(f"    └── [✓] Sincronizado con API Web ({item_name})")
                elif "html" in content_type:
                    print(f"    └── [!] ALERTA: La URL {SERVER_API_URL} redirigió a login de Google.")
                    print(f"        👉 Solución: Usa la URL pública compartida (ais-pre-...) o corre en localhost.")
                else:
                    print(f"    └── [!] Error HTTP {resp.status} al enviar a {SERVER_API_URL}")
        except Exception as e:
            print(f"    └── [!] Error enviando a API ({SERVER_API_URL}): {e}")
        finally:
            send_queue.task_done()

# =============================================================================
# CALLBACK DE SCAPY (MANEJO DE REENSAMBLAJE TCP)
# =============================================================================
loop = asyncio.get_event_loop() if sys.platform != "win32" else asyncio.ProactorEventLoop()

def packet_callback(packet):
    if not packet.haslayer(TCP) or not packet.haslayer(Raw):
        return

    # Extraer payload TCP
    payload = bytes(packet[TCP].payload)
    if not payload:
        return

    # 1. Chequeo directo para Dofus Unity (Google Protobuf)
    if b"type.ankama.com/" in payload:
        unity_items = parse_unity_protobuf_market(payload)
        for itm in unity_items:
            if send_queue:
                loop.call_soon_threadsafe(send_queue.put_nowait, itm)
        return

    # 2. Dofus Clásico (TCP Reassembly & Big-Endian Framed)
    stream_key = f"{packet[IP].src}:{packet[TCP].sport}->{packet[IP].dst}:{packet[TCP].dport}"
    
    if stream_key not in tcp_streams:
        tcp_streams[stream_key] = bytearray()
    
    tcp_streams[stream_key].extend(payload)
    buffer = tcp_streams[stream_key]

    while len(buffer) >= 2:
        parsed = parse_dofus_packet(bytes(buffer))
        if parsed is None:
            break

        msg_id, body_bytes, consumed_bytes = parsed
        del buffer[:consumed_bytes]

        items = decode_market_payload(msg_id, body_bytes)
        for itm in items:
            if send_queue:
                loop.call_soon_threadsafe(send_queue.put_nowait, itm)

def main():
    print("=" * 70)
    print(" Dofus Market Sniffer - Captura activa")
    print(f" Destino API: {SERVER_API_URL}")
    print(f" Filtro BPF : {DOFUS_PORTS}")
    print("=" * 70)
    load_dictionary()

    async def run():
        async with aiohttp.ClientSession() as session:
            # Lanzar workers de envio HTTP
            for _ in range(3):
                asyncio.create_task(api_worker(session))

            # Ejecutar sniff en un hilo separado
            import threading
            sniff_thread = threading.Thread(
                target=lambda: sniff(
                    filter=DOFUS_PORTS,
                    prn=packet_callback,
                    store=0
                ),
                daemon=True
            )
            sniff_thread.start()
            print("[+] Escuchando trafico de red de Dofus... Abre el mercadillo en el juego.")
            
            while True:
                await asyncio.sleep(1)

    try:
        loop.run_until_complete(run())
    except KeyboardInterrupt:
        print("\\n[!] Sniffer detenido por el usuario.")

if __name__ == "__main__":
    main()
`,

  d2o_parser: () => `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Dofus D2O / D2I Static Data Extractor (Generador de id_to_name.json)
=============================================================================
 Este script busca en la carpeta de instalacion de Dofus los archivos:
 - Items.d2o (Datos de objetos e IDs)
 - i18n_es.d2i (Textos traducidos al Español)
 y genera un archivo id_to_name.json limpio para tu sniffer.

 Requisitos:
   pip install pydofus
"""

import os
import sys
import json
import glob
from pydofus.d2o import D2OReader
from pydofus.d2i import D2IReader

def find_dofus_paths():
    """Rutas comunes de instalacion de Ankama Dofus"""
    user_dir = os.path.expanduser("~")
    possible_paths = [
        # Dofus 2 / Unity en Windows
        os.path.join(user_dir, "AppData", "Local", "Ankama", "Dofus", "data", "common"),
        os.path.join(user_dir, "AppData", "Local", "Ankama", "Dofus", "data", "i18n"),
        os.path.join(user_dir, "AppData", "Local", "Ankama", "zaap", "dofus", "data", "common"),
        # Instalaciones personalizadas
        r"C:\\Program Files (x86)\\Dofus\\data\\common",
        r"C:\\Ankama\\Dofus\\data\\common"
    ]
    
    d2o_file = None
    d2i_file = None

    for p in possible_paths:
        if os.path.exists(p):
            test_d2o = os.path.join(p, "Items.d2o")
            if os.path.exists(test_d2o):
                d2o_file = test_d2o
            
            # Buscar archivo de idioma
            for name in ["i18n_es.d2i", "i18n_es_es.d2i", "i18n_fr.d2i", "i18n_en.d2i"]:
                test_d2i = os.path.join(p, name)
                if os.path.exists(test_d2i):
                    d2i_file = test_d2i
                    break

    return d2o_file, d2i_file

def extract_database(d2o_path=None, d2i_path=None, output_file="id_to_name.json"):
    if not d2o_path or not d2i_path:
        auto_d2o, auto_d2i = find_dofus_paths()
        d2o_path = d2o_path or auto_d2o
        d2i_path = d2i_path or auto_d2i

    print(f"[*] Archivo D2O: {d2o_path}")
    print(f"[*] Archivo D2I: {d2i_path}")

    if not d2o_path or not os.path.exists(d2o_path):
        print("[!] No se encontro Items.d2o automaticamente.")
        print("    Por favor coloca Items.d2o en esta misma carpeta o indica su ruta.")
        return False

    # 1. Cargar D2I (Textos)
    i18n_texts = {}
    if d2i_path and os.path.exists(d2i_path):
        print("[+] Desempaquetando textos de idioma D2I...")
        with open(d2i_path, "rb") as f:
            d2i = D2IReader(f)
            i18n_texts = d2i.read()
    
    # 2. Cargar D2O (Items)
    print("[+] Desempaquetando Items.d2o...")
    id_map = {}
    with open(d2o_path, "rb") as f:
        d2o = D2OReader(f)
        items_data = d2o.read()
        
        for item_id, item_obj in items_data.items():
            name_id = getattr(item_obj, "nameId", None)
            if isinstance(item_obj, dict):
                name_id = item_obj.get("nameId")
                
            real_name = i18n_texts.get(name_id, f"Objeto {item_id}")
            id_map[str(item_id)] = real_name

    # 3. Guardar JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(id_map, f, ensure_ascii=False, indent=2)

    print(f"[✓] Exito! {len(id_map)} objetos exportados a {output_file}")
    return True

if __name__ == "__main__":
    extract_database()
`,

  fast_socket_sniffer: (apiUrl: string) => `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 Dofus Ultra-Fast Raw Socket Sniffer (Evita pérdida de paquetes de Scapy)
=============================================================================
 Para Windows con Pyshark/Npcap o Linux con AF_PACKET puro.
"""

import sys
import os
import json
import struct
import requests

SERVER_API_URL = "${apiUrl}/api/precios"
DOFUS_PORT = 5555

def run_pyshark_sniffer():
    try:
        import pyshark
    except ImportError:
        print("[!] Requiere pyshark: pip install pyshark")
        return

    print(f"[*] Iniciando captura de alta velocidad en puerto {DOFUS_PORT}...")
    capture = pyshark.LiveCapture(
        bpf_filter=f"tcp port {DOFUS_PORT}",
        include_raw=True,
        use_json=True
    )

    for packet in capture.sniff_continuously():
        try:
            if hasattr(packet, 'tcp') and hasattr(packet.tcp, 'payload'):
                raw_hex = packet.tcp.payload.replace(":", "")
                raw_bytes = bytes.fromhex(raw_hex)
                
                # Procesar cabecera rápida
                if len(raw_bytes) >= 2:
                    header = struct.unpack_from(">H", raw_bytes, 0)[0]
                    msg_id = header >> 2
                    print(f"[Packet] Mensaje Dofus ID: {msg_id} ({len(raw_bytes)} bytes)")
        except Exception as e:
            continue

if __name__ == "__main__":
    run_pyshark_sniffer()
`,

  requirements_txt: `scapy>=2.5.0
requests>=2.31.0
aiohttp>=3.9.0
pydofus>=0.1.0
pyshark>=0.6.0
`
};
