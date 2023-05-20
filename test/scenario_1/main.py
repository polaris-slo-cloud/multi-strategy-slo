#0. install prometheus community helm chart
#1. apply polaris kubernetes yamls
#2. set testing parameters!
#2. apply workload
#3. apply slo mapping & set start time
#4. run until prometheus reaches last value
#5. query prometheus from start to now (cpu usage, number of instances, resources cpu, memory)
#6. save raw
#7. plot


# CPU USAGE METRIC
#kube_deployment_spec_replicas{deployment="pause-deployment"} - number of instances
#sum(kube_pod_container_resource_limits{pod=~"pause-deployment.*", resource="cpu"}) - cpu req, limit
#sum(kube_pod_container_resource_limits{pod=~"pause-deployment.*", resource="memory"}) - memory req, limit
#kubectl wait pods -n polaris --all --for condition=Ready --timeout=90s

import subprocess
import os
import time
import requests
import matplotlib.pyplot as plt
import datetime

namespace = 'polaris'
slo_controller_interval_ms = 5000
metric_controller_interval_ms = 3000

prometheus_port = 9090

lib_crds = [
    	'crds'
	]
apps = [
    	'average-cpu-utilization',
    	'demo-metric-controller',
    	'multi-elasticity-strategy'
	]


cpu_usage_metric = 'polaris_composed_metrics_polaris_slo_cloud_github_io_v1_average_cpu_utilization'


def create_from_paths(paths):
	for path in paths:
		path = f'{os.path.dirname(os.path.abspath(__file__))}/{path}'
		subprocess.call(['kubectl', 'apply', '-f', path])


def delete_from_paths(paths):
	for path in paths:
		path = f'{os.path.dirname(os.path.abspath(__file__))}/{path}'
		subprocess.call(['kubectl', 'delete', '-f', path])


def setup_polaris():
	create_from_paths(lib_crds)
	create_from_paths(apps)


def tear_down_polaris():
	delete_from_paths(apps)
	delete_from_paths(lib_crds)


def apply_yaml(yaml_file):
	create_from_paths([yaml_file])


def delete_yaml(yaml_file):
	delete_from_paths([yaml_file])


def wait_all_ready():
	subprocess.call(['kubectl', 'wait', 'pods', '-n', 'polaris', '--all', '--for=condition=Ready', '--timeout=90s'])


def unix_timestamp():
	return int(time.time_ns() / 1000 / 1000 / 1000)


def setup_prometheus_connection():
	service = 'service/prometheus-kube-prometheus-prometheus'
	port = prometheus_port
	command = ['kubectl', 'port-forward', service, f'{port}:{port}', '-n', 'monitoring']
	return subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def query_prometheus(promql_query, start, end):
    url = f'http://localhost:{prometheus_port}/api/v1/query_range'
    params = {
    'query': promql_query,
    'start': start,
    'end': end,
    'step': 5
    }
    
    response = requests.get(url, params=params)
    print(response.url)
    if response.status_code == 200:
        data = response.json()
        print(response.url)
        print(data)
        return data
    else:
        print(f"Request failed with status code: {response.status_code}")
        exit(1)

def extract_query_result(result):
	return result['data']['result'][0]['values'];


def get_cpu_usage_instant():
	metric = cpu_usage_metric
	url = f'http://localhost:{prometheus_port}/api/v1/query'
	time = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
	params = {
	'query': metric,
	'time': time
	}

	response = requests.get(url, params=params)
	if response.status_code == 200:
		data = response.json()
		return data['data']['result'][0]['value'][1]
	else:
		print(f"Request failed with status code: {response.status_code}")
		exit(1)


def wait_for_value(value):
	cpu_usage = None
	error_counter = 0
	max_error = 50
	while cpu_usage != value:
		try:
			cpu_usage = int(get_cpu_usage_instant())
			print(f'Current CPU usage: {cpu_usage}')
			if cpu_usage == value:
				print('Desired CPU usage reached.')
				return
			error_counter = 0
		except IndexError:
			print('Waiting for metric to be available...')
		except Exception as e:
			print(f'Error count: {error_counter}')
			print(e)
			error_counter += 1
		finally:
			if error_counter >= max_error:
				print('Max error count reached. Exiting.')
				return
			time.sleep(5)




def get_cpu_usage(start, end):
	metric = cpu_usage_metric
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return result


def get_replica_count(deployment_name, start, end):
	metric = f'kube_deployment_spec_replicas{{deployment="{deployment_name}"}}'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return result

def get_cpu_resource_req(deployment_name, start, end):
	metric = f'sum(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="cpu"}})'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return result


def get_mem_resource_req(deployment_name, start, end):
	metric = f'sum(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="memory"}})'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return result


def execute_test():
	wait_for_value(0)
	print('Starting to track metrics...')
	start = unix_timestamp()
	#put workload into env var
	wait_for_value(1)
	end = unix_timestamp()
	deployments = ['test-pause-deployment', 'reference-pause-deployment']

	fig, axs = plt.subplots(nrows=4, ncols=1, sharex=True)
	plot_samples(axs[0], get_cpu_usage(start, end), 'CPU Usage')

	for deployment in deployments:
		cpu_req = get_cpu_resource_req(deployment, start, end)
		mem_req = get_mem_resource_req(deployment, start, end)
		pod_count = get_replica_count(deployment, start, end)
		plot_samples(axs[1], cpu_req, 'CPU Request')
		plot_samples(axs[2], mem_req, 'Memory Request')
		plot_samples(axs[3], pod_count, 'Pod Count')
		

	plt.tight_layout()
	plt.show()


def plot_samples(axs, samples, label):
	time = extract_timestamps(samples)
	value = extract_values(samples)
	axs.plot(time, value, label=label)
	axs.set_title(label)
	axs.set_xlabel('Time')
	axs.set_ylabel('Value')
	axs.legend()


def extract_timestamps(samples):
	return [int(sublist[0]) for sublist in samples]


def extract_values(samples):
	return [float(sublist[1]) for sublist in samples]


def cleanup_prometheus():
	metrics = [
	cpu_usage_metric,
	'kube_deployment_spec_replicas',
	'kube_pod_container_resource_limits'
	]

	for metric in metrics:
		url = f'http://localhost:{prometheus_port}/api/v1/admin/tsdb/delete_series'
		params = {
		'match[]': metric
		}

		response = requests.post(url, params=params)
		if response.status_code != 204:
			print(f"Prometheus cleanup failed with status code: {response.status_code}")


def main():
	print("Starting test setup...")
	test_subjects = ['workload_test.yaml', 'workload_reference.yaml', 'slo-mapping_test.yaml', 'slo-mapping_reference.yaml']
	setup_polaris()
	create_from_paths(test_subjects)
	wait_all_ready()
	proxy = None

	try:
		print("Setting up Prometheus connection...")
		proxy = setup_prometheus_connection()
		print("Executing test...")
		execute_test()
	except Exception as e:
		print(f"Error during execution: {e}")
	finally:
		print("Cleaning up...")
		delete_from_paths(test_subjects)
		tear_down_polaris()
		cleanup_prometheus()
		if proxy is not None:
			proxy.kill()



if __name__ == "__main__":
    main()
