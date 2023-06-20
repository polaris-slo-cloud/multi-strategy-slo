import {
  ComposedMetricSourceBase, Duration, LabelFilters, LabelGroupingOrJoinType,
  MetricsSource,
  OrchestratorGateway,
  Sample, TimeRange,
} from '@polaris-sloc/core';
import { AverageCpuUtilization, AverageCpuUtilizationParams } from '@org/slos';
import {Observable, throwError} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

/**
 * Computes the `AverageCpuUtilization` composed metric.
 */
export class AverageCpuUtilizationMetricSource extends ComposedMetricSourceBase<AverageCpuUtilization> {
  constructor(
    private params: AverageCpuUtilizationParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ) {
    super(metricsSource, orchestrator);
  }

  getValueStream(): Observable<Sample<AverageCpuUtilization>> {
    return this.getDefaultPollingInterval().pipe(
      switchMap(() => this.getAvgCpuUtilizationSample())
    );
  }

  private getAvgCpuUtilizationSample(): Promise<Sample<AverageCpuUtilization>> {
    return this.getAvgCpuUtilization()
      .then(result => ({
        timestamp: Date.now(),
        value: {
          averageCpuUtilization: result
        }
      }));
  }

  private async getAvgCpuUtilization(): Promise<number> {
    const filter = LabelFilters.regex('pod', `${this.params.sloTarget.name}.*`);
    const grouping = {labels: ['pod_name', 'container_name'], labelUsageType: LabelGroupingOrJoinType.ByOrOn};

    const cpuPeriod = this.metricsSource.getTimeSeriesSource()
      .select<number>('container', 'spec_cpu_period')
      .filterOnLabel(filter)

    const cpuQuota = this.metricsSource.getTimeSeriesSource()
      .select<number>('container', 'spec_cpu_quota')
      .filterOnLabel(filter)
      .divideBy(cpuPeriod)
      .sumByGroup(grouping);

    const cpuUsageSeconds = this.metricsSource.getTimeSeriesSource()
      .select<number>(
        'container',
        'cpu_usage_seconds_total',
        TimeRange.fromDuration(Duration.fromMinutes(this.params.timeRangeMinutes)))
      .filterOnLabel(filter);

    const cpuUsage = cpuUsageSeconds.rate()
      .sumByGroup(grouping)
      .divideBy(cpuQuota)
      .multiplyBy(100);

    const result = await cpuUsage.execute();
    const value = result.results[0]?.samples[0].value;

    if (value == null || isNaN(value)) {
      throw Error(`Invalid query result: ${value}`)
    }

    return Math.ceil(value);
  }
}
