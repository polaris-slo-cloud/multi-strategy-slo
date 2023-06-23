import {PolarisRuntime} from '@polaris-sloc/core';
import {
  BestFitElasticityDecisionLogic,
  CpuUtilizationSloMapping,
  ElasticityDecisionLogic,
  PriorityDecisionLogic,
  RandomDecisionLogic,
  RoundRobinDecisionLogic,
  ThresholdBasedDecisionLogic,
  TimeAwareDecisionLogic
} from './slo-mappings/cpu-utilization.slo-mapping.prm';
import {AverageCpuUtilizationMetricMapping} from './metrics/average-cpu-utilization-metric.prm';
import {ElasticityDecisionLogicTransformer} from "./transformer/elasticity-decision-logic.transformer";
import {
  HorizontalElasticityStrategy,
  HorizontalElasticityStrategyKind,
  VerticalElasticityStrategy,
  VerticalElasticityStrategyKind
} from "@polaris-sloc/common-mappings";
import {CpuLoadMetricMapping} from "./metrics/cpu-load-metric.prm";

/**
 * Initializes this library and registers its types with the transformer in the `PolarisRuntime`.
 */
export function initPolarisLib(polarisRuntime: PolarisRuntime): void {
  registerObjectKinds(polarisRuntime);
  registerPolarisTransformers(polarisRuntime);
}

function registerObjectKinds(polarisRuntime: PolarisRuntime) {
  polarisRuntime.transformer.registerObjectKind(
    new AverageCpuUtilizationMetricMapping().objectKind,
    AverageCpuUtilizationMetricMapping
  );
  polarisRuntime.transformer.registerObjectKind(
    new CpuLoadMetricMapping().objectKind,
    CpuLoadMetricMapping
  );
  polarisRuntime.transformer.registerObjectKind(
    new CpuUtilizationSloMapping().objectKind,
    CpuUtilizationSloMapping
  );
  polarisRuntime.transformer.registerObjectKind(
    new RoundRobinDecisionLogic(),
    RoundRobinDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new RandomDecisionLogic(),
    RandomDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new PriorityDecisionLogic(),
    PriorityDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new TimeAwareDecisionLogic(),
    TimeAwareDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new ThresholdBasedDecisionLogic(),
    ThresholdBasedDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new BestFitElasticityDecisionLogic(),
    BestFitElasticityDecisionLogic
  );
  polarisRuntime.transformer.registerObjectKind(
    new VerticalElasticityStrategyKind(),
    VerticalElasticityStrategy
  );
  polarisRuntime.transformer.registerObjectKind(
    new HorizontalElasticityStrategyKind(),
    HorizontalElasticityStrategy
  );
}

function registerPolarisTransformers(polarisRuntime: PolarisRuntime) {
  polarisRuntime.transformer.registerTransformer(
    ElasticityDecisionLogic,
    new ElasticityDecisionLogicTransformer(),
    { inheritable: true }
  );
}
