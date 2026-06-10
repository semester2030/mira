/// MediaPipe Face Mesh landmark index groups (468-point topology).
/// Source: MediaPipe FACEMESH_* constants — no hardcoded screen positions.
abstract final class MediapipeLandmarkIndices {
  /// Full face jaw/cheek/forehead boundary.
  static const faceOval = <int>[
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109,
  ];

  static const leftEye = <int>[
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  ];

  static const rightEye = <int>[
    263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
  ];

  static const leftEyebrowTop = <int>[70, 63, 105, 66, 107];
  static const rightEyebrowTop = <int>[300, 293, 334, 296, 336];

  /// Ordered under-eye boundary (left) — lower lid + tear trough loop.
  static const leftUnderEye = <int>[
    33, 246, 161, 160, 159, 158, 157, 173, 133,
    111, 117, 118, 119, 120, 121, 128, 245, 189, 221, 222, 223, 224, 225,
    113, 226, 31, 228, 229, 230, 231, 232, 233, 244,
  ];

  /// Ordered under-eye boundary (right).
  static const rightUnderEye = <int>[
    263, 466, 388, 387, 386, 385, 384, 398, 362,
    340, 346, 347, 348, 349, 350, 357, 465, 412, 399, 456, 420, 429, 279,
    294, 440, 275, 419, 360, 363, 281, 5, 4, 195, 196,
  ];

  /// Ordered nose boundary loop.
  static const nose = <int>[
    168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327, 294, 278, 344,
    440, 275, 4, 45, 51, 134, 131, 198, 236, 3, 196, 168,
  ];

  static const leftCheek = <int>[
    116, 123, 147, 213, 192, 214, 135, 169, 170, 140, 171, 175, 396, 369,
    395, 394, 364, 367, 435, 401,
  ];

  static const rightCheek = <int>[
    345, 352, 376, 433, 416, 434, 430, 431, 262, 428, 396, 427, 411, 280,
    352, 345, 340, 346, 347, 348,
  ];

  static const chin = <int>[
    152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251,
    284, 332, 297, 338, 10, 109, 67, 103, 54, 21, 162, 127,
  ];

  static const lowerLip = <int>[
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267,
    0, 37, 39, 40, 185,
  ];

  static const jawline = <int>[
    172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288,
    361, 323, 454, 356, 389, 251, 284, 332, 297, 338, 10, 109, 67, 103, 54,
    21, 162, 127, 234, 93, 132, 58,
  ];
}
