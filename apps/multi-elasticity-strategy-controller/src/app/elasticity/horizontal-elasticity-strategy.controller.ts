import {HorizontalElasticityStrategyControllerBase, PolarisRuntime, Scale, SloTarget,} from '@polaris-sloc/core';
import {HorizontalElasticityStrategy, HorizontalElasticityStrategyConfig,} from '@polaris-sloc/common-mappings';

/**
 * Controller for the HorizontalElasticityStrategy.
 *
 */
export class HorizontalElasticityStrategyController extends HorizontalElasticityStrategyControllerBase<
  SloTarget,
  HorizontalElasticityStrategyConfig
> {

  constructor(polarisRuntime: PolarisRuntime) {
    super(polarisRuntime);
  }

  protected computeScale(elasticityStrategy: HorizontalElasticityStrategy, currScale: Scale): Promise<Scale> {
    const newScale = new Scale(currScale);
    const multiplier = elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage / 100;
    newScale.spec.replicas = Math.ceil(currScale.spec.replicas * multiplier);
    return Promise.resolve(newScale);
  }
}
