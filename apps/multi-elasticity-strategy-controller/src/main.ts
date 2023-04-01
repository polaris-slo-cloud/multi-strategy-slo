import { KubeConfig } from '@kubernetes/client-node';
import {
  MultiElasticityStrategyKind,
  initPolarisLib as initMappingsLib,
} from '@org/slos';
import { Logger } from '@polaris-sloc/core';
import { initPolarisKubernetes } from '@polaris-sloc/kubernetes';
import { MultiElasticityStrategyController } from './app/elasticity';

// Load the KubeConfig and initialize the @polaris-sloc/kubernetes library.
const k8sConfig = new KubeConfig();
k8sConfig.loadFromDefault();
const polarisRuntime = initPolarisKubernetes(k8sConfig);

// Initialize the used Polaris mapping libraries
initMappingsLib(polarisRuntime);

// Create an ElasticityStrategyManager and watch the supported elasticity strategy kinds.
const manager = polarisRuntime.createElasticityStrategyManager();
manager
  .startWatching({
    kindsToWatch: [
      {
        kind: new MultiElasticityStrategyKind(),
        controller: new MultiElasticityStrategyController(polarisRuntime),
      },
    ],
  })
  .catch((error) => {
    Logger.error(error);
    process.exit(1);
  });
