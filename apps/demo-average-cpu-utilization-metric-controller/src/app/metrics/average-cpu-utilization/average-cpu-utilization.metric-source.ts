import {
  ComposedMetricSourceBase,
  Join, LabelFilter,
  LabelFilters,
  MetricsSource,
  OrchestratorGateway,
  Sample, TimeInstantQuery,
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
    const cpuUsage = this.queryCpuUsage();

    const result = await cpuUsage.execute();
    const value = result.results[0]?.samples[0].value;

    return this.clampResult(value);
  }

  private clampResult(value: number) {
    if (value == null || isNaN(value)) {
      throw Error(`Invalid query result: ${value}`)
    }

    const lowerBound = Math.max(0, value);
    const upperBound = Math.min(100, lowerBound);
    return Math.ceil(upperBound);
  }

  private queryCpuUsage(): TimeInstantQuery<number> {
    const cpuLimit = this.queryCpuLimit();
    const cpuLoad = this.queryCpuLoad();
    return cpuLoad.divideBy(cpuLimit).multiplyBy(100);
  }

  private queryCpuLoad(): TimeInstantQuery<number> {
    const targetFilter = LabelFilters.regex('target_name', `${this.params.sloTarget.name}.*`);

    return this.metricsSource.getTimeSeriesSource()
      .select<number>('polaris', 'composed_metrics_polaris_slo_cloud_github_io_v1_cpu_load')
      .filterOnLabel(targetFilter)
      .sumByGroup();
  }

  private queryCpuLimit(): TimeInstantQuery<number> {
    const resourceFilter = LabelFilters.equal('resource', 'cpu');
    const podFilter = LabelFilters.regex('pod', `${this.params.sloTarget.name}.*`);

    return this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'pod_container_resource_limits')
      .filterOnLabel(podFilter)
      .filterOnLabel(resourceFilter)
      .minByGroup()
      .multiplyBy(this.queryReplicas());
  }

  private queryReplicas(): TimeInstantQuery<number> {
    const deploymentFilter = LabelFilters.equal('deployment', this.params.sloTarget.name);

    return this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'deployment_spec_replicas')
      .filterOnLabel(deploymentFilter)
      .minByGroup();
  }
}
