# Face Report Resolution

Reuse: `PrismaService.skinAnalysis` + `extractMiraReportFromStored`.  
Load key: top-level chat `analysisId` (skin row) + `userId`.  
Nested `face.analysisId` is not an alternate load key.
