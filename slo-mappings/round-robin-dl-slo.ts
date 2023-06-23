import {ApiObjectMetadata, SloTarget} from '@polaris-sloc/core';
import {CpuUtilizationSloMapping, CpuUtilizationSloMappingSpec} from '@org/slos';
import {HorizontalElasticityStrategyKind, VerticalElasticityStrategyKind} from '@polaris-sloc/common-mappings';
import {RoundRobinDecisionLogic} from "../libs/slos/src/lib/slo-mappings/decision-logic/round-robin.edl";

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
    elasticityDecisionLogic: new RoundRobinDecisionLogic(),
    sloConfig: {
      targetUtilizationPercentage: 50
    },
    stabilizationWindow: {
      scaleDownSeconds: 0,
      scaleUpSeconds: 0
    },
    staticElasticityStrategyConfig: {
      maxResources: {
        milliCpu: 250,
        memoryMiB: 250
      },
      minResources: {
        milliCpu: 150,
        memoryMiB: 150
      },
      minReplicas: 1,
      maxReplicas: 2,
    }
  }),
});
