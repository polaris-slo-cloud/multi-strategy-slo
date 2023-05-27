import {
  ApiObjectMetadata,
  initSelf, Logger,
  MetricsSource,
  NamespacedObjectReference,
  ObjectKind,
  ObservableOrPromise,
  OrchestratorClient,
  OrchestratorGateway,
  PodTemplateContainer,
  PolarisType,
  Resources,
  Scale,
  SloCompliance,
  SloMapping,
  SloMappingBase,
  SloMappingInitData,
  SloMappingSpecBase,
  SloTarget,
} from '@polaris-sloc/core';
import {ElasticityStrategyKind} from '@polaris-sloc/core/src/lib/model/elasticity-strategy-kind.prm';
import {of} from 'rxjs';
import {HorizontalElasticityStrategyKind, VerticalElasticityStrategyKind} from '@polaris-sloc/common-mappings';

/**
 * Represents the configuration options of the CpuUtilization SLO.
 */
export interface CpuUtilizationSloConfig {
  targetUtilizationPercentage: number;
}

export class ElasticityDecisionLogic<C, O, T extends SloTarget, S extends ElasticityStrategyKind<O,  T>> extends ObjectKind {

  constructor(initData?: Partial<ElasticityDecisionLogic<C, O, T, S>>) {
    super(initData);
  }

  selectElasticityStrategy(sloOutput: O): Promise<S> {
    return Promise.resolve(null);
  }

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<C, O>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    return of(null);
  }
}


export enum Day {
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  SUNDAY,
}

export class TimeAwareDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor(initData?: Partial<TimeAwareDecisionLogic>) {
    super({kind: 'TimeAwareDecisionLogic', ...initData});
  }

  public elasticityStrategyDay: Day[];
  public secondaryElasticityStrategyDays: Day[];
  public secondaryDecisionLogic: ElasticityDecisionLogic<CpuUtilizationSloConfig, SloCompliance, SloTarget, HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind>;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    this.secondaryDecisionLogic = this.secondaryDecisionLogic ?? new RoundRobinDecisionLogic();
    return this.secondaryDecisionLogic.configure(orchestrator, sloMapping, metricsSource);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const today = this.getToday(new Date().getDay());

    const isPrimaryEnabledToday = this.isPrimaryStrategyEnabled(today);
    const isSecondaryEnabledToday = this.isSecondaryStrategyEnabled(today);
    if (isPrimaryEnabledToday && isSecondaryEnabledToday) {
      return this.secondaryDecisionLogic.selectElasticityStrategy(sloOutput);
    } else if (isPrimaryEnabledToday) {
      return Promise.resolve(this.sloMappingSpec.elasticityStrategy);
    } else if (isSecondaryEnabledToday) {
      return Promise.resolve(this.sloMappingSpec.secondaryElasticityStrategy);
    }
    Logger.log("Setting sloCompliancePercentage to 100 to avoid any scaling")
    sloOutput.currSloCompliancePercentage = 100;
    //primary strategy will be chosen
    return Promise.resolve(null);
  }

  private isPrimaryStrategyEnabled(day: Day) {
    return this.isStrategyEnabled(day, this.elasticityStrategyDay);
  }

  private isSecondaryStrategyEnabled(day: Day) {
    return this.isStrategyEnabled(day, this.secondaryElasticityStrategyDays);
  }

  private isStrategyEnabled(day: Day, elasticityStrategyDays: Day[]) {
    return [...elasticityStrategyDays || []].some(x => x === day);
  }

  private getToday(day: number): Day {
    return Object.values(Day)[day] as Day;
  }

}

export class ThresholdBasedDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor(initData?: Partial<ThresholdBasedDecisionLogic>) {
    super({kind: 'ThresholdBasedDecisionLogic', ...initData});
  }

  public threshold: number;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const difference = Math.abs(sloOutput.currSloCompliancePercentage - (100 + sloOutput.tolerance ?? 0));
    const threshold = this.threshold ?? 50;
    const selected = difference > threshold ? this.sloMappingSpec.elasticityStrategy : this.sloMappingSpec.secondaryElasticityStrategy;
    return Promise.resolve(selected);
  }

}

export class RandomDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor(initData?: Partial<RandomDecisionLogic>) {
    super({kind: 'RandomDecisionLogic', ...initData});
  }

  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private strategies: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind[];

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.elasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const randomIndex = Math.round(Math.random());
    return Promise.resolve(this.strategies[randomIndex]);
  }

}

export class RoundRobinDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor(initData?: Partial<RoundRobinDecisionLogic>) {
    super({kind: 'RoundRobinDecisionLogic', ...initData});
  }

  private strategies: HorizontalElasticityStrategyKind[] | VerticalElasticityStrategyKind[];
  private currentIndex: number;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.elasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    this.currentIndex = 0;
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    if (this.currentIndex == this.strategies.length) {
      this.currentIndex = 0;
    }
    Logger.log('selectElasticityStraegy is executed:', this.currentIndex, this.strategies);
    return Promise.resolve(this.strategies[this.currentIndex++]);
  }

}

export type ScaleDirection = 'UP' | 'DOWN';

export class PriorityDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind
> {

  constructor(initData?: Partial<PriorityDecisionLogic>) {
    super({kind: 'PriorityDecisionLogic', ...initData});
  }

  public maxResources: Resources;
  public minResources: Resources;
  public maxReplicas: number;
  public minReplicas: number;

  private orchestratorClient: OrchestratorClient;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>;

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const scaleDirection = sloOutput.currSloCompliancePercentage >= 100 ? 'UP' : 'DOWN';
    return this.isPrimaryElasticityStrategyAvailable(scaleDirection)
      .then(isPrimary => isPrimary ? this.sloMappingSpec.elasticityStrategy : this.sloMappingSpec.secondaryElasticityStrategy);
  }

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.orchestratorClient = orchestrator.createOrchestratorClient();
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.sloMapping = sloMapping;
    return of(null);
  }

  private isPrimaryElasticityStrategyAvailable(scaleDirection: ScaleDirection): Promise<boolean> {
    if (this.sloMappingSpec.elasticityStrategy.kind === 'HorizontalElasticityStrategy') {
      return this.isHorizontalElasticityStrategyAvailable(scaleDirection);
    } else {
      return this.isVerticalElasticityStrategyAvailable(scaleDirection);
    }
  }

  private async isHorizontalElasticityStrategyAvailable(scaleDirection: ScaleDirection): Promise<boolean> {
    const scale = await this.loadTargetScale();
    const currentReplicas = scale.spec.replicas;
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    const maxReplicas = this.maxReplicas ?? config.maxReplicas;
    const minReplicas = this.minReplicas ?? config.minReplicas;

    if (scaleDirection === 'UP') {
      return currentReplicas < maxReplicas;
    } else {
      return currentReplicas > minReplicas;
    }
  }

  private async isVerticalElasticityStrategyAvailable(scaleDirection: ScaleDirection): Promise<boolean> {
    const target = await this.loadTarget();
    const containers = target.spec.template.spec.containers;
    const currentResources = containers[0].resources;
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    const maxResources = this.maxResources ?? config.maxResources as Resources;
    const minResources = this.minResources ?? config.minResources as Resources;

    if (scaleDirection === 'UP') {
      return currentResources.memoryMiB < maxResources.memoryMiB || currentResources.milliCpu < maxResources.milliCpu;
    } else {
      return currentResources.memoryMiB > minResources.memoryMiB || currentResources.milliCpu > minResources.milliCpu;
    }
  }

  private loadTargetScale(): Promise<Scale> {
    const targetRef = new NamespacedObjectReference({
      namespace: this.sloMapping.metadata.namespace,
      ...this.sloMappingSpec.targetRef,
    });
    return this.orchestratorClient.getScale(targetRef);
  }

  private async loadTarget(): Promise<PodTemplateContainer> {
    const targetRef = this.sloMappingSpec.targetRef;
    const queryApiObj = new PodTemplateContainer({
      objectKind: new ObjectKind({
        group: targetRef.group,
        version: targetRef.version,
        kind: targetRef.kind,
      }),
      metadata: new ApiObjectMetadata({
        namespace: this.sloMapping.metadata.namespace,
        name: targetRef.name,
      }),
    });

    const ret = await this.orchestratorClient.read(queryApiObj);
    if (!ret.spec?.template) {
      throw new Error('The SloTarget does not contain a pod template (spec.template field).');
    }
    return ret;
  }
}

export abstract class MultiElasticitySloMappingSpec<C, O, T extends SloTarget, S extends ElasticityStrategyKind<O, T>> extends SloMappingSpecBase<C, O, T> {
  constructor(initData?: Partial<MultiElasticitySloMappingSpec<C, O, T, S>>) {
    super(initData);
  }

  @PolarisType(() => ElasticityStrategyKind)
  elasticityStrategy: S;
  @PolarisType(() => ElasticityStrategyKind)
  secondaryElasticityStrategy: S;
  @PolarisType(() => ElasticityDecisionLogic)
  elasticityDecisionLogic: ElasticityDecisionLogic<C, O, T, S>
}


/**
 * The spec type for the CpuUtilization SLO.
 */
export class CpuUtilizationSloMappingSpec extends MultiElasticitySloMappingSpec<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  | HorizontalElasticityStrategyKind
  | VerticalElasticityStrategyKind
> {}

/**
 * Represents an SLO mapping for the CpuUtilization SLO, which can be used to apply and configure the CpuUtilization SLO.
 */
export class CpuUtilizationSloMapping extends SloMappingBase<CpuUtilizationSloMappingSpec> {
  @PolarisType(() => CpuUtilizationSloMappingSpec)
  spec: CpuUtilizationSloMappingSpec;

  constructor(initData?: SloMappingInitData<CpuUtilizationSloMapping>) {
    super(initData);
    this.objectKind = new ObjectKind({
      group: 'slo.polaris-slo-cloud.github.io',
      version: 'v1',
      kind: 'CpuUtilizationSloMapping',
    });
    initSelf(this, initData);
  }
}
