import suite as test

data = [499, 499, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700,
        600, 501]

workload_yaml = './../slo-mappings/priority/resource-consumer.yaml'
mapping_base_path = './../slo-mappings/priority'

test.run(
  test.SloTest('Horizontal Scaling', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/horizontal.yaml'],
               'horizontal'), data)
test.run(
  test.SloTest('Priority Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/priority.yaml'],
               'priority'), data)
