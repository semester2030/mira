/// MediaPipe Face Mesh landmark index groups (468-point topology).
/// Small ordered anatomical loops — no cross-face traversal.
abstract final class MediapipeLandmarkIndices {
  /// Full face boundary — clipping and forehead construction only.
  static const faceOval = <int>[
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109,
  ];

  /// Closed forehead loop — top arc, temples, and brow ridge in order.
  static const forehead = <int>[
    109, 67, 103, 10, 338, 297, 298, 300, 293, 334, 296, 336, 107, 66, 105, 63,
    70, 54,
  ];

  /// Left lower eyelid + tear trough.
  static const leftUnderEye = <int>[
    133, 173, 157, 158, 159, 160, 161, 246, 33, 111, 117, 118, 119, 120,
    121, 128, 245, 189, 221, 222, 223, 224, 225, 113, 226,
  ];

  /// Right lower eyelid + tear trough.
  static const rightUnderEye = <int>[
    362, 398, 384, 385, 386, 387, 388, 466, 263, 340, 346, 347, 348, 349,
    350, 357, 465, 412, 399, 456, 420, 429, 279, 294, 440, 275,
  ];

  /// Nose perimeter — bridge, tip, alae, closed loop.
  static const nose = <int>[
    168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 64, 48, 115, 220, 45, 275, 440,
    344, 278, 294, 327, 326, 97,
  ];

  /// Left malar cheek — zygomatic loop along cheek bone.
  static const leftCheek = <int>[
    50, 101, 36, 205, 207, 187, 147, 123, 116, 117, 118, 119, 120, 121, 128,
    245, 189, 203, 206, 216, 212, 214, 192, 213,
  ];

  /// Right malar cheek — zygomatic loop, no lower-eyelid bleed.
  static const rightCheek = <int>[
    280, 352, 411, 427, 425, 266, 330, 347, 346, 340, 265, 261, 448, 449, 450,
    451, 452, 453, 412, 351, 416, 433, 376, 401,
  ];

  /// Lower lip — upper boundary of chin region.
  static const lowerLip = <int>[
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267,
    0, 37, 39, 40, 185,
  ];

  /// Local chin arc — center jaw only, no temple/forehead landmarks.
  static const chinArc = <int>[
    172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288,
    361, 323, 454, 356, 389, 251, 284,
  ];
}
