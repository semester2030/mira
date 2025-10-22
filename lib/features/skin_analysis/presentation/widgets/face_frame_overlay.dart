import 'package:flutter/material.dart';

class FaceFrameOverlay extends StatelessWidget {
  final double width;
  final double height;
  const FaceFrameOverlay({Key? key, this.width = 220, this.height = 300}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.blueAccent, width: 3),
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Center(
          child: Text('ضع وجهك هنا', style: TextStyle(color: Colors.blueAccent)),
        ),
      ),
    );
  }
}
