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
    return Promise.resolve(undefined);
  }
}
