# AT-2 — Risk Register

| Risk | Mitigation |
|------|------------|
| json_object variance vs live model | AT-4 real-provider smoke; fail-closed parser |
| Client still on MCE | AT-3 required |
| Cost exposure if flags enabled early | flags remain OFF; rate limit on /advisor/chat |
| Config missing in some envs | PROVIDER_CONFIG_MISSING fail-closed |
