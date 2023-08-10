# Load Testing

This testing approach aims to show the effects of combinations of different elasticity strategies with custom decision logics.
We use Kubernetes' [Resource Consumer](https://pkg.go.dev/k8s.io/kubernetes/test/images/resource-consumer) to generate CPU load on the target workload.
The resource consumer is triggered by an HTTP request for a short duration to generate a predefined amount of CPU millis.
In order to distribute this load over multiple instances of the target deployment, we send the HTTP requests 10 times per second.

The resulting charts should show that an elasticity strategies are used to establish compliance with the SLO.
Individual test results can be then compared by the reader.
Even though reproducibility is an important factor for testing, this approach does not allow testcases to be fully reproduced due to various reasons like I/O errors.

## Configuration and Environment

The tests presented in this document are executed using minikube with the following configuration:

    minikube start --kubernetes-version=v1.27.3
    minikube addons enable metrics-server
    minikube addons enable ingress

All base tests are carried out with the same `staticElasticityStrategyConfig`

    ...
    staticElasticityStrategyConfig:
      maxResources:
        milliCpu: 1000
        memoryMiB: 100
      minResources:
        milliCpu: 200
        memoryMiB: 50
      minReplicas: 1
      maxReplicas: 10

# CPU Load Scaling Analysis

## Linear CPU Load Changes

|                       CPU Load                       |                Best-fit strategy                 | 
|:----------------------------------------------------:|:------------------------------------------------:|
|   ![Linear CPU Load](results/linear/cpu-load.png)    |  ![Best-Fit Logic](results/linear/best-fit.png)  |
|                **Horizontal Scaling**                |               **Vertical Scaling**               |
| ![Horizontal Scaling](results/linear/horizontal.png) | ![Vertical Scaling](results/linear/vertical.png) |

## Sudden CPU Load Changes


|                         CPU Load                          |                   Best-fit strategy                   | 
|:---------------------------------------------------------:|:-----------------------------------------------------:|
|   ![Sudden CPU Load](results/sudden_load/cpu-load.png)    |  ![Best-Fit Logic](results/sudden_load/best-fit.png)  |
|                  **Horizontal Scaling**                   |                 **Vertical Scaling**                  |
| ![Horizontal Scaling](results/sudden_load/horizontal.png) | ![Vertical Scaling](results/sudden_load/vertical.png) |
