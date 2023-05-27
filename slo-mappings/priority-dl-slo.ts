import {ApiObjectMetadata, SloTarget} from '@polaris-sloc/core';
import {
  CpuUtilizationSloMapping,
  CpuUtilizationSloMappingSpec,
  PriorityDecisionLogic,
  RoundRobinDecisionLogic,
} from '@org/slos';
import {HorizontalElasticityStrategyKind, VerticalElasticityStrategyKind} from '@polaris-sloc/common-mappings';

const elasticityConfig = {
  maxResources: {
    milliCpu: 200,
    memoryMiB: 100
  },
  minResources: {
    milliCpu: 50,
    memoryMiB: 50
  },
  minReplicas: 1,
  maxReplicas: 10,
}

export default new CpuUtilizationSloMapping({
  metadata: new ApiObjectMetadata({
    namespace: 'polaris',
    name: 'cpu-utilization',
  }),
  spec: new CpuUtilizationSloMappingSpec({
    targetRef: new SloTarget({
      group: 'apps',
      version: 'v1',
      kind: 'Deployment',
      name: 'http-stress',
    }),
    elasticityStrategy: new HorizontalElasticityStrategyKind(),
    secondaryElasticityStrategy: new VerticalElasticityStrategyKind(),
    elasticityDecisionLogic: new PriorityDecisionLogic(elasticityConfig),
    sloConfig: {
      targetUtilizationPercentage: 50
    },
    stabilizationWindow: {
      scaleDownSeconds: 0,
      scaleUpSeconds: 0
    },
    staticElasticityStrategyConfig: elasticityConfig
  }),
});
