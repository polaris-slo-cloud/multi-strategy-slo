import {
  ElasticityStrategy,
  ElasticityStrategyKind,
  SloTarget,
  initSelf,
} from '@polaris-sloc/core';
import {CustomSloCompliance} from '../slo-output/custom-slo-compliance';


/**
 * Configuration options for MultiElasticityStrategy.
 */
export interface MultiElasticityStrategyConfig {
  minReplicas: number;
  maxReplicas: number;
  minResources: number;
  maxResources: number;
  scaleUpPercent?: number;
  scaleDownPercent?: number;
}

/**
 * Denotes the elasticity strategy kind for the MultiElasticityStrategy.
 */
export class MultiElasticityStrategyKind extends ElasticityStrategyKind<
  CustomSloCompliance,
  SloTarget
> {
  constructor() {
    super({
      group: 'elasticity.polaris-slo-cloud.github.io',
      version: 'v1',
      kind: 'MultiElasticityStrategy',
    });
  }
}

/**
 * Defines the MultiElasticityStrategy.
 */
export class MultiElasticityStrategy extends ElasticityStrategy<
  CustomSloCompliance,
  SloTarget,
  MultiElasticityStrategyConfig
> {
  constructor(initData?: Partial<MultiElasticityStrategy>) {
    super(initData);
    this.objectKind = new MultiElasticityStrategyKind();
    initSelf(this, initData);
  }
}
