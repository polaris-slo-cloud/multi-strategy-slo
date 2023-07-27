import {
  Container,
  ContainerResources,
  ElasticityStrategy, NamespacedObjectReference,
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

  async computeResources(
    elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>,
    container: Container,
  ): Promise<ContainerResources> {
    const sloCompliance = this.readCompliance(elasticityStrategy);
    let ret: ContainerResources;
    if (sloCompliance > 100) {
      ret = await this.scaleUp(elasticityStrategy, container.resources);
    } else {
      ret = await this.scaleDown(elasticityStrategy, container.resources);
    }
    return ret;
  }

  private async scaleUp(
    elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>,
    resources: ContainerResources
  ): Promise<ContainerResources> {
    const diff = this.readCompliance(elasticityStrategy) - 100;
    const scaleUpPercent = (100 + diff) / 100;
    return resources.scale(
      (name, value) => value * scaleUpPercent,
    );
  }

  private async scaleDown(
    elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>,
    resources: ContainerResources
  ): Promise<ContainerResources> {
    const diff = Math.abs(this.readCompliance(elasticityStrategy) - 100);
    const scaleDownPercent = (100 - diff) / 100;
    return resources.scale(
      (name, value) => value * scaleDownPercent,
    );
  }

  private async getScale(elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>): Promise<number> {
    const targetRef = new NamespacedObjectReference({
      namespace: elasticityStrategy.metadata.namespace,
      ...elasticityStrategy.spec.targetRef,
    });
    const currScale = await this.orchClient.getScale(targetRef);
    return currScale.spec.replicas;
  }

  private readCompliance(elasticityStrategy: ElasticityStrategy<SloCompliance, SloTarget, VerticalElasticityStrategyConfig>): number {
    return elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage;
  }
}
