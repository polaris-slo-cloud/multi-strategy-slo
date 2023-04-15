import {ApiObjectMetadata, SloTarget} from '@polaris-sloc/core';
import {CpuUtilizationSloMapping, CpuUtilizationSloMappingSpec, RandomDecisionLogic,} from '@org/slos';
import {HorizontalElasticityStrategyKind, VerticalElasticityStrategyKind} from '@polaris-sloc/common-mappings';

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
    primaryElasticityStrategy: new HorizontalElasticityStrategyKind(),
    secondaryElasticityStrategy: new VerticalElasticityStrategyKind(),
    elasticityDecisionLogic: new RandomDecisionLogic(),
    sloConfig: {
      targetUtilizationPercentage: 50
    },
    staticElasticityStrategyConfig: {
      minReplicas: 2,
      maxReplicas: 1,
      minResources: 150,
      maxResources: 250,
    }, stabilizationWindow: {
      scaleDownSeconds: 120,
      scaleUpSeconds: 60
    }
  }),
});
