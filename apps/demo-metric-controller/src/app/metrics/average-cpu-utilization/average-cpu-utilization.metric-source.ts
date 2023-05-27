import {ComposedMetricSourceBase, MetricsSource, OrchestratorGateway, Sample,} from '@polaris-sloc/core';
import {AverageCpuUtilization, AverageCpuUtilizationParams} from '@org/slos';
import {Observable, of} from 'rxjs';

const CPU_USAGE: number[] = JSON.parse(process.env['CPU_TEST_DATA'])

/**
 * Computes the `AverageCpuUtilization` composed metric.
 */
export class AverageCpuUtilizationMetricSource extends ComposedMetricSourceBase<AverageCpuUtilization> {

  private index = 0;

  constructor(
    private params: AverageCpuUtilizationParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ) {
    super(metricsSource, orchestrator);
  }


  getValueStream(): Observable<Sample<AverageCpuUtilization>> {
    if (this.index >= CPU_USAGE.length) {
      this.index = 0;
    }
    return of({
        timestamp: Date.now(),
        value: {
          averageCpuUtilization: CPU_USAGE[this.index++]
        }
      });
  }
}
