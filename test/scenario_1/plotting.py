import json

import matplotlib.pyplot as plt


def query_prometheus(file):
  with open(file, 'r') as f:
    return json.load(f)


def extract_query_result(result):
  return result['data']['result'][0]['values']


def get_cpu_usage():
  query = query_prometheus('cpu_usage.json')
  result = extract_query_result(query)
  return result


def get_replica_count():
  query = query_prometheus('replicas.json')
  result = extract_query_result(query)
  return result


def get_cpu_resource_req():
  query = query_prometheus('cpu_req.json')
  result = extract_query_result(query)
  return result


def get_mem_resource_req():
  query = query_prometheus('mem_req.json')
  result = extract_query_result(query)
  return result


def execute_test():
  deployments = ['pause-deployment', 'reference']
  cpu_usage = get_cpu_usage()
  datasets = []

  counter = 0

  for deployment in deployments:
    cpu_req = get_cpu_resource_req()
    mem_req = get_mem_resource_req()
    pod_count = get_replica_count()
    datasets.append([cpu_req, mem_req, pod_count])
    counter += 1

  plot_result(cpu_usage, datasets[0], datasets[1])


def plot_result(cpu_usage, datasets_dl, datasets_simple):
  fig, axs = plt.subplots(nrows=4, ncols=1, sharex=True)
  titles = ['CPU Usage', 'CPU Request', 'Memory Request', 'Pod Count']

  time = [int(sublist[0]) for sublist in cpu_usage]
  value = [float(sublist[1]) for sublist in cpu_usage]
  axs[0].plot(time, value, label=titles[0])

  counter = 1

  for dl_set, simple_set in zip(datasets_dl, datasets_simple):

    time = [int(sublist[0]) for sublist in dl_set]
    value = [float(sublist[1]) for sublist in dl_set]
    axs[counter].plot(time, value, label='Decision Logic')

    time = [int(sublist[0]) for sublist in simple_set]
    value = [float(sublist[1]) for sublist in simple_set]
    axs[counter].plot(time, value, label='Horizontal')

    axs[counter].set_title(titles[counter])
    axs[counter].set_xlabel('Time')
    axs[counter].set_ylabel('Value')
    axs[counter].legend()
    counter += 1
  plt.tight_layout()
  plt.show()


if __name__ == "__main__":
  execute_test()
