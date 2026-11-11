import 'package:flutter/material.dart';

// The portal and Flutter use the same API response. Navigation/filtering keeps
// using the existing category id, never the imageKey or display name.
class MiraCatalogIcon extends StatelessWidget {
  const MiraCatalogIcon({super.key, required this.category, required this.diameter});
  final Map<String, dynamic> category;
  final double diameter;
  @override
  Widget build(BuildContext context) {
    final icon = category['icon'] as Map<String, dynamic>;
    final useLarge = diameter * MediaQuery.of(context).devicePixelRatio > 160;
    final url = icon[useLarge ? 'largeUrl' : 'smallUrl'] as String;
    return Semantics(label: category['nameAr'] as String, image: true,
      child: ClipOval(child: Image.network(url, width: diameter, height: diameter,
        fit: BoxFit.cover, excludeFromSemantics: true)));
  }
}
