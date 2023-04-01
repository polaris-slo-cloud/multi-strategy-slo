import {
  ApiObjectMetadata, Container, ContainerResources, ElasticityStrategyExecutionError, Logger, ObjectKind,
  OrchestratorClient, PodTemplateContainer, Resources,
  StabilizationWindowTracker
} from '@polaris-sloc/core';
import {MultiElasticityStrategy, MultiElasticityStrategyConfig} from '@org/slos';


const SCALE_UP_PERCENT_DEFAULT = 10;
const SCALE_DOWN_PERCENT_DEFAULT = 10;

export class VerticalScaler {

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
    Logger.log('Executing elasticity strategy: ', elasticityStrategy);
    const target = await this.loadTarget(elasticityStrategy);

    const containers = target.spec.template.spec.containers;
    if (containers?.length !== 1) {
      throw new ElasticityStrategyExecutionError(
        // eslint-disable-next-line max-len
        `VerticalElasticityStrategyControllerBase only supports targets with exactly 1 container per pod. The selected target has ${containers?.length} containers.`,
        elasticityStrategy,
      );
    }

    const container = containers[0];
    const oldResources = container.resources;
    let newResources = this.computeResources(elasticityStrategy, container);
    Logger.log(JSON.stringify(oldResources));
    Logger.log(JSON.stringify(newResources));
    newResources = this.normalizeResources(newResources, elasticityStrategy.spec.staticConfig);
    Logger.log(JSON.stringify(newResources));

    if (!this.checkIfOutsideStabilizationWindow(elasticityStrategy, container.resources, newResources)) {
      Logger.log(
        'Skipping scaling, because stabilization window has not yet passed for: ',
        elasticityStrategy,
      );
      return;
    }

    container.resources = newResources;
    await this.orchClient.update(target);
    this.stabilizationWindowTracker.trackExecution(elasticityStrategy);
    Logger.log(`Successfully scaled ${JSON.stringify(elasticityStrategy.spec.targetRef)}. OldResources ${JSON.stringify(oldResources)} to ${JSON.stringify(newResources)}`);
  }

  async isScalingConstrained(elasticityStrategy: MultiElasticityStrategy): Promise<boolean> {
    const target = await this.loadTarget(elasticityStrategy);
    const maxAllocMillis = elasticityStrategy.spec.sloOutputParams.maxAllocatableCpuMillis;
    const containers = target.spec.template.spec.containers;
    const container = containers[0];
    const oldResources = container.resources;
    let newResources = this.computeResources(elasticityStrategy, container);
    newResources = this.normalizeResources(newResources, elasticityStrategy.spec.staticConfig);
    const compliance = elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage;
    if (compliance > 100 && (newResources.milliCpu - oldResources.milliCpu) > maxAllocMillis) {
      Logger.log(`Compliance: ${compliance} > 100 && (newResources (${newResources.milliCpu}) - oldResources (${oldResources.milliCpu})) > ${maxAllocMillis}`)
      return true;
    } else if (newResources.milliCpu === oldResources.milliCpu) {
      Logger.log(`NewResources equals oldResources`)
      return true;
    }
    return false;
  }

  private async loadTarget(elasticityStrategy: MultiElasticityStrategy): Promise<PodTemplateContainer> {
    const targetRef = elasticityStrategy.spec.targetRef;
    const queryApiObj = new PodTemplateContainer({
      objectKind: new ObjectKind({
        group: targetRef.group,
        version: targetRef.version,
        kind: targetRef.kind,
      }),
      metadata: new ApiObjectMetadata({
        namespace: elasticityStrategy.metadata.namespace,
        name: targetRef.name,
      }),
    });

    const ret = await this.orchClient.read(queryApiObj);
    if (!ret.spec?.template) {
      throw new ElasticityStrategyExecutionError('The SloTarget does not contain a pod template (spec.template field).', elasticityStrategy);
    }
    return ret;
  }

  private computeResources(elasticityStrategy: MultiElasticityStrategy, container: Container): ContainerResources {
    if (elasticityStrategy.spec.sloOutputParams.currSloCompliancePercentage > 100) {
      return this.scaleUp(elasticityStrategy.spec.staticConfig, container.resources);
    } else {
      return this.scaleDown(elasticityStrategy.spec.staticConfig, container.resources);
    }
  }

  private scaleUp(config: MultiElasticityStrategyConfig, resources: ContainerResources): ContainerResources {
    const scaleUpPercent = this.getScaleUpPercentOrDefault(config) / 100;
    return this.scaleCpuMillis(
      (name, value) => value + value * scaleUpPercent, resources
    );
  }

  private scaleDown(config: MultiElasticityStrategyConfig, resources: ContainerResources): ContainerResources {
    const scaleDownPercent = this.getScaleDownPercentOrDefault(config) / 100;
    return this.scaleCpuMillis(
      (name, value) => value - value * scaleDownPercent, resources
    );
  }

  private normalizeResources(resources: ContainerResources, config: MultiElasticityStrategyConfig): ContainerResources {
    return this.scaleCpuMillis((key, value) => {
      value = Math.max(config.minResources, value);
      value = Math.min(config.maxResources, value);
      return value;
    }, resources);
  }

  private scaleCpuMillis(
    scalingFn: (resourceName: keyof Resources, currValue: number) => number,
    resources: ContainerResources
  ): ContainerResources {
    return resources.scale((key, value) => {
      if (key.toString() === 'milliCpu') {
        return scalingFn(key, value);
      } else {
        return value;
      }
    });
  }

  private checkIfOutsideStabilizationWindow(
    elasticityStrategy: MultiElasticityStrategy,
    oldResources: Resources,
    newResources: Resources,
  ): boolean {
    const isScaleUp = Object.keys(newResources)
      .some((key: keyof Resources) => newResources[key] > oldResources[key]);

    if (isScaleUp) {
      return this.stabilizationWindowTracker.isOutsideStabilizationWindowForScaleUp(elasticityStrategy);
    } else {
      return this.stabilizationWindowTracker.isOutsideStabilizationWindowForScaleDown(elasticityStrategy);
    }
  }

  private getScaleUpPercentOrDefault(config: MultiElasticityStrategyConfig): number {
    return config.scaleUpPercent || SCALE_UP_PERCENT_DEFAULT;
  }

  private getScaleDownPercentOrDefault(config: MultiElasticityStrategyConfig): number {
    return config.scaleDownPercent || SCALE_DOWN_PERCENT_DEFAULT;
  }

}
