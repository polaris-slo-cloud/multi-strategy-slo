import {
  ComposedMetricMapping,
  ComposedMetricMappingSpec,
  ComposedMetricParams,
  ComposedMetricType,
  POLARIS_API,
} from '@polaris-sloc/core';

// ToDo after code generation:
// - Add properties to the AvailableCpuPerPod interface to store the value of a single metric instance.
// - Add configuration parameters to the AvailableCpuPerPodParams interface, if needed.
// - (optional) Replace `POLARIS_API.METRICS_GROUP` in AvailableCpuPerPodMetric.metricTypeName with a custom group name.
//   If you change the group name, ensure that you also accordingly adapt the `1-rbac.yaml` files of all
//   composed metric controllers and all SLO controllers that need to write this ComposedMetricType CRD.

/**
 * Represents the value of a AvailableCpuPerPod metric.
 */
export interface AvailableCpuPerPod {
  maxAllocatable: number;
}

/**
 * The parameters for retrieving the AvailableCpuPerPod metric.
 */
export interface AvailableCpuPerPodParams extends ComposedMetricParams {}

/**
 * Represents the type of a generic cost efficiency metric.
 */
export class AvailableCpuPerPodMetric extends ComposedMetricType<
  AvailableCpuPerPod,
  AvailableCpuPerPodParams
> {
  /** The singleton instance of this type. */
  static readonly instance = new AvailableCpuPerPodMetric();

  readonly metricTypeName =
    POLARIS_API.METRICS_GROUP + '/v1/available-cpu-per-pod';
}

/**
 * Used to configure a AvailableCpuPerPod composed metric controller to compute
 * its metric for a specific target.
 */
export class AvailableCpuPerPodMetricMapping extends ComposedMetricMapping<
  ComposedMetricMappingSpec<AvailableCpuPerPodParams>
> {
  constructor(initData?: Partial<AvailableCpuPerPodMetricMapping>) {
    super(initData);
    this.objectKind = AvailableCpuPerPodMetricMapping.getMappingObjectKind(
      AvailableCpuPerPodMetric.instance
    );
  }
}
