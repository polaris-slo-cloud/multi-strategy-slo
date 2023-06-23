import { KubeConfig } from '@kubernetes/client-node';
import {
  CpuLoadMetric,
  CpuLoadMetricMapping,
  initPolarisLib as initCompMetricsLib,
} from '@org/slos';
import {
  COMPOSED_METRIC_COMPUTATION_DEFAULT_INTERVAL_MS,
  Logger,
  convertToNumber,
  getEnvironmentVariable,
} from '@polaris-sloc/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { initPolarisKubernetes } from '@polaris-sloc/kubernetes';
import {
  PrometheusComposedMetricsCollectorManager,
  initPrometheusQueryBackend,
} from '@polaris-sloc/prometheus';
import { CpuLoadMetricSourceFactory } from './app/metrics';

// Load the KubeConfig and initialize the @polaris-sloc/kubernetes library.
const k8sConfig = new KubeConfig();
k8sConfig.loadFromDefault();
const polarisRuntime = initPolarisKubernetes(k8sConfig);

// Initialize the Prometheus query backend.
const promHost = getEnvironmentVariable('PROMETHEUS_HOST') || 'localhost';
const promPort =
  getEnvironmentVariable('PROMETHEUS_PORT', convertToNumber) || 9090;
initPrometheusQueryBackend(
  polarisRuntime,
  { host: promHost, port: promPort },
  true
);

// Initialize any required Polaris mapping or composed metric libraries here.
initCompMetricsLib(polarisRuntime);

const cpuLoadMetricSourceFactory = new CpuLoadMetricSourceFactory();
CpuLoadMetricSourceFactory.supportedSloTargetTypes.forEach(
  sloTargetType => polarisRuntime.metricsSourcesManager.addComposedMetricSourceFactory(cpuLoadMetricSourceFactory, sloTargetType),
);

// Create the Prometheus scrapable endpoint.
const metricsEndpointPath = getEnvironmentVariable(
  'PROMETHEUS_METRICS_ENDPOINT_PATH'
);
const metricsEndpointPort = getEnvironmentVariable(
  'PROMETHEUS_METRICS_ENDPOINT_PORT',
  convertToNumber
);
const promMetricsCollectorManager =
  new PrometheusComposedMetricsCollectorManager();
promMetricsCollectorManager.start({
  path: metricsEndpointPath,
  port: metricsEndpointPort,
});

// Create a ComposedMetricsManager and watch the supported composed metric type kinds.
const manager = polarisRuntime.createComposedMetricsManager();
const intervalMsec =
  getEnvironmentVariable(
    'COMPOSED_METRIC_COMPUTATION_INTERVAL_MS',
    convertToNumber
  ) || COMPOSED_METRIC_COMPUTATION_DEFAULT_INTERVAL_MS;
Logger.log(
  `Starting ComposedMetricsManager with a computation interval of ${intervalMsec} milliseconds.`
);
manager
  .startWatching({
    evaluationIntervalMs: intervalMsec,
    collectorFactories: [promMetricsCollectorManager],
    kindsToWatch: [
      {
        mappingKind: new CpuLoadMetricMapping().objectKind,
        metricType: CpuLoadMetric.instance,
        metricSourceFactory: new CpuLoadMetricSourceFactory(),
      },
    ],
  })
  .catch((error) => {
    Logger.error(error);
    process.exit(1);
  });
