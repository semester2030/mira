import 'package:flutter/material.dart';

/// Root navigator for actions after closing drawer/dialogs.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

BuildContext? get rootContext => rootNavigatorKey.currentContext;
