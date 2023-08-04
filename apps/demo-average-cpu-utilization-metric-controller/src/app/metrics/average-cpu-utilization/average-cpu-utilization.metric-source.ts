import {
  ComposedMetricSourceBase,
  Join,
  LabelFilters,
  MetricsSource,
  OrchestratorGateway,
  Sample,
} from '@polaris-sloc/core';
import {AverageCpuUtilization, AverageCpuUtilizationParams} from '@org/slos';
import {Observable} from 'rxjs';
import {switchMap} from "rxjs/operators";


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
    const resourceFilter = LabelFilters.equal('resource', 'cpu');
    const podFilter = LabelFilters.regex('pod', `${this.params.sloTarget.name}.*`);

    const runningStatus = this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'pod_status_phase')
      .filterOnLabel(podFilter)
      .filterOnLabel(LabelFilters.equal('phase', 'Running'));

    const cpuLimit = this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'pod_container_resource_limits')
      .filterOnLabel(podFilter)
      .filterOnLabel(resourceFilter)
      .multiplyBy(runningStatus, Join.onLabels('namespace', 'pod').groupLeft())
      .sumByGroup();

    const cpuMillis = this.metricsSource.getTimeSeriesSource()
      .select<number>('polaris', 'composed_metrics_polaris_slo_cloud_github_io_v1_cpu_load')
      .filterOnLabel(LabelFilters.regex('target_name', `${this.params.sloTarget.name}.*`))
      .sumByGroup();

    const cpuUsage = cpuMillis.divideBy(cpuLimit).multiplyBy(100);

    const result = await cpuUsage.execute();
    const value = result.results[0]?.samples[0].value;

    if (value == null || isNaN(value)) {
      throw Error(`Invalid query result: ${value}`)
    }

    return Math.ceil(Math.min(100, Math.max(0, value)));
  }
}
