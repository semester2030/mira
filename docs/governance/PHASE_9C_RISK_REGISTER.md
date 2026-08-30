# Risk Register

| Risk | Mitigation |
|---|---|
| Flag on too early | default false |
| Contour drift vs crop | reuse existing FaceMappingContext |
| Double shutter | latch + capturing lock |
| Stale READY after pause | lifecycle interrupt |
