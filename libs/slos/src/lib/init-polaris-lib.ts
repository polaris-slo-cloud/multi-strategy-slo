import { PolarisRuntime } from '@polaris-sloc/core';
import {CpuUtilizationSloMapping} from './slo-mappings/cpu-utilization.slo-mapping.prm';
import {AverageCpuUtilizationMetricMapping} from './metrics/average-cpu-utilization-metric.prm';

/**
 * Initializes this library and registers its types with the transformer in the `PolarisRuntime`.
 */
export function initPolarisLib(polarisRuntime: PolarisRuntime): void {
  polarisRuntime.transformer.registerObjectKind(
    new AverageCpuUtilizationMetricMapping().objectKind,
    AverageCpuUtilizationMetricMapping);

  polarisRuntime.transformer.registerObjectKind(
    new CpuUtilizationSloMapping().objectKind,
    CpuUtilizationSloMapping
  );
  //TODO: register decisionLogic objectkinds
}
