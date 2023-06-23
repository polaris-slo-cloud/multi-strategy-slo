import subprocess
import os
import time
import requests
import matplotlib.pyplot as plt
import datetime
import json
import threading
import schedule
from kubernetes import client, config, watch
import sys

namespace = 'polaris'
slo_controller_interval_ms = 5000
metric_controller_interval_ms = 3000
prometheus_port = 9090
cluster_ip = '192.168.49.2'

lib_crds = [
    	'crds'
	]
apps = [
    	'average-cpu-utilization',
    	'demo-average-cpu-utilization-metric-controller',
    	'demo-cpu-load-metric-controller',
    	'multi-elasticity-strategy'
	]


cpu_usage_metric = 'polaris_composed_metrics_polaris_slo_cloud_github_io_v1_average_cpu_utilization'
cpu_load_metric = 'polaris_composed_metrics_polaris_slo_cloud_github_io_v1_cpu_load'
target_cpu_usage = 50

def set_test_data(data):
	json_list = json.dumps(data)
	set_deployment_env_var('demo-cpu-load-metric-controller', 'CPU_TEST_DATA', json_list)


def set_deployment_env_var(deployment_name, name, value):
	subprocess.call(['kubectl', 'set', 'env', f'deployment/{deployment_name}', f'{name}={value}', '-n', f'{namespace}'])


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



def get_container_resource_req(deployment_name, start, end):
	metric = f'sum(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="cpu"}}) / count(kube_pod_container_resource_limits{{pod=~"{deployment_name}.*", resource="cpu"}})'
	query = query_prometheus(metric, start, end)
	result = extract_query_result(query)
	return [[correct_time(sublist[0], start), float(sublist[1])] for sublist in result]


class SloTest:
	def __init__(self, name, deployment, yamls, export_file, title=None):
		self.name = name
		self.deployment = deployment
		self.yamls = yamls
		self.export_file = export_file
		self.title = title


def watch_kubernetes(counter_callback, stop_event, plural):
	print('watch_kubernetes_object_updates')
	config.load_kube_config()
	api_client = client.ApiClient()
	custom_api = client.CustomObjectsApi()
	watcher = watch.Watch()
	print('got watcher')

	try:
		for event in watcher.stream(custom_api.list_namespaced_custom_object,'elasticity.polaris-slo-cloud.github.io','v1','polaris', plural):
			print("Event: %s %s" % (event['type'], event['object']))
			if stop_event.is_set():
				break
			counter_callback(plural)
	except Exception as e:
		print(f"Error watching Kubernetes object updates: {str(e)}")
		sys.exit(1)
	finally:
		watcher.stop()


def observe_load(data):
	try:
		global scaling_actions
		scaling_actions = {}
		lock = threading.Lock()
		stop_event_watch = threading.Event()
		stop_event_load = threading.Event()

		def update_counter(plural):
			with lock:
				if plural not in scaling_actions:
					scaling_actions[plural] = []
				scaling_actions[plural].append(unix_timestamp())

		v_watcher = threading.Thread(target=watch_kubernetes, args=(update_counter, stop_event_watch, 'verticalelasticitystrategies'), daemon=True)
		h_watcher = threading.Thread(target=watch_kubernetes, args=(update_counter, stop_event_watch, 'horizontalelasticitystrategies'), daemon=True)
		v_watcher.start()
		h_watcher.start()
		wait_for_value(data[-1])
	finally:
		stop_event_watch.set()
		stop_event_load.set()

	return scaling_actions


def get_cpu_load_instant():
	metric = cpu_load_metric
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
			cpu_usage = int(float(get_cpu_load_instant()) * 1000)
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


def execute_test(tested, data):
	print('Starting to track metrics...')
	wait_for_value(data[0])
	start = unix_timestamp()

	scaling_actions = observe_load(data)

	end = unix_timestamp()
	plot_test_result(tested, start, end, scaling_actions)


def plot_test_result(tested, start, end, scaling_actions):
	deployment = tested.deployment
	label = tested.name
	fig, axs = plt.subplots(nrows=4, ncols=1, sharex=True)
	cpu_usage = get_cpu_usage(start, end)
	#plot_scaling_actions(axs[1], scaling_actions, start)
	plot_samples(axs[0], cpu_usage, 'Actual', 'CPU Usage', 'Percent')
	plot_samples(axs[0], [[int(sublist[0]), float(target_cpu_usage)] for sublist in cpu_usage], 'Target', 'CPU Usage', 'Percent')

	cpu_req = get_cpu_resource_req(deployment, start, end)
	container_req = get_container_resource_req(deployment, start, end)
	pod_count = get_replica_count(deployment, start, end)

	plot_samples(axs[1], cpu_req, None, 'Workload CPU Request', 'Core')
	plot_samples(axs[2], container_req, None, 'Container CPU Request', "Core")
	plot_samples(axs[3], pod_count, None, 'Workload Size', 'Pod')
	axs[0].legend(fontsize=5, ncols=2)
	axs[3].set_xlabel('Time (sec)', fontsize=8, loc='center')
	if tested.title is not None:
		fig.suptitle(tested.title)

	for ax in axs:
		ax.grid(linewidth=0.2)
	plt.tight_layout()
	plt.gcf().set_size_inches(8, 6)
	plt.savefig(f'./result/{tested.export_file}', dpi=200)


def plot_scaling_actions(plt, scaling_actions, start):
	print(scaling_actions)
	y_min, y_max = plt.get_ylim()
	if 'verticalelasticitystrategies' in scaling_actions:
		plt.vlines(x = [correct_time(value, start) for value in scaling_actions['verticalelasticitystrategies']], ymin = y_min, ymax = y_max,
           colors = 'dimgray', linestyles='dotted', label = 'Vertical Scaling')
	if 'horizontalelasticitystrategies' in scaling_actions:
		plt.vlines(x = [correct_time(value, start) for value in scaling_actions['horizontalelasticitystrategies']], ymin = y_min, ymax = y_max,
           colors = 'limegreen', linestyles='dashed', label = 'Horizontal Scaling')


def plot_samples(axs, samples, label, title, y_label):
	time = [sample[0] for sample in samples]
	value = extract_values(samples)
	if label is not None:
		axs.plot(time, value, label=label)
	else:
		axs.plot(time, value)
	axs.tick_params(axis='x', labelsize=8)
	axs.tick_params(axis='y', labelsize=8)
	axs.set_title(title, fontsize=10)
	axs.set_ylabel(y_label, fontsize=8)


def extract_values(samples):
	return [float(sublist[1]) for sublist in samples]


def cleanup_prometheus():
	metrics = [
	cpu_usage_metric,
	cpu_load_metric,
	'kube_deployment_spec_replicas',
	'kube_pod_container_resource_limits',
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
		set_test_data(data)
		wait_all_ready()
		print("Setting up Prometheus connection...")
		proxy = setup_prometheus_connection()
		print("Executing test...")
		execute_test(test, data)
	finally:
		print("Cleaning up...")
		delete_from_paths(test.yamls)
		tear_down_polaris()
		cleanup_prometheus()
		if proxy is not None:
			proxy.kill()
