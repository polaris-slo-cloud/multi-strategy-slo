import {
  ComposedMetricSourceBase, LabelFilters, Logger,
  MetricsSource,
  OrchestratorGateway,
  Sample,
} from '@polaris-sloc/core';
import { AvailableCpuPerPod, AvailableCpuPerPodParams } from '@org/slos';
import { Observable } from 'rxjs';
import {switchMap, tap} from 'rxjs/operators';

// ToDo:
// 1. Adapt the list of `supportedSloTargetTypes` in `AvailableCpuPerPodMetricSourceFactory` (see available-cpu-per-pod.metric-source.factory.ts).
// 2. Adapt the `AvailableCpuPerPodMetricSourceFactory.metricSourceName`, if needed (e.g., if there are multiple sources for AvailableCpuPerPodMetric that differ
//    based on the supported SloTarget types).
// 3. Implement `AvailableCpuPerPodMetricSource.getValueStream()` to compute the metric.
// 4. Adapt the `release` label in `../../../../manifests/kubernetes/3-service-monitor.yaml` to ensure that Prometheus will scrape this controller.

/**
 * Computes the `AvailableCpuPerPod` composed metric.
 */
export class AvailableCpuPerPodMetricSource extends ComposedMetricSourceBase<AvailableCpuPerPod> {
  constructor(
    private params: AvailableCpuPerPodParams,
    metricsSource: MetricsSource,
    orchestrator: OrchestratorGateway
  ) {
    super(metricsSource, orchestrator);
  }

  getValueStream(): Observable<Sample<AvailableCpuPerPod>> {
    return this.getDefaultPollingInterval().pipe(
      switchMap(() => this.getMaxAllocatableResources())
    );
  }

  private async getPodNodes(): Promise<{node: string, count: number}[]> {
    const podNodesQuery = await this.metricsSource.getTimeSeriesSource()
      .select('kube', 'pod_info')
      .filterOnLabel(LabelFilters.regex('pod', `${this.params.sloTarget.name}.*`))
      .execute();
    if (podNodesQuery.results) {
      const countPerNode = podNodesQuery.results.reduce((prev, curr) => {
        const node = curr.labels['node'];
        prev[node] = (prev[node] ?? 0) + 1;
        return prev;
      }, {});
      return Object.keys(countPerNode)
        .map(node => ({node, count: countPerNode[node]}));
    }
  }

  private async getAllocatableResources(): Promise<{node: string, allocatable: number}[]> {
    const allocQuery = await this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'node_status_allocatable')
      .filterOnLabel(LabelFilters.equal('resource', 'cpu'))
      .execute();
    if (allocQuery.results) {
      return allocQuery.results.map(x => {
        return {
          node: x.labels['node'],
          allocatable: x.samples[0].value
        };
      });
    }
  }

  private async getPodContainerResourceRequests(): Promise<{node: string, requests: number}[]> {
    const reqQuery = await this.metricsSource.getTimeSeriesSource()
      .select<number>('kube', 'pod_container_resource_requests')
      .filterOnLabel(LabelFilters.equal('resource', 'cpu'))
      .execute();
    Logger.log(JSON.stringify(reqQuery.results));
    if (reqQuery.results) {
      const requests = reqQuery.results.reduce((prev, curr) => {
        const sample = curr.samples[0].value;
        const node = curr.labels['node'];
        prev[node] = (prev[node] ?? 0) + sample;
        return prev;
      }, {});
      return Object.keys(requests)
        .map(node => ({node, requests: requests[node]}));
    }
  }

  private async getMaxAllocatableResources(): Promise<Sample<AvailableCpuPerPod>> {
    const [ podNodes, allocation, requested ] = await Promise.all([
      this.getPodNodes(),
      this.getAllocatableResources(),
      this.getPodContainerResourceRequests()
    ]);

    const getNodeCount = (node: string) => {
      return podNodes.find(x => x.node === node)?.count;
    };

    const maxAllocatable = allocation.filter(x => getNodeCount(x.node) !== undefined)
      .map(x => (x.allocatable - (requested.find(y => y.node === x.node)?.requests ?? 0)) / getNodeCount(x.node));
    const value = Math.min(...maxAllocatable);
    const corrected = isNaN(value) ? 0 : value;
    return {
      value: { maxAllocatable: corrected },
      timestamp: Date.now()
    }
  }
}
