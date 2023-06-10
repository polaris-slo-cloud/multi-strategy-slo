import subprocess
import os
import time
import requests
import matplotlib.pyplot as plt
import datetime
import json
import threading
import schedule

namespace = 'polaris'
slo_controller_interval_ms = 5000
metric_controller_interval_ms = 3000

prometheus_port = 9090

lib_crds = [
    	'crds'
	]
apps = [
    	'average-cpu-utilization',
    	'average-cpu-utilization-metric-controller',
    	'multi-elasticity-strategy'
	]


cpu_usage_metric = 'polaris_composed_metrics_polaris_slo_cloud_github_io_v1_average_cpu_utilization'
target_cpu_usage = 50


def create_from_paths(paths):
	for path in paths:
		subprocess.call(['kubectl', 'apply', '-f', path])


def delete_from_paths(paths):
	for path in paths:
		subprocess.call(['kubectl', 'delete', '-f', path])


def abs_path(file_list):
	return [f'{os.path.dirname(os.path.abspath(__file__))}/{path}' for path in file_list]



def setup_polaris():
	create_from_paths(abs_path(lib_crds))
	create_from_paths(abs_path(apps))


def tear_down_polaris():
	delete_from_paths(abs_path(apps))
	delete_from_paths(abs_path(lib_crds))


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


def correct_time(value, start):
	return int(value) - start;


def get_cpu_usage(start, end):
	metric = cpu_usage_metric
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return [[correct_time(sublist[0], start), float(sublist[1])] for sublist in result]


def get_replica_count(deployment_name, start, end):
	metric = f'kube_deployment_spec_replicas{{deployment="{deployment_name}"}}'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return [[correct_time(sublist[0], start), int(sublist[1])] for sublist in result]


def get_cpu_resource_req(deployment_name, start, end):
	metric = f'sum(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="cpu"}})'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return [[correct_time(sublist[0], start), float(sublist[1])] for sublist in result]



def get_mem_resource_req(deployment_name, start, end):
	metric = f'sum(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="memory"}})'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return [[correct_time(sublist[0], start), bytes_to_megabytes(float(sublist[1]))] for sublist in result]


def bytes_to_megabytes(bytes):
	return bytes / 1000 / 1000


class SloTest:
	def __init__(self, name, deployment, yamls):
		self.name = name
		self.deployment = deployment
		self.yamls = yamls

def job(value):
	#todo remove server url
	url = f'http://localhost:8080/ConsumeCPU'
	params = {
	'millicores': int(value / 10),
	'durationSec': 1
	}
	headers = {
	'Content-Type': 'application/x-www-form-urlencoded',
	'Connection':'close'
	}
	try:
		response = requests.post(url, data=params, headers=headers)
		#print(response.url, unix_timestamp())
		#print(response.text)
		if response.status_code != 200:
			print(response)
	except Exception as e:
		print(f"Error during execution: {e}")


def generate_load(data):
	threads = []
	for value in data:
		round_start = unix_timestamp()
		print(f'Producing {value} millis load')
		while unix_timestamp() < round_start + 60:
			for i in range(10):
				job(value)
				time.sleep(0.1)


def execute_test(tested, data):
	print('Starting to track metrics...')
	start = unix_timestamp()

	generate_load(data)

	end = unix_timestamp()

	deployment = tested.deployment
	label = tested.name

	fig, axs = plt.subplots(nrows=4, ncols=1, sharex=True)
	cpu_usage = get_cpu_usage(start, end)
	plot_samples(axs[0], cpu_usage, 'Actual', 'CPU Usage', 'Percent')
	plot_samples(axs[0], [[int(sublist[0]), float(target_cpu_usage)] for sublist in cpu_usage], 'Target', 'CPU Usage', 'Percent')

	cpu_req = get_cpu_resource_req(deployment, start, end)
	mem_req = get_mem_resource_req(deployment, start, end)
	pod_count = get_replica_count(deployment, start, end)
	
	plot_samples(axs[1], cpu_req, label, 'Workload CPU Request', 'Core')
	plot_samples(axs[2], mem_req, label, 'Workload Memory Request', "Mi")
	plot_samples(axs[3], pod_count, label, 'Workload Size', 'Pod')
	plt.tight_layout()
	plt.show()


def plot_samples(axs, samples, label, title, y_label):
	time = [sample[0] for sample in samples]
	value = extract_values(samples)
	if label is not None:
		axs.plot(time, value, label=label)
	else:
		axs.plot(time, value)
	axs.set_title(title)
	axs.set_xlabel('Seconds')
	axs.set_ylabel(y_label)
	axs.legend()


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


def run_test(test, data):
	print("Starting test setup...")
	proxy = None

	try:
		setup_polaris()
		create_from_paths(test.yamls)
		wait_all_ready()
		print("Setting up Prometheus connection...")
		proxy = setup_prometheus_connection()
		print("Executing test...")
		execute_test(test, data)
	except Exception as e:
		print(f"Error during execution: {e}")
	finally:
		print("Cleaning up...")
		delete_from_paths(test.yamls)
		tear_down_polaris()
		cleanup_prometheus()
		if proxy is not None:
			proxy.kill()
