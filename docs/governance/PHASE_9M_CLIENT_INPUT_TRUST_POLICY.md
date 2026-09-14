# Client Input Trust Policy

CLIENT-PROVIDED FREE TEXT IS UNTRUSTED.

Current Flutter client:
- Still may assemble `publicFactAr`/`reasonAr` for local UI
- Does **not** serialize them to `/advisor/chat`
- Server still ignores them if an old client sends them
