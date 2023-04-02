# Average CPU Utilization SLO with multiple elasticity strategies

A customer can specify a target CPU utilization service level objective for a target object using the Polaris Cloud SLO Framework.
The SLO controller measures the average CPU usage accross all pods of the target objects over a 5 minute duration. Both composed metrics and time serires queries are used to not only gather CPU utilization percentage, but also to collect available resources per container accross all nodes, on which the pods are present.

The elasticity strategy controller and slo contoller are connected by a subtype of SloCompliance containing *currSloCompliancePercentage* and *maxAllocatableCpuMillis*. This mapping is then used by a so called MultiElasticityStrategy that scales the target object vertically as well as horizontally.

MultiElasticityStrategy uses the *maxAllocatableCpuMillis* and static configuration provided by the customer to decide whether to scale vertically or horizontally. Vertical scaling is favored over horizontal scaling meaning the target is scaled up or down if it is within the specified bounds. If vertical scaling would violate any resource constraints or static configuration properties, horizontal scaling is applied. The vertical scaling strategy is fair, therefore every container gets the same resource allocation.

In order to scrape metrics correctly, the target objects need to have resource limits configured, which is then automatically changed by the MultiElasticityStrategy.

## Prerequisite

- node 16
- any virtualization software
- Debian install image

## Install

Create at least one (preferably two) virtual machines, then install Debian on these virtual machines. Configure the virtual machines:

- static IP address
- make sure that computers can discover each other by name, if not edit /etc/hosts
- install snap
- install microk8s

Join the worker nodes to the microk8s cluster.
Enable required services:

    microk8s enable dns rbac helm3 metrics-server

Get prometheus helm chart:

    microk8s helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    microk8s helm repo update

On the microk8s cluster install prometheus stack in the monitoring namespace with custom values.yaml, that enables prometheus logging to stdout and restores some cadvisor metrics.

    microk8s helm install prometheus prometheus-community/kube-prometheus-stack --values ./helm-values/prometheus-values.yaml -n monitoring

Install all CRDs, then apply all manifest files using:

    microk8s kubectl apply -f "path to folder" -n polaris


At this points you can deploy your application that is referenced by the SLO mapping.

## Test

In order to test the CPU utilization SLO, I created a simple python image that generates CPU for every HTTP request: https://github.com/stvnkiss/rest-cpu-stress

Create stress deployment:

    microk8s kubectl create deployment http-stress --image=stvnkiss/http-stress --replicas=2 --port=8000 -n polaris
    microk8s kubectl set resources deployment http-stress --requests=cpu=200m,memory=256Mi --limits=cpu=200m,memory=256Mi -n polaris

Serialize the SLO mapping:

    polaris-cli serialize demo-cpu-slo > slo-mapping.yaml

Apply SLO mapping:

    microk8s kubectl apply -f slo-mapping.yaml -n polaris

In order to apply load you can port-forward the service port using the following commands:

    microk8s kubectl expose deployment/http-stress -n polaris
    microk8s kubectl port-forward service/http-stress 8080:8000 --address='0.0.0.0' -n polaris

Test service:

    curl 'address:8080?seconds=10'

## Debug

You can use Grafana shipped with *prometheus-community*

    microk8s kubectl get secret prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode; echo -n monitoring
    microk8s kubectl expose service prometheus-grafana --type=NodePort --target-port=3000 -n monitoring
    microk8s kubectl port-forward service/grafana-ext 9090:3000 --address='0.0.0.0' -n monitoring


*watch* curl and port-forward in case of service restarts or pod restarts to keep the CPU load high.
