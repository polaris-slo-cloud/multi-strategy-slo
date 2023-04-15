import {
  AvailableCpuPerPod,
  AvailableCpuPerPodMetric,
  AvailableCpuPerPodParams,
  CpuUtilizationSloConfig,
  CpuUtilizationSloMappingSpec,
  ElasticityDecisionLogic
} from '@org/slos';
import {
  ComposedMetricSource,
  createOwnerReference,
  Duration, ElasticityStrategyKind,
  LabelFilters,
  LabelGroupingOrJoinType,
  MetricsSource,
  ObservableOrPromise,
  OrchestratorGateway,
  ServiceLevelObjective, SloCompliance,
  SloMapping,
  SloOutput, SloTarget,
  TimeRange,
} from '@polaris-sloc/core';
import {of} from 'rxjs';

/**
 * Implements the CpuUtilization SLO.
 *
 *
 */
export class CpuUtilizationSlo
  implements ServiceLevelObjective<CpuUtilizationSloConfig, SloCompliance>
{
  sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>;
  sloMappingSpec: CpuUtilizationSloMappingSpec;

  private metricsSource: MetricsSource;
  private allocatableResourcesSource: ComposedMetricSource<AvailableCpuPerPod>;
  private decisionLogic: ElasticityDecisionLogic<CpuUtilizationSloConfig, SloCompliance, SloTarget, ElasticityStrategyKind<any>, ElasticityStrategyKind<any>>;


  configure(
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ObservableOrPromise<void> {
    this.sloMapping = sloMapping;
    this.metricsSource = metricsSource;
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.decisionLogic = this.sloMappingSpec.elasticityDecisionLogic;

    const allocMetricParams: AvailableCpuPerPodParams = {
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    };

    this.allocatableResourcesSource = metricsSource.getComposedMetricSource(AvailableCpuPerPodMetric.instance, allocMetricParams);
    return this.decisionLogic.configure(orchestrator, sloMapping);
  }

  evaluate(): ObservableOrPromise<SloOutput<SloCompliance>> {
    //TODO select strategy
    return Promise.all([
      this.calculateSloCompliance()
    ]).then((value: [number]) => ({
      sloMapping: this.sloMapping,
      elasticityStrategyParams: {
        currSloCompliancePercentage: value[0]
      }
    }));
  }

  private calculateSloCompliance(): Promise<number> {
    const target = this.sloMapping.spec.sloConfig.targetUtilizationPercentage;
    return this.getAvgCpuUtilization()
      .then(value => Math.ceil((value / target) * 100));
  }

  private async getAvgCpuUtilization(): Promise<number> {
    const filter = LabelFilters.regex('pod', `${this.sloMapping.spec.targetRef.name}.*`);
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
        TimeRange.fromDuration(Duration.fromMinutes(5)))
      .filterOnLabel(filter);

    const cpuUsage = cpuUsageSeconds.rate()
      .sumByGroup(grouping)
      .divideBy(cpuQuota)
      .multiplyBy(100);

    const result = await cpuUsage.execute();
    return Math.ceil(result.results[0]?.samples[0].value);
  }
}
