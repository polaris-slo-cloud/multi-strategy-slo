import suite as test

data = [499, 499, 550, 450, 400, 800, 880, 700, 660, 1500, 1520, 1510, 500, 480, 520, 450, 400, 360, 300, 600, 550, 500,
        470, 519]

workload_yaml = './../slo-mappings/base/resource-consumer.yaml'
mapping_base_path = './../slo-mappings/base'

test.run(
  test.SloTest('Best Fit Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/best-fit.yaml'],
               'best-fit'), data)
test.run(
  test.SloTest('Horizontal Scaling', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/horizontal.yaml'],
               'horizontal'), data)
test.run(
  test.SloTest('Vertical Scaling', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/vertical.yaml'],
               'vertical'), data)
test.run(
  test.SloTest('Random Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/random.yaml'], 'random'),
  data)
test.run(
  test.SloTest('Round Robin Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/round.yaml'],
               'round'), data)
test.run(
  test.SloTest('Priority Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/priority.yaml'],
               'priority'), data)
test.run(
  test.SloTest('Threshold Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/threshold.yaml'],
               'threshold'), data)
