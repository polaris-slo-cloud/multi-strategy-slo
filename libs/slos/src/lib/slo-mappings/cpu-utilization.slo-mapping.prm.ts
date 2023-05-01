import {
  initSelf,
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

export class ElasticityDecisionLogic<C, O, T extends SloTarget, S extends ElasticityStrategyKind<O,  T>> extends ObjectKind{

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

//TODO: GradientBasedDecisionLogic -> sudden change horizontal, constant: vertical -> new metric

enum Day {
  SUNDAY,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
}

export class TimeAwareDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor() {
    super({kind: 'TimeAwareDecisionLogic'});
  }

  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private roundRobinDecisionLogic: RoundRobinDecisionLogic;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    this.roundRobinDecisionLogic = new RoundRobinDecisionLogic();
    return this.roundRobinDecisionLogic.configure(orchestrator, sloMapping);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const today = this.getToday(new Date().getDay());

    const isPrimaryEnabledToday = this.isPrimaryStrategyEnabled(today);
    const isSecondaryEnabledToday = true;
    if (isPrimaryEnabledToday && isSecondaryEnabledToday) {
      return this.roundRobinDecisionLogic.selectElasticityStrategy(sloOutput);
    } else if (isPrimaryEnabledToday) {
      return Promise.resolve(this.sloMappingSpec.primaryElasticityStrategy);
    } else if (isSecondaryEnabledToday) {
      return Promise.resolve(this.sloMappingSpec.secondaryElasticityStrategy);
    }
    return Promise.resolve(null);
  }

  isPrimaryStrategyEnabled(day: Day) {
    //return [...this.sloMappingSpec.staticElasticityStrategyConfig.days].some(x => x === day);
    return false;
  }

  getToday(day: number): Day {
    return Object.values(Day)[day] as Day;
  }

}

export class ThresholdBasedDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor() {
    super({kind: 'ThresholdBasedDecisionLogic'});
  }

  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const difference = Math.abs(sloOutput.currSloCompliancePercentage - (100 + sloOutput.tolerance ?? 0));
    const threshold = this.sloMappingSpec.staticElasticityStrategyConfig.threshold;
    const selected = difference > threshold ? this.sloMappingSpec.primaryElasticityStrategy : this.sloMappingSpec.secondaryElasticityStrategy;
    return Promise.resolve(selected);
  }

}


export class RandomDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
> {

  constructor() {
    super({kind: 'RandomDecisionLogic'});
  }

  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private strategies: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind[];

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.primaryElasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
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

  constructor() {
    super({kind: 'RoundRobinDecisionLogic'});
  }

  private strategies: HorizontalElasticityStrategyKind[] | VerticalElasticityStrategyKind[];
  private currentIndex: number;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.primaryElasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    this.currentIndex = 0;
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    if (this.currentIndex == this.strategies.length) {
      this.currentIndex = 0;
    }
    return Promise.resolve(this.strategies[this.currentIndex++]);
  }

}

export class PriorityDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind
> {

  constructor() {
    super({kind: 'PriorityDecisionLogic'});
  }


  private orchestratorClient: OrchestratorClient;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>;

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const scaleDirection = sloOutput.currSloCompliancePercentage >= 100 ? 'UP' : 'DOWN';
    return this.isPrimaryElasticityStrategyAvailable(scaleDirection)
      .then(isPrimary => isPrimary ? this.sloMappingSpec.primaryElasticityStrategy : this.sloMappingSpec.secondaryElasticityStrategy);
  }

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.orchestratorClient = orchestrator.createOrchestratorClient();
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.sloMapping = sloMapping;
    return of(null);
  }

  private isPrimaryElasticityStrategyAvailable(scaleDirection: 'UP' | 'DOWN'): Promise<boolean> {
    if (this.sloMappingSpec.primaryElasticityStrategy instanceof HorizontalElasticityStrategyKind) {
      return this.isHorizontalElasticityStrategyAvailable(scaleDirection);
    } else {
      return this.isVerticalElasticityStrategyAvailable(scaleDirection);
    }
  }

  private async isHorizontalElasticityStrategyAvailable(scaleDirection: 'UP' | 'DOWN'): Promise<boolean> {
    const scale = await this.loadTargetScale();
    const currentReplicas = scale.spec.replicas;
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    const maxReplicas = config.maxReplicas;
    const minReplicas = config.minReplicas;

    return !(scaleDirection === 'UP' && currentReplicas === maxReplicas || currentReplicas === minReplicas);

  }

  private async isVerticalElasticityStrategyAvailable(scaleDirection: 'UP' | 'DOWN'): Promise<boolean> {
    const target = await this.loadTarget();
    const containers = target.spec.template.spec.containers;
    const currentResources = containers[0].resources;
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    const maxResources = config.maxResources as Resources;
    const minResources = config.minResources as Resources;

    const isResourceLimitReached = (resourceLimit: Resources) => {
      return currentResources.memoryMiB === resourceLimit.memoryMiB || currentResources.milliCpu === resourceLimit.milliCpu;
    }

    if (scaleDirection === 'UP') {
      return isResourceLimitReached(maxResources);
    } else {
      return isResourceLimitReached(minResources);
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
      metadata: this.sloMapping.metadata
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
  primaryElasticityStrategy: S;
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
  HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind
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
