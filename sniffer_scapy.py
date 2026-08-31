#!/usr/bin/env python3
"""
Dofus Market Sniffer (Scapy - Pasivo y Seguro)
-----------------------------------------------
Captura pasivamente paquetes de red del mercadillo de Dofus (puerto TCP 5555)
sin inyección de paquetes ni modificaciones de memoria.

Envía la información capturada en formato JSON al endpoint REST:
  POST http://localhost:3000/api/precios

Uso:
  python sniffer_scapy.py           # Inicia la escucha pasiva en vivo
  python sniffer_scapy.py --test    # Envía paquetes de prueba para verificar conexión
"""

import sys
import time
import json
import requests
from datetime import datetime

# Configuración
API_URL = "http://localhost:3000/api/precios"
DOFUS_PORTS = "tcp port 5555"

def log(msg, level="INFO"):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] [{level}] {msg}")

def send_to_api(payload):
    """Envía la información capturada al receptor local Express."""
    try:
        res = requests.post(API_URL, json=payload, timeout=0.5)
        if res.status_code == 200:
            data = res.json()
            items_count = data.get("ingestedCount", 1)
            log(f"-> Precios enviados a la API ({items_count} item/s registrado/s).", "OK")
        else:
            log(f"API devolvió código {res.status_code}: {res.text}", "WARN")
    except requests.exceptions.ConnectionError:
        log("No se pudo conectar con la interfaz web. Asegúrate de tener levantado el servidor en http://localhost:3000", "ERR")
    except Exception as e:
        log(f"Error enviando payload a la API: {e}", "ERR")

def run_test():
    """Envía ejemplos de prueba (recursos x1, x10, x100, x1000 y equipables) para validar."""
    log("Iniciando prueba de conexión con la interfaz local...", "TEST")
    
    # 1. Prueba de recurso con lotes x1, x10, x100, x1000
    recurso_test = {
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
    }
    
    # 2. Prueba de equipable con múltiples precios
    equipable_test = {
        "item_id": 8421,
        "item": "Gelano",
        "type": "equipable",
        "precios": [150000, 155000, 160000, 175000, 190000],
        "server": "Draconiros"
    }

    # 3. Prueba solo con ID y precios (recurso sin nombre)
    recurso_id_solo = {
        "item_id": 11118,
        "precios": {
            "1": 18,
            "10": 5,
            "100": 8,
            "1000": 47
        },
        "server": "Draconiros"
    }

    send_to_api(recurso_test)
    time.sleep(0.3)
    send_to_api(equipable_test)
    time.sleep(0.3)
    send_to_api(recurso_id_solo)
    
    log("Pruebas completadas. Revisa la interfaz web en http://localhost:3000", "TEST")

def process_packet(pkt):
    """Callback invocado por Scapy para cada paquete TCP capturado."""
    try:
        from scapy.all import TCP, Raw
        if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
            return
        
        payload = bytes(pkt[Raw].load)
        if len(payload) < 4:
            return

        # Dofus Unity Protobuf Market Price signature o Dofus 2
        if b"type.ankama.com/kbt" in payload or b"ankama" in payload:
            log(f"Paquete de mercadillo detectado ({len(payload)} bytes). Enviando a API...", "SNIFF")
            send_to_api({
                "raw_hex": payload.hex(),
                "server": "Draconiros",
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        log(f"Error procesando paquete: {e}", "WARN")

def start_sniffing():
    """Inicia el sniffer pasivo con Scapy."""
    try:
        from scapy.all import sniff
    except ImportError:
        log("Falta la librería Scapy. Instálala ejecutando: pip install scapy requests", "ERR")
        sys.exit(1)

    print("=" * 60)
    print("  DOFUS MARKET SNIFFER - CAPTURA PASIVA (SCAPY)")
    print(f"  Filtro BPF: {DOFUS_PORTS}")
    print(f"  Destino API: {API_URL}")
    print("=" * 60)
    log("Escuchando tráfico de red en paralelo... (Abre el mercadillo en Dofus)")

    try:
        sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)
    except KeyboardInterrupt:
        log("Sniffer detenido por el usuario.", "INFO")
    except PermissionError:
        log("Se requieren permisos de administrador/root para capturar paquetes de red.", "ERR")
        log("En Windows ejecuta tu terminal como Administrador. En Linux: sudo python sniffer_scapy.py", "ERR")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--test", "-t", "test"):
        run_test()
    else:
        start_sniffing()
