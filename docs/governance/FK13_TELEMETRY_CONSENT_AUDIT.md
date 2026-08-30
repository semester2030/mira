# FK13 TELEMETRY CONSENT AUDIT

States: GRANTED/DENIED/UNKNOWN/CONSENT_UNAVAILABLE. Emit only GRANTED. Flag alone insufficient. Platform consent unwired → CONSENT_UNAVAILABLE. Bridge telemetryRecorded only if recordEvent.recorded. Sink failure isolated (try/catch; does not alter Claim Lock).
