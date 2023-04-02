import {
  ComposedMetricSource,
  ComposedMetricSourceFactory,
  MetricsSource,
  ObjectKind,
  OrchestratorGateway,
} from '@polaris-sloc/core';
import {
  AvailableCpuPerPod,
  AvailableCpuPerPodMetric,
  AvailableCpuPerPodParams,
} from '@org/slos';
import { AvailableCpuPerPodMetricSource } from './available-cpu-per-pod.metric-source';

/**
 * Factory for creating `AvailableCpuPerPodMetricSource` instances that supply metrics of type `AvailableCpuPerPodMetric`.
 */
export class AvailableCpuPerPodMetricSourceFactory
  implements
    ComposedMetricSourceFactory<
      AvailableCpuPerPodMetric,
      AvailableCpuPerPod,
      AvailableCpuPerPodParams
    >
{

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

  readonly metricType = AvailableCpuPerPodMetric.instance;

  readonly metricSourceName = `${AvailableCpuPerPodMetric.instance.metricTypeName}/generic-available-cpu-per-pod`;

  createSource(
    params: AvailableCpuPerPodParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ComposedMetricSource<AvailableCpuPerPod> {
    return new AvailableCpuPerPodMetricSource(
      params,
      metricsSource,
      orchestrator
    );
  }
}
