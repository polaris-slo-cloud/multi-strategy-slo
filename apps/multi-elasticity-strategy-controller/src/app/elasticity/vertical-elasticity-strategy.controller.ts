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
    const sloCompliance = elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage;
    let ret: ContainerResources;
    if (sloCompliance > 100) {
      ret = this.scaleUp(sloCompliance, container.resources);
    } else {
      ret = this.scaleDown(sloCompliance, container.resources);
    }
    return Promise.resolve(ret);
  }

  private scaleUp(sloCompliance: number, resources: ContainerResources): ContainerResources {
    const scaleUpPercent = sloCompliance / 100;
    return resources.scale(
      (name, value) => value * scaleUpPercent,
    );
  }

  private scaleDown(sloCompliance: number, resources: ContainerResources): ContainerResources {
    const scaleDownPercent = sloCompliance / 100;
    return resources.scale(
      (name, value) => value * scaleDownPercent,
    );
  }
}
