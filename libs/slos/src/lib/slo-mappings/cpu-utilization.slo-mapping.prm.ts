import {
  ApiObjectMetadata,
  initSelf,
  Logger,
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
  private scaleClient: ScaleClient;

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource: MetricsSource): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.scaleClient = new ScaleClient(
      orchestrator.createOrchestratorClient(),
      sloMapping
    );
    return of(null);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const tolerance = sloOutput.tolerance ?? 0;
    const difference = Math.abs(sloOutput.currSloCompliancePercentage - (100 + tolerance));
    const threshold = this.threshold ?? 50;
    const scaleDirection = sloOutput.currSloCompliancePercentage >= 100 ? 'UP' : 'DOWN';
    const strategy = this.sloMappingSpec.elasticityStrategy;
    const secondary = this.sloMappingSpec.secondaryElasticityStrategy;
    return difference > threshold ?
        this.scaleClient.selectStrategy(strategy, scaleDirection, secondary)
        : this.scaleClient.selectStrategy(secondary, scaleDirection, strategy);
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
    return Promise.resolve(this.strategies[this.currentIndex++]);
  }

}

export type ScaleDirection = 'UP' | 'DOWN';
export interface ScaleClientConfig {
  maxResources: Resources;
  minResources: Resources;
  maxReplicas: number;
  minReplicas: number;
}

export class ScaleClient {

  constructor(
    private orchestratorClient: OrchestratorClient,
    private sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    private config?: ScaleClientConfig
  ) {
    this.queryMap = new Map();
    this.sloMappingSpec = this.sloMapping.spec as CpuUtilizationSloMappingSpec
    this.registerStrategies();
  }

  private queryMap: Map<string, (direction: ScaleDirection) => Promise<boolean>>;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;

  private registerStrategies() {
    this.queryMap.set('HorizontalElasticityStrategy', (scaleDirection) => this.isHorizontalElasticityStrategyAvailable(scaleDirection));
    this.queryMap.set('VerticalElasticityStrategy', (scaleDirection) => this.isVerticalElasticityStrategyAvailable(scaleDirection));
  }

  public async selectStrategy(strategy: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind, scaleDirection: ScaleDirection, fallback?: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const fallbackAvailable = !fallback;
    const strategyQuery = this.queryMap.get(strategy.kind);

    if (strategyQuery && await strategyQuery(scaleDirection)) {
      return strategy;
    } else if (fallbackAvailable) {
      const fallbackQuery = this.queryMap.get(fallback.kind);
      const fallbackResult = await fallbackQuery(scaleDirection);
      return fallbackResult ? fallback : null;
    } else {
      return null;
    }
  }

  public isPrimaryStrategyAvailable(scaleDirection: ScaleDirection): Promise<boolean> {
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
    const maxReplicas = this.config?.maxReplicas ?? config.maxReplicas;
    const minReplicas = this.config?.minReplicas ?? config.minReplicas;

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
    const maxResources = this.config?.maxResources ?? config.maxResources as Resources;
    const minResources = this.config?.minResources ?? config.minResources as Resources;

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

  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>;
  private scaleClient: ScaleClient;

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const scaleDirection = sloOutput.currSloCompliancePercentage >= 100 ? 'UP' : 'DOWN';
    return this.scaleClient.isPrimaryStrategyAvailable(scaleDirection)
      .then(isPrimary => isPrimary ? this.sloMappingSpec.elasticityStrategy : this.sloMappingSpec.secondaryElasticityStrategy);
  }

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.sloMapping = sloMapping;
    this.scaleClient = new ScaleClient(
      orchestrator.createOrchestratorClient(),
      sloMapping,
      {
        maxResources: this.maxResources,
        minResources: this.minResources,
        maxReplicas: this.maxReplicas,
        minReplicas: this.minReplicas
      }
    );
    return of(null);
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
