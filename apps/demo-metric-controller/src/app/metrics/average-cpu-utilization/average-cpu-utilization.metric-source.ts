import {ComposedMetricSourceBase, MetricsSource, OrchestratorGateway, Sample,} from '@polaris-sloc/core';
import {AverageCpuUtilization, AverageCpuUtilizationParams} from '@org/slos';
import {Observable, of} from 'rxjs';

const LINEAR_INCREASE_DECREASE = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1];

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
    if (this.index >= LINEAR_INCREASE_DECREASE.length) {
      this.index = 0;
    }
    return of({
        timestamp: Date.now(),
        value: {
          averageCpuUtilization: LINEAR_INCREASE_DECREASE[this.index++]
        }
      });
  }
}
