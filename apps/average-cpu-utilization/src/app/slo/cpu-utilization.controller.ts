import {
  AverageCpuUtilization,
  AverageCpuUtilizationMetric,
  AverageCpuUtilizationParams, CpuLoad,
  CpuLoadMetric,
  CpuLoadParams,
  CpuUtilizationSloConfig,
  CpuUtilizationSloMappingSpec,
  ElasticityDecisionLogic
} from '@org/slos';
import {
  ComposedMetricSource,
  createOwnerReference,
  ElasticityStrategyKind,
  Logger,
  MetricsSource,
  ObservableOrPromise,
  OrchestratorGateway,
  ServiceLevelObjective,
  SloCompliance,
  SloMapping,
  SloMappingBase,
  SloMappingSpec,
  SloOutput,
  SloTarget,
} from '@polaris-sloc/core';
import {of} from "rxjs";

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
  private cpuLoadMetricSource: ComposedMetricSource<CpuLoad>;
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
      timeRangeMinutes: 2,
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    };

    const cpuLoadParams: CpuLoadParams = {
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    }

    this.averageCpuUtilizationMetricSource = metricsSource.getComposedMetricSource(AverageCpuUtilizationMetric.instance, cpuUtilizationParams);
    this.cpuLoadMetricSource = metricsSource.getComposedMetricSource(CpuLoadMetric.instance, cpuLoadParams);
    return this.configureDecisionLogic(orchestrator, sloMapping, metricsSource);
  }

  private configureDecisionLogic(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMappingBase<SloMappingSpec<CpuUtilizationSloConfig, SloCompliance>>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
    if (this.decisionLogic) {
      return this.decisionLogic.configure(orchestrator, sloMapping, metricsSource);
    }
    return of(null);
  }

  async evaluate(): Promise<SloOutput<SloCompliance>> {

    const sample = await this.cpuLoadMetricSource.getCurrentValue().toPromise()
      .then(() => this.averageCpuUtilizationMetricSource.getCurrentValue().toPromise())
    const currSloCompliancePercentage = this.calculateCompliance(sample.value);
    const compliance = { currSloCompliancePercentage };

    const elasticityStrategy = await this.selectStrategy(compliance);
    Logger.log('chosen strategy', elasticityStrategy);
    return {
      sloMapping: this.sloMapping,
      elasticityStrategyParams: compliance,
      elasticityStrategy
    };
  }

  private selectStrategy(compliance: { currSloCompliancePercentage: number }): Promise<ElasticityStrategyKind<any>> {
    if (this.decisionLogic) {
      return this.decisionLogic.selectElasticityStrategy(compliance);
    }
    return Promise.resolve(null);
  }

  private calculateCompliance(sample: AverageCpuUtilization): number {
    const target = this.sloMapping.spec.sloConfig.targetUtilizationPercentage;
    return Math.ceil((sample.averageCpuUtilization / target) * 100)
  }
}
