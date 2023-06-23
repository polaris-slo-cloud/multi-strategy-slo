import {
  ComposedMetricSource,
  ComposedMetricSourceFactory,
  MetricsSource,
  ObjectKind,
  OrchestratorGateway,
} from '@polaris-sloc/core';
import { CpuLoad, CpuLoadMetric, CpuLoadParams } from '@org/slos';
import { CpuLoadMetricSource } from './cpu-load.metric-source';

/**
 * Factory for creating `CpuLoadMetricSource` instances that supply metrics of type `CpuLoadMetric`.
 */
export class CpuLoadMetricSourceFactory
  implements ComposedMetricSourceFactory<CpuLoadMetric, CpuLoad, CpuLoadParams>
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

  readonly metricType = CpuLoadMetric.instance;

  readonly metricSourceName = `${CpuLoadMetric.instance.metricTypeName}/generic-cpu-load`;

  createSource(
    params: CpuLoadParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ): ComposedMetricSource<CpuLoad> {
    return new CpuLoadMetricSource(params, metricsSource, orchestrator);
  }
}
