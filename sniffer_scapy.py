import sys
import json
import requests
from scapy.all import sniff, TCP, Raw

API_URL = "http://localhost:3000/api/precios"
DOFUS_PORTS = "tcp port 5555"

print("[+] Sniffer PASIVO y SEGURO iniciado.")
print("[+] Sin llamadas externas ni bloqueos de red.")

def process_packet(pkt):
    if not (pkt.haslayer(TCP) and pkt.haslayer(Raw)):
        return
    payload = bytes(pkt[Raw].load)
    if b"type.ankama.com/kbt" not in payload:
        return

    # Extracción en memoria ultra-rápida sin retardos
    try:
        # Enviar el payload crudo al servidor web para que el servidor web lo procese,
        # sin que Python pierda ni un microsegundo en tu PC
        requests.post(
            API_URL, 
            json={"raw_hex": payload.hex(), "server": "Draconiros"},
            timeout=0.1
        )
    except Exception:
        pass

# Captura con buffer seguro para no afectar la conexión del juego
sniff(filter=DOFUS_PORTS, prn=process_packet, store=False)