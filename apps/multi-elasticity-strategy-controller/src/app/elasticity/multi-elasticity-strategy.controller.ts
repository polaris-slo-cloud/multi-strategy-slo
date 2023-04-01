import {
  DefaultStabilizationWindowTracker,
  ElasticityStrategyController,
  Logger,
  OrchestratorClient,
  PolarisRuntime,
  SloTarget,
  StabilizationWindowTracker,
} from '@polaris-sloc/core';
import {
  MultiElasticityStrategyConfig,
  MultiElasticityStrategy,
} from '@org/slos';
import {CustomSloCompliance} from '../../../../../libs/slos/src/lib/slo-output/custom-slo-compliance';
import {VerticalScaler} from './vertical-scaler';
import {HorizontalScaler} from './horizontal-scaler';

/** Tracked executions eviction interval of 20 minutes. */
const EVICTION_INTERVAL_MSEC = 20 * 60 * 1000;
const ELASTICITY_TOLERANCE = 10;

/**
 * Controller for the MultiElasticityStrategy.
 *
 * ToDo:
 *  1. If you want to restrict the type of workloads that this elasticity strategy can be applied to,
 *     change the first generic parameter from `SloTarget` to the appropriate type.
 *  2. If your elasticity strategy input is not of type `SloCompliance`, change the definition of the controller class
 *     to extend `ElasticityStrategyController` instead of `SloComplianceElasticityStrategyControllerBase`.
 *  3. Implement the `execute()` method.
 *  4. Adapt `manifests/1-rbac.yaml` to include get and update permissions on all resources that you update in the orchestrator during `execute()`.
 */
export class MultiElasticityStrategyController implements ElasticityStrategyController<
  CustomSloCompliance,
  SloTarget,
  MultiElasticityStrategyConfig
> {
  /** The client for accessing orchestrator resources. */
  private orchClient: OrchestratorClient;

  /** Tracks the stabilization windows of the ElasticityStrategy instances. */
  private stabilizationWindowTracker: StabilizationWindowTracker<MultiElasticityStrategy> =
    new DefaultStabilizationWindowTracker();

  private evictionInterval: NodeJS.Timeout;
  private readonly verticalScaler: VerticalScaler;
  private readonly horizontalScaler: HorizontalScaler;

  constructor(polarisRuntime: PolarisRuntime) {
    this.orchClient = polarisRuntime.createOrchestratorClient();

    this.evictionInterval = setInterval(
      () => this.stabilizationWindowTracker.evictExpiredExecutions(),
      EVICTION_INTERVAL_MSEC
    );
    this.verticalScaler = new VerticalScaler(this.orchClient, this.stabilizationWindowTracker);
    this.horizontalScaler = new HorizontalScaler(this.orchClient, this.stabilizationWindowTracker);
  }

  checkIfActionNeeded(elasticityStrategy: MultiElasticityStrategy): Promise<boolean> {
    const sloCompliance = elasticityStrategy.spec.sloOutputParams;
    const tolerance = sloCompliance.tolerance ?? ELASTICITY_TOLERANCE;
    const lowerBound = 100 - tolerance;
    const upperBound = 100 + tolerance;

    const actionNeeded = sloCompliance.currSloCompliancePercentage < lowerBound || sloCompliance.currSloCompliancePercentage > upperBound;
    return Promise.resolve(actionNeeded);
  }

  async execute(elasticityStrategy: MultiElasticityStrategy): Promise<void> {
    const verticalScalingAvailable = !await this.verticalScaler.isScalingConstrained(elasticityStrategy);

    if (verticalScalingAvailable) {
      await this.verticalScaler.execute(elasticityStrategy);
    } else {
      Logger.log('Cannot scale vertically, fallback to horizontal scaling...')
      await this.horizontalScaler.execute(elasticityStrategy);
    }
  }

  onDestroy(): void {
    clearInterval(this.evictionInterval);
  }

  onElasticityStrategyDeleted(
    elasticityStrategy: MultiElasticityStrategy
  ): void {
    this.stabilizationWindowTracker.removeElasticityStrategy(
      elasticityStrategy
    );
  }
}
