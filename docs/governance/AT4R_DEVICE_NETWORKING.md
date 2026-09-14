# AT-4R — Device Networking

Nest listens on `0.0.0.0:$PORT` (default 3000). API prefix `api/v1`.

| Device | Base URL |
|--------|----------|
| iOS Simulator | `http://127.0.0.1:3000/api/v1` |
| Android Emulator | `http://10.0.2.2:3000/api/v1` |
| Physical iPhone/Android | `http://<Mac_LAN_IP>:3000/api/v1` |
| Flutter web/desktop (if used) | `http://127.0.0.1:3000/api/v1` |

Do not hardcode one address for all platforms.
Do not point QA Flutter at production `mira-api` while enabling FKL flags.
