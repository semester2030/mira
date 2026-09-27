# Apple capability used

- Framework: Vision
- Request: VNGeneratePersonSegmentationRequest
- Quality: accurate
- Output: OneComponent8 person mask → upsampled to source W×H
- Composites (POC only):
  - grayscale alpha PNG
  - opaque RGB PNG over #000000 (hard composite, no beauty feather)
- Channel: mira/apple_person_matting / generatePersonMatte
- iOS deployment target in project: 15.5+
- Offline: YES
- Upload: NO
