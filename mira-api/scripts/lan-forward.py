#!/usr/bin/env python3
"""Local-network TCP forwarder for on-device QA.

Bridges LAN clients (physical iPhone) to the loopback-only Nest API when the
macOS application firewall blocks inbound connections to the node binary.

Usage: python3 lan-forward.py [listen_port] [target_port]
"""
import socket
import sys
import threading

LISTEN_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
TARGET_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
TARGET_HOST = "127.0.0.1"


def pipe(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for sock in (src, dst):
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(client: socket.socket) -> None:
    try:
        upstream = socket.create_connection((TARGET_HOST, TARGET_PORT), timeout=10)
    except OSError as exc:
        print(f"upstream connect failed: {exc}", flush=True)
        client.close()
        return
    threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
    threading.Thread(target=pipe, args=(upstream, client), daemon=True).start()


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", LISTEN_PORT))
    server.listen(128)
    print(f"forwarding 0.0.0.0:{LISTEN_PORT} -> {TARGET_HOST}:{TARGET_PORT}", flush=True)
    while True:
        client, addr = server.accept()
        print(f"conn from {addr[0]}", flush=True)
        handle(client)


if __name__ == "__main__":
    main()
