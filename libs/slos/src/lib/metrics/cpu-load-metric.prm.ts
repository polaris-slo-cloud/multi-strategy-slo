import {
  ComposedMetricMapping,
  ComposedMetricMappingSpec,
  ComposedMetricParams,
  ComposedMetricType,
  POLARIS_API,
} from '@polaris-sloc/core';

/**
 * Represents the value of a CpuLoad metric.
 */
export interface CpuLoad {
  cpuLoadMillis: number;
}

/**
 * The parameters for retrieving the CpuLoad metric.
 */
export interface CpuLoadParams extends ComposedMetricParams {}

/**
 * Represents the type of a generic cost efficiency metric.
 */
export class CpuLoadMetric extends ComposedMetricType<CpuLoad, CpuLoadParams> {
  /** The singleton instance of this type. */
  static readonly instance = new CpuLoadMetric();

  readonly metricTypeName = POLARIS_API.METRICS_GROUP + '/v1/cpu-load';
}

/**
 * Used to configure a CpuLoad composed metric controller to compute
 * its metric for a specific target.
 */
export class CpuLoadMetricMapping extends ComposedMetricMapping<
  ComposedMetricMappingSpec<CpuLoadParams>
> {
  constructor(initData?: Partial<CpuLoadMetricMapping>) {
    super(initData);
    this.objectKind = CpuLoadMetricMapping.getMappingObjectKind(
      CpuLoadMetric.instance
    );
  }
}
