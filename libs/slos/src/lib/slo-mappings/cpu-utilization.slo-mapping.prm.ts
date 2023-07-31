import {
  ApiObjectMetadata,
  ComposedMetricSource,
  ContainerResources,
  createOwnerReference,
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
import {CpuLoad, CpuLoadMetric, CpuLoadParams} from "../metrics/cpu-load-metric.prm";


/**
 * Represents the configuration options of the CpuUtilization SLO.
 */
export interface CpuUtilizationSloConfig {
  targetUtilizationPercentage: number;
}

export class ElasticityDecisionLogic<C, O, T extends SloTarget, S extends ElasticityStrategyKind<O, T>> extends ObjectKind {

  constructor(initData?: Partial<ElasticityDecisionLogic<C, O, T, S>>) {
    super(initData);
  }

  selectElasticityStrategy(sloOutput: O): Promise<S> {
    return Promise.resolve(null);
  }

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<C, O>,
    metricsSource?: MetricsSource
  ): ObservableOrPromise<void> {
    Logger.log(`Configured ${this.kind}`)
    Logger.log(this);
    return of(null);
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

  public async selectStrategy(strategy: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind, scaleDirection: ScaleDirection, fallback: HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const strategyQuery = this.queryMap.get(strategy.kind);
    const fallbackQuery = this.queryMap.get(fallback.kind);

    if (strategyQuery && await strategyQuery(scaleDirection)) {
      Logger.log(`Chosen primary ${strategy} as strategy`)
      return strategy;
    } else if (fallbackQuery && await fallbackQuery(scaleDirection)) {
      Logger.log(`Chosen fallback ${fallback} as strategy`)
      return fallback;
    } else {
      Logger.log('All strategies are exhausted')
      return null;
    }
  }

  public isPrimaryStrategyAvailable(scaleDirection: ScaleDirection): Promise<boolean> {
    return this.isStrategyAvailable(this.sloMappingSpec.elasticityStrategy, scaleDirection);
  }

  public isStrategyAvailable(strategy: ElasticityStrategyKind<any>, scaleDirection: ScaleDirection): Promise<boolean> {
    const strategyQuery = this.queryMap.get(strategy.kind);
    if (strategyQuery) {
      return strategyQuery(scaleDirection);
    }
    return Promise.resolve(true);
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
      return currentResources.milliCpu < maxResources.milliCpu;
    } else {
      return currentResources.milliCpu > minResources.milliCpu;
    }
  }

  public loadContainerResources(): Promise<ContainerResources> {
    return this.loadTarget()
      .then(x => x.spec.template.spec.containers[0].resources);
  }

  public loadTargetScale(): Promise<Scale> {
    const targetRef = new NamespacedObjectReference({
      namespace: this.sloMapping.metadata.namespace,
      ...this.sloMappingSpec.targetRef,
    });
    return this.orchestratorClient.getScale(targetRef);
  }

  public async loadTarget(): Promise<PodTemplateContainer> {
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

export class BestFitElasticityDecisionLogic extends ElasticityDecisionLogic<
  CpuUtilizationSloConfig,
  SloCompliance,
  SloTarget,
  VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind
> {

  private scaleClient: ScaleClient;
  private sloMappingSpec: CpuUtilizationSloMappingSpec;
  private strategies: Array<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind>;
  private metricsSource: MetricsSource;
  private cpuLoadMetricSource: ComposedMetricSource<CpuLoad>;

  constructor(initData?: Partial<BestFitElasticityDecisionLogic>) {
    super({kind: 'BestFitElasticityDecisionLogic', ...initData});
  }

  configure(orchestrator: OrchestratorGateway, sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>, metricsSource?: MetricsSource): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.elasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    this.scaleClient = new ScaleClient(
      orchestrator.createOrchestratorClient(),
      sloMapping
    );
    this.metricsSource = metricsSource;

    const cpuLoadParams: CpuLoadParams = {
      sloTarget: sloMapping.spec.targetRef,
      namespace: sloMapping.metadata.namespace,
      owner: createOwnerReference(sloMapping)
    }

    this.cpuLoadMetricSource = metricsSource.getComposedMetricSource(CpuLoadMetric.instance, cpuLoadParams);
    return super.configure(orchestrator, sloMapping, metricsSource);
  }

  async selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const singleAvailable = await this.findSingleAvailable(sloOutput);

    if (singleAvailable) {
      Logger.log(`Only a single strategy is available ${singleAvailable.kind}`);
      return singleAvailable;
    }

    const calculations = this.strategies.map(strategy => this.calculateFutureSloCompliance(strategy, sloOutput));
    const scaledCompliance = await Promise.all(calculations);
    Logger.log(`Calculated future compliances: ${scaledCompliance}`)
    const differences = scaledCompliance
      .map(x => x - 100)
      .map(x => Math.abs(x));
    const bestValue = Math.min(...differences);
    Logger.log(`Best value is ${bestValue}`);
    const strategyIndex = differences.findIndex(diff => diff === bestValue);
    const strategy = this.strategies[strategyIndex];
    Logger.log(`Choosing strategy ${strategy.kind}`);
    return strategy;
  }

  private async findSingleAvailable(sloOutput: SloCompliance): Promise<null | VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const scaleDirection = sloOutput.currSloCompliancePercentage > 100 ? 'UP' : 'DOWN';
    const checkAvailable = this.strategies.map(strategy => this.scaleClient.isStrategyAvailable(strategy, scaleDirection));
    const availabilityQueries = await Promise.all(checkAvailable);

    if (availabilityQueries.some(x => x === false)) {
      const strategyIndex = availabilityQueries.findIndex(available => available === true);
      return this.strategies[strategyIndex];
    }
    return null;
  }

  private calculateFutureSloCompliance(elasticityStrategy: VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind, sloCompliance: SloCompliance): Promise<number> {
    if (elasticityStrategy.kind === 'HorizontalElasticityStrategy') {
      return this.calculateHorizontalFutureCompliance(sloCompliance);
    } else {
      return this.calculateVerticalFutureCompliance(sloCompliance);
    }

  }

  private async calculateHorizontalFutureCompliance(sloCompliance: SloCompliance): Promise<number> {
    const currReplicas = await this.getCurrReplicas();
    const multiplier = sloCompliance.currSloCompliancePercentage / 100;
    const newReplicas = Math.ceil(currReplicas * multiplier);
    const normalizedReplicas = this.normalizeReplicaCount(newReplicas);
    const containerCpuMillis = await this.getCurrentContainerSize();
    const futureCompliance = await this.calculateFutureCompliance(normalizedReplicas, containerCpuMillis, this.sloMappingSpec.sloConfig.targetUtilizationPercentage);
    Logger.log(`Future compliance with HorizontalElasticityStrategy is: ${futureCompliance}`);
    return futureCompliance;
  }

  private getCurrReplicas() {
    return this.scaleClient.loadTargetScale()
      .then(scale => scale.spec.replicas);
  }

  private async calculateFutureCompliance(scale: number, containerCpuMillis: number, target: number) {
    const cpuLoad = await this.getCpuLoad();
    Logger.log(`cpuLoad ${cpuLoad}, containerCpuMillis: ${containerCpuMillis}, scale: ${scale}`)
    const rawCpuUsage = cpuLoad / (scale * containerCpuMillis) * 100;
    const cpuUsage = Math.ceil(Math.min(100, Math.max(0, rawCpuUsage)));
    return Math.ceil((cpuUsage / target) * 100);
  }

  private normalizeReplicaCount(newReplicaCount: number): number {
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    newReplicaCount = Math.max(newReplicaCount, <number>config?.minReplicas ?? 1);
    newReplicaCount = Math.min(newReplicaCount, <number>config?.maxReplicas ?? Infinity);
    return newReplicaCount;
  }

  private async getCurrentContainerSize(): Promise<number> {
    return this.scaleClient.loadContainerResources()
      .then(resources => resources.milliCpu);
  }

  private async getCpuLoad(): Promise<number> {
    const metricValue = await this.cpuLoadMetricSource.getCurrentValue().toPromise();
    return metricValue.value.cpuLoadMillis * 1000;
  }

  private async calculateVerticalFutureCompliance(sloCompliance: SloCompliance): Promise<number> {
    const currentCpuMillis = await this.getCurrentContainerSize();
    const newCpuMillis = await this.getNewCpuMillis(currentCpuMillis, sloCompliance);
    const normalizedCpuMillis = this.normalizeCpuMillis(newCpuMillis);
    const currReplicas = await this.getCurrReplicas();

    const futureCompliance = await this.calculateFutureCompliance(currReplicas, normalizedCpuMillis, this.sloMappingSpec.sloConfig.targetUtilizationPercentage);
    Logger.log(`Future compliance with VerticalElasticityStrategy is: ${futureCompliance}`)
    return futureCompliance;
  }

  private async getNewCpuMillis(currentCpuMillis: number, sloCompliance: SloCompliance) {
    const compliancePercentage = sloCompliance.currSloCompliancePercentage;
    const diff = Math.abs(compliancePercentage - 100);

    let scaleRatio;
    if (compliancePercentage > 100) {
      scaleRatio = 100 + diff
    } else {
      scaleRatio = 100 - diff
    }
    return currentCpuMillis * (scaleRatio / 100);
  }

  private normalizeCpuMillis(currCpuMillis: number): number {
    const config = this.sloMappingSpec.staticElasticityStrategyConfig;
    const min: number = config.minResources['milliCpu'];
    const max: number = config.maxResources['milliCpu'];

    currCpuMillis = Math.max(min, currCpuMillis);
    currCpuMillis = Math.min(max, currCpuMillis);
    return currCpuMillis;
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

  async selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    const scaleDirection = sloOutput.currSloCompliancePercentage >= 100 ? 'UP' : 'DOWN';
    const sloMapping = this.sloMappingSpec;
    const strategies = [sloMapping.elasticityStrategy, sloMapping.secondaryElasticityStrategy];
    if (scaleDirection === 'UP') {
      return await this.selectPriorityStrategy(strategies, scaleDirection);
    } else {
      return await this.selectPriorityStrategy(strategies.reverse(), scaleDirection);
    }
  }

  private async selectPriorityStrategy(strategies: (HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind)[] , scaleDirection: ScaleDirection): Promise<HorizontalElasticityStrategyKind | VerticalElasticityStrategyKind> {
    const strategyRequests = strategies.map(strat => this.scaleClient.isStrategyAvailable(strat, scaleDirection));
    const strategyResults = await Promise.all(strategyRequests);
    const available = strategyResults.findIndex(x => x === true);
    if (available === -1) {
      return strategies[0];
    } else {
      return strategies[available];
    }
  }

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
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
    return super.configure(orchestrator, sloMapping, metricsSource);
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

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.elasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    return super.configure(orchestrator, sloMapping, metricsSource);
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

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.strategies = [this.sloMappingSpec.elasticityStrategy, this.sloMappingSpec.secondaryElasticityStrategy];
    this.currentIndex = 0;
    return super.configure(orchestrator, sloMapping, metricsSource);
  }

  selectElasticityStrategy(sloOutput: SloCompliance): Promise<VerticalElasticityStrategyKind | HorizontalElasticityStrategyKind> {
    if (this.currentIndex == this.strategies.length) {
      this.currentIndex = 0;
    }
    return Promise.resolve(this.strategies[this.currentIndex++]);
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

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
    this.sloMappingSpec = sloMapping.spec as CpuUtilizationSloMappingSpec;
    this.scaleClient = new ScaleClient(
      orchestrator.createOrchestratorClient(),
      sloMapping
    );
    return super.configure(orchestrator, sloMapping, metricsSource);
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

  configure(
    orchestrator: OrchestratorGateway,
    sloMapping: SloMapping<CpuUtilizationSloConfig, SloCompliance>,
    metricsSource: MetricsSource
  ): ObservableOrPromise<void> {
    this.secondaryDecisionLogic = this.secondaryDecisionLogic ?? new RoundRobinDecisionLogic();
    super.configure(orchestrator, sloMapping, metricsSource);
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
> {
}

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
