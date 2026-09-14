# PHASE 8A — Migration Strategy

1. Feature flag `results_experience_v2` (client)  
2. Keep `/mira-beauty-report` & `/skin-result` routes  
3. Old long report coexistence behind flag off  
4. No frozen subsystem / provider / canonical changes  
5. Projection layer reads existing SkinReport + intel DTOs  
6. Staged cohorts + analytics comparison (events above)  
7. Instant rollback = flag off  
8. Backend migration not required unless proven later  
9. No data loss — same report entities  
