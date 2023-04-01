import { ApiObjectMetadata, SloTarget } from '@polaris-sloc/core';
import {
  CpuUtilizationSloMapping,
  CpuUtilizationSloMappingSpec, MultiElasticityStrategyKind,
} from '@org/slos';

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
      name: 'nginx-deployment',
    }),
    elasticityStrategy: new MultiElasticityStrategyKind(),
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
