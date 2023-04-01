import {
  Logger,
  NamespacedObjectReference,
  OrchestratorClient,
  Scale,
  StabilizationWindowTracker
} from '@polaris-sloc/core';
import {MultiElasticityStrategy, MultiElasticityStrategyConfig} from '@org/slos';

export class HorizontalScaler {

  private orchClient: OrchestratorClient;
  private stabilizationWindowTracker: StabilizationWindowTracker<MultiElasticityStrategy>;

  constructor(
    orchClient: OrchestratorClient,
    stabilizationWindowTracker: StabilizationWindowTracker<MultiElasticityStrategy>
  ) {
    this.orchClient = orchClient;
    this.stabilizationWindowTracker = stabilizationWindowTracker;
  }

  async execute(elasticityStrategy: MultiElasticityStrategy): Promise<void> {
    Logger.log('Executing elasticity strategy:', elasticityStrategy);

    const targetRef = new NamespacedObjectReference({
      namespace: elasticityStrategy.metadata.namespace,
      ...elasticityStrategy.spec.targetRef,
    });
    const currScale = await this.orchClient.getScale(targetRef);
    const oldReplicaCount = currScale.spec.replicas;

    const newScale = await this.computeScale(elasticityStrategy, currScale);
    newScale.spec.replicas = this.normalizeReplicaCount(newScale.spec.replicas, elasticityStrategy.spec.staticConfig);

    if (newScale.spec.replicas === oldReplicaCount) {
      Logger.log(
        'No scaling possible, because new replica count after min/max check is equal to old replica count.',
        newScale,
      );
      return;
    }

    if (!this.checkIfOutsideStabilizationWindow(elasticityStrategy, oldReplicaCount, newScale)) {
      Logger.log(
        `Skipping scaling from ${oldReplicaCount} to ${newScale.spec.replicas} replicas, because stabilization window has not yet passed for:`,
        elasticityStrategy,
      );
      return;
    }

    await this.orchClient.setScale(targetRef, newScale);
    this.stabilizationWindowTracker.trackExecution(elasticityStrategy);
    Logger.log(`Successfully updated scale subresource from ${oldReplicaCount} to ${newScale.spec.replicas} replicas for:`, elasticityStrategy);
  }

  private computeScale(elasticityStrategy: MultiElasticityStrategy, currScale: Scale): Scale {
    const newScale = new Scale(currScale);
    const multiplier = elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage / 100;
    newScale.spec.replicas = Math.ceil(currScale.spec.replicas * multiplier);
    return newScale;
  }

  protected getMinReplicas(config: MultiElasticityStrategyConfig): number {
    return config?.minReplicas ?? 1;
  }

  protected getMaxReplicas(config: MultiElasticityStrategyConfig): number {
    return config?.maxReplicas ?? Infinity;
  }

  private normalizeReplicaCount(newReplicaCount: number, config: MultiElasticityStrategyConfig): number {
    newReplicaCount = Math.max(newReplicaCount, this.getMinReplicas(config));
    newReplicaCount = Math.min(newReplicaCount, this.getMaxReplicas(config));
    return newReplicaCount;
  }

  private checkIfOutsideStabilizationWindow(
    elasticityStrategy: MultiElasticityStrategy,
    oldReplicaCount: number,
    newScale: Scale,
  ): boolean {
    if (newScale.spec.replicas > oldReplicaCount) {
      // We want to scale out.
      return this.stabilizationWindowTracker.isOutsideStabilizationWindowForScaleUp(elasticityStrategy);
    } else {
      // We want to scale in
      return this.stabilizationWindowTracker.isOutsideStabilizationWindowForScaleDown(elasticityStrategy);
    }
  }
}
