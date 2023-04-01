import {
  ElasticityStrategy,
  ElasticityStrategyKind,
  SloTarget,
  initSelf,
} from '@polaris-sloc/core';
import {CustomSloCompliance} from '../slo-output/custom-slo-compliance';

// ToDo after code generation:
// - Add configuration parameters to the MultiElasticityStrategyConfig interface.
// - If the elasticity strategy does not take SloCompliance objects as input,
//   adapt the first generic parameter of MultiElasticityStrategyKind and MultiElasticityStrategy accordingly.
// - If the elasticity strategy should operate on a subtype of SloTarget,
//   adapt the second generic parameter of MultiElasticityStrategyKind and MultiElasticityStrategy accordingly.
// - (optional) Replace the ObjectKind.group in the constructor of MultiElasticityStrategy with your own.
//   If you change the group name, ensure that you also accordingly adapt the `1-rbac.yaml` files of all
//   the elasticity strategy controller that needs to read and SLO controllers that need to write this ElasticityStrategy CRD.

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
