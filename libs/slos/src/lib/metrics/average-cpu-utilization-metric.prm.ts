import {
  ComposedMetricMapping,
  ComposedMetricMappingSpec,
  ComposedMetricParams,
  ComposedMetricType,
  POLARIS_API,
} from '@polaris-sloc/core';

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
