import {
  Container,
  ContainerResources,
  ElasticityStrategy,
  PolarisRuntime,
  SloCompliance,
  SloTarget,
  VerticalElasticityStrategyControllerBase,
} from '@polaris-sloc/core';
import {VerticalElasticityStrategyConfig} from '@polaris-sloc/common-mappings';

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

  computeResources(
    elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>,
    container: Container,
  ): Promise<ContainerResources> {
    let ret: ContainerResources;
    if (elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage > 100) {
      ret = this.scaleUp(elasticityStrategy.spec.staticConfig, container.resources);
    } else {
      ret = this.scaleDown(elasticityStrategy.spec.staticConfig, container.resources);
    }
    return Promise.resolve(ret);
  }

  private scaleUp(config: VerticalElasticityStrategyConfig, resources: ContainerResources): ContainerResources {
    const scaleUpPercent = this.getScaleUpPercentOrDefault(config) / 100;
    return resources.scale(
      (name, value) => value + value * scaleUpPercent,
    );
  }

  private scaleDown(config: VerticalElasticityStrategyConfig, resources: ContainerResources): ContainerResources {
    const scaleDownPercent = this.getScaleDownPercentOrDefault(config) / 100;
    return resources.scale(
      (name, value) => value - value * scaleDownPercent,
    );
  }
}
