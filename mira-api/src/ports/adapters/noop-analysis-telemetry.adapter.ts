import { Injectable, Logger } from '@nestjs/common';
import {
  AnalysisTelemetryEvent,
  AnalysisTelemetryPort,
  assertSafeTelemetryProps,
} from '../telemetry/analysis-telemetry.port';

/**
 * Explicit no-op / log-only telemetry. Does NOT claim production monitoring.
 * Never accepts raw images or secrets (assertSafeTelemetryProps).
 */
@Injectable()
export class NoopAnalysisTelemetryAdapter implements AnalysisTelemetryPort {
  private readonly logger = new Logger(NoopAnalysisTelemetryAdapter.name);

  track(event: AnalysisTelemetryEvent): void {
    assertSafeTelemetryProps(event.safeProps);
    this.logger.debug(
      `[telemetry:noop] ${event.name} feature=${event.feature} provider=${event.provider ?? '-'} trace=${event.traceId}`,
    );
  }
}
