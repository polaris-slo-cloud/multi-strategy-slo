import {
  ComposedMetricSourceBase,
  MetricsSource,
  OrchestratorGateway,
  Sample,
} from '@polaris-sloc/core';
import {AverageCpuUtilization, CpuLoad, CpuLoadParams} from '@org/slos';
import {Observable, of} from 'rxjs';


/**
 * Computes the `CpuLoad` composed metric.
 */

const CPU_LOAD: number[] = JSON.parse(process.env['CPU_TEST_DATA'])

export class CpuLoadMetricSource extends ComposedMetricSourceBase<CpuLoad> {

  private index = 0;

  constructor(
    private params: CpuLoadParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ) {
    super(metricsSource, orchestrator);
  }

  getValueStream(): Observable<Sample<CpuLoad>> {
    if (this.index >= CPU_LOAD.length) {
      this.index = 0;
    }
    return of({
      timestamp: Date.now(),
      value: {
        cpuLoadMillis: this.toCpuCores(CPU_LOAD[this.index++])
      }
    });
  }

  toCpuCores(value: number) {
    return value / 1000;
  }
}
