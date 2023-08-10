import os
import sys
import suite as test

data = [499, 499, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700, 600, 501]

workload_yaml = './../slo-mappings/base/resource-consumer.yaml'
mapping_base_path = './../slo-mappings/base'

test.test_runner(test.SloTest('Best Fit Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/best-fit.yaml'], 'best-fit'), data)
test.test_runner(test.SloTest('Horizontal Scaling', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/horizontal.yaml'], 'horizontal'), data)
test.test_runner(test.SloTest('Vertical Scaling', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/vertical.yaml'], 'vertical'), data)
test.test_runner(test.SloTest('Random Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/random.yaml'], 'random'), data)
test.test_runner(test.SloTest('Round Robin Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/round.yaml'], 'round'), data)
test.test_runner(test.SloTest('Priority Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/priority.yaml'], 'priority'), data)
test.test_runner(test.SloTest('Threshold Decision', 'resource-consumer', [workload_yaml, f'{mapping_base_path}/threshold.yaml'], 'threshold'), data)
