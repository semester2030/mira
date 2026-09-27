# POC isolation proof

1. Profile console after cold launch (no POC navigation):
   - Log: `Mira: ApplePersonMattingChannel registered (post-launch, lazy Vision)`
   - Means: MethodChannel handler attached only
   - Does NOT mean VNGeneratePersonSegmentationRequest ran

2. Vision request path is solely inside ApplePersonMattingChannel.process(imageData:)
   invoked only by MethodChannel method `generatePersonMatte`
   which Dart calls only from ApplePortraitMattingPocScreen._bootstrap()
   which runs only when route `/dev/apple-portrait-matting-poc` is opened.

3. Pre-crash DEBUG stack contained CameraPlugin.register — zero Vision/ApplePersonMatting symbols.
