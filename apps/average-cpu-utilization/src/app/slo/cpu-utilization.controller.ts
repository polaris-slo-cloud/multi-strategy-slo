import {
  AverageCpuUtilization,
  AverageCpuUtilizationMetric,
  AverageCpuUtilizationParams,
  CpuUtilizationSloConfig,
  CpuUtilizationSloMappingSpec,
  ElasticityDecisionLogic
} from '@org/slos';
import {
  ComposedMetricSource,
  createOwnerReference,
  ElasticityStrategyKind,
  MetricsSource,
  ObservableOrPromise,
  OrchestratorGateway,
  ServiceLevelObjective,
  SloCompliance,
  SloMapping,
  SloOutput,
  SloTarget,
} from '@polaris-sloc/core';
import {map} from 'rxjs/operators';

/**
 * Implements the CpuUtilization SLO.
 *
 *
 */
export class CpuUtilizationSlo
  implements ServiceLevelObjective<CpuUtilizationSloConfig, SloCompliance> {
  sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>;
  sloMappingSpec: CpuUtilizationSloMappingSpec;

  private metricsSource: MetricsSource;
  private averageCpuUtilizationMetricSource: ComposedMetricSource<AverageCpuUtilization>;
  private decisionLogic: ElasticityDecisionLogic<CpuUtilizationSloConfig, SloCompliance, SloTarget, ElasticityStrategyKind<any>>;


  configure(
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ObservableOrPromise<void> {
    this.sloMapping = sloMapping;
    this.metricsSource = metricsSource;
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.decisionLogic = this.sloMappingSpec.elasticityDecisionLogic;

    const cpuUtilizationParams: AverageCpuUtilizationParams = {
      timeRangeMinutes: 5,
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    };

    this.averageCpuUtilizationMetricSource = metricsSource.getComposedMetricSource(AverageCpuUtilizationMetric.instance, cpuUtilizationParams);
    return this.decisionLogic.configure(orchestrator, sloMapping, metricsSource);
  }

  evaluate(): ObservableOrPromise<SloOutput<SloCompliance>> {
    return this.averageCpuUtilizationMetricSource.getCurrentValue().pipe(
      map(sample => sample.value),
      map(result => this.calculateCompliance(result)),
      map(currSloCompliancePercentage => ({
        sloMapping: this.sloMapping,
        elasticityStrategyParams: {
          currSloCompliancePercentage
        }
      }))
    );
  }

  private calculateCompliance(sample: AverageCpuUtilization): number {
    const target = this.sloMapping.spec.sloConfig.targetUtilizationPercentage;
    return Math.ceil((sample.averageCpuUtilization / target) * 100)
  }
}
