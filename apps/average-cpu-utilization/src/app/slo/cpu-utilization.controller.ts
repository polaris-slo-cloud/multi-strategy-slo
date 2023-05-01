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
  ElasticityStrategyKind, Logger,
  MetricsSource,
  ObservableOrPromise,
  OrchestratorGateway, PolarisConstructor, PolarisTransformationService,
  ServiceLevelObjective,
  SloCompliance,
  SloMapping,
  SloOutput,
  SloTarget,
} from '@polaris-sloc/core';

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
  private transformer: PolarisTransformationService;

  configure(
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ObservableOrPromise<void> {
    this.sloMapping = sloMapping;
    this.metricsSource = metricsSource;
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.transformer = orchestrator.transformer;

    const cpuUtilizationParams: AverageCpuUtilizationParams = {
      timeRangeMinutes: 5,
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    };

    this.averageCpuUtilizationMetricSource = metricsSource.getComposedMetricSource(AverageCpuUtilizationMetric.instance, cpuUtilizationParams);
    this.decisionLogic = this.transformDecisionLogic(this.sloMappingSpec);
    return this.decisionLogic.configure(orchestrator, sloMapping, metricsSource);
  }

  async evaluate(): Promise<SloOutput<SloCompliance>> {
    const sample = await this.averageCpuUtilizationMetricSource.getCurrentValue().toPromise();
    const currSloCompliancePercentage = this.calculateCompliance(sample.value);
    const compliance = { currSloCompliancePercentage };

    const elasticityStrategy = await this.decisionLogic.selectElasticityStrategy(compliance);
    return {
      sloMapping: this.sloMapping,
      elasticityStrategyParams: compliance,
      elasticityStrategy
    };
  }

  private calculateCompliance(sample: AverageCpuUtilization): number {
    const target = this.sloMapping.spec.sloConfig.targetUtilizationPercentage;
    return Math.ceil((sample.averageCpuUtilization / target) * 100)
  }

  private transformDecisionLogic(mappingSpec: CpuUtilizationSloMappingSpec): ElasticityDecisionLogic<any, any, any, any> {
    const decisionLogicCtor: PolarisConstructor<ElasticityDecisionLogic<any, any, any, any>> =
      this.transformer.getPolarisType(mappingSpec.elasticityDecisionLogic) ?? ElasticityDecisionLogic;
    return new decisionLogicCtor();
  }
}
