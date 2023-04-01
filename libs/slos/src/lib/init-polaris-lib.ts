import { PolarisRuntime } from '@polaris-sloc/core';
import { AvailableCpuPerPodMetricMapping } from './metrics/available-cpu-per-pod-metric.prm';
import {MultiElasticityStrategy} from './elasticity/multi-elasticity-strategy.prm';
import {CpuUtilizationSloMapping} from './slo-mappings/cpu-utilization.slo-mapping.prm';

/**
 * Initializes this library and registers its types with the transformer in the `PolarisRuntime`.
 */
export function initPolarisLib(polarisRuntime: PolarisRuntime): void {
  polarisRuntime.transformer.registerObjectKind(
    new AvailableCpuPerPodMetricMapping().objectKind,
    AvailableCpuPerPodMetricMapping
  );
  polarisRuntime.transformer.registerObjectKind(
    new MultiElasticityStrategy().objectKind,
    MultiElasticityStrategy
  );
  polarisRuntime.transformer.registerObjectKind(
    new CpuUtilizationSloMapping().objectKind,
    CpuUtilizationSloMapping
  );
}
