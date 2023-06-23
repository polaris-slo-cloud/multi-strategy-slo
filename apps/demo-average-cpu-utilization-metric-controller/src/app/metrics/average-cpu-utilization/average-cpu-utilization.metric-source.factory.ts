import {
  ComposedMetricSource,
  ComposedMetricSourceFactory,
  MetricsSource,
  ObjectKind,
  OrchestratorGateway,
} from '@polaris-sloc/core';
import {AverageCpuUtilization, AverageCpuUtilizationMetric, AverageCpuUtilizationParams,} from '@org/slos';
import {AverageCpuUtilizationMetricSource} from './average-cpu-utilization.metric-source';

/**
 * Factory for creating `AverageCpuUtilizationMetricSource` instances that supply metrics of type `AverageCpuUtilizationMetric`.
 */
export class AverageCpuUtilizationMetricSourceFactory
  implements ComposedMetricSourceFactory<
    AverageCpuUtilizationMetric,
    AverageCpuUtilization,
    AverageCpuUtilizationParams
  > {
  /**
   * The list of supported `SloTarget` types.
   *
   * This list can be used for registering an instance of this factory for each supported
   * `SloTarget` type with the `MetricsSourcesManager`. This registration must be done if the metric source should execute in the current process,
   * i.e., metric source instances can be requested through `MetricSource.getComposedMetricSource()`.
   *
   * When creating a composed metric controller, the list of compatible `SloTarget` types is determined by
   * the `ComposedMetricMapping` type.
   */
  static supportedSloTargetTypes: ObjectKind[] = [
    new ObjectKind({
      group: 'apps',
      version: 'v1',
      kind: 'Deployment',
    }),
    new ObjectKind({
      group: 'apps',
      version: 'v1',
      kind: 'StatefulSet',
    }),
    new ObjectKind({
      group: 'apps',
      version: 'v1',
      kind: 'ReplicaSet',
    }),
    new ObjectKind({
      group: 'apps',
      version: 'v1',
      kind: 'DaemonSet',
    }),
  ];

  readonly metricType = AverageCpuUtilizationMetric.instance;

  readonly metricSourceName = `${AverageCpuUtilizationMetric.instance.metricTypeName}/generic-average-cpu-utilization`;

  createSource(
    params: AverageCpuUtilizationParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ComposedMetricSource<AverageCpuUtilization> {
    return new AverageCpuUtilizationMetricSource(
      params,
      metricsSource,
      orchestrator
    );
  }
}
