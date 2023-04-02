import { KubeConfig } from '@kubernetes/client-node';
import {
  CpuUtilizationSloMapping,
  CpuUtilizationSloMappingSpec,
  initPolarisLib as initSloMappingsLib,
} from '@org/slos';
import {
  Logger,
  convertToNumber,
  getEnvironmentVariable,
} from '@polaris-sloc/core';
import { initPolarisKubernetes } from '@polaris-sloc/kubernetes';
import { initPrometheusQueryBackend } from '@polaris-sloc/prometheus';
import { interval } from 'rxjs';
import { CpuUtilizationSlo } from './app/slo';

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

// Initialize the used Polaris mapping libraries
initSloMappingsLib(polarisRuntime);

// Create an SloControlLoop and register the factories for the ServiceLevelObjectives it will handle
const sloControlLoop = polarisRuntime.createSloControlLoop();
sloControlLoop.microcontrollerFactory.registerFactoryFn(
  CpuUtilizationSloMappingSpec,
  () => new CpuUtilizationSlo()
);

// Create an SloEvaluator and start the control loop with an interval read from the SLO_CONTROL_LOOP_INTERVAL_MSEC environment variable (default is 20 seconds).
const sloEvaluator = polarisRuntime.createSloEvaluator();
const intervalMsec =
  getEnvironmentVariable('SLO_CONTROL_LOOP_INTERVAL_MSEC', convertToNumber) ||
  20000;
Logger.log(
  `Starting SLO control loop with an interval of ${intervalMsec} milliseconds.`
);
sloControlLoop.start({
  evaluator: sloEvaluator,
  interval$: interval(intervalMsec),
});

// Create a WatchManager and watch the supported SLO mapping kinds.
const watchManager = polarisRuntime.createWatchManager();
watchManager
  .startWatchers(
    [new CpuUtilizationSloMapping().objectKind],
    sloControlLoop.watchHandler
  )
  .catch((error) => {
    Logger.error(error);
    process.exit(1);
  });
