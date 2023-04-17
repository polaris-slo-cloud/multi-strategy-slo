import {
  ComposedMetricMapping,
  ComposedMetricMappingSpec,
  ComposedMetricParams,
  ComposedMetricType,
  POLARIS_API,
} from '@polaris-sloc/core';

// ToDo after code generation:
// - Add properties to the AverageCpuUtilization interface to store the value of a single metric instance.
// - Add configuration parameters to the AverageCpuUtilizationParams interface, if needed.
// - (optional) Replace `POLARIS_API.METRICS_GROUP` in AverageCpuUtilizationMetric.metricTypeName with a custom group name.
//   If you change the group name, ensure that you also accordingly adapt the `1-rbac.yaml` files of all
//   composed metric controllers and all SLO controllers that need to write this ComposedMetricType CRD.

/**
 * Represents the value of a AverageCpuUtilization metric.
 */
export interface AverageCpuUtilization {
  averageCpuUtilization: number;
}

/**
 * The parameters for retrieving the AverageCpuUtilization metric.
 */
export interface AverageCpuUtilizationParams extends ComposedMetricParams {
  timeRangeMinutes: number;
}

/**
 * Represents the type of a generic cost efficiency metric.
 */
export class AverageCpuUtilizationMetric extends ComposedMetricType<
  AverageCpuUtilization,
  AverageCpuUtilizationParams
> {
  /** The singleton instance of this type. */
  static readonly instance = new AverageCpuUtilizationMetric();

  readonly metricTypeName =
    POLARIS_API.METRICS_GROUP + '/v1/average-cpu-utilization';
}

/**
 * Used to configure a AverageCpuUtilization composed metric controller to compute
 * its metric for a specific target.
 */
export class AverageCpuUtilizationMetricMapping extends ComposedMetricMapping<
  ComposedMetricMappingSpec<AverageCpuUtilizationParams>
> {
  constructor(initData?: Partial<AverageCpuUtilizationMetricMapping>) {
    super(initData);
    this.objectKind = AverageCpuUtilizationMetricMapping.getMappingObjectKind(
      AverageCpuUtilizationMetric.instance
    );
  }
}
