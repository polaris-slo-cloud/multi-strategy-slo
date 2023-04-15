import {
  Container,
  ContainerResources,
  PolarisRuntime,
  SloTarget,
  VerticalElasticityStrategyControllerBase,
} from '@polaris-sloc/core';
import {VerticalElasticityStrategy, VerticalElasticityStrategyConfig} from '@polaris-sloc/common-mappings';

/**
 * Controller for the VerticalElasticityStrategy.
 *
 */
export class VerticalElasticityStrategyController extends VerticalElasticityStrategyControllerBase<
  SloTarget,
  VerticalElasticityStrategyConfig
> {

  constructor(polarisRuntime: PolarisRuntime) {
    super(polarisRuntime);
  }

  computeResources(elasticityStrategy: VerticalElasticityStrategy, container: Container): Promise<ContainerResources> {
    return Promise.resolve(undefined);
  }
}
