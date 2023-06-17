import os
import sys

import suite as test

data = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]

def test_runner(slo_test_test, slo_test_ref, result_name):
	try:
		test.run_test(slo_test_test, slo_test_ref, data, result_name)
	except Exception as e:
		print(f'Exception on test: {e}')

def get_tested_yamls(category):
	return [f'{category}/manifests/workload_test.yaml', f'{category}/manifests/slo-mapping_test.yaml']


def get_reference_yamls(type):
	return [f'{category}/manifests/workload_reference.yaml', f'{category}/manifests/slo-mapping_reference.yaml']


# Random DL & Horizontal Comparison
name = 'random'
result_name = 'random_dl_horizontal'
decision_l = test.SloTest('Random DL H&V', 'test-pause-deployment', get_tested_yamls(name))
horizontal = test.SloTest('Horizontal', 'reference-pause-deployment', get_reference_yamls(name))
test_runner(decision_l, horizontal, result_name)


# Round Robin DL & Horizontal Comparison
name = 'round_r'
result_name = 'round_robin_horizontal'
decision_l = test.SloTest('Round Robin DL H&V', 'test-pause-deployment', get_tested_yamls(name))
horizontal = test.SloTest('Horizontal', 'reference-pause-deployment', get_reference_yamls(name))
test_runner(decision_l, horizontal, result_name)


# Priority DL & Horizontal Comparison
name = 'priority'
result_name = 'priority_horizontal'
decision_l = test.SloTest('Priority DL H&V', 'test-pause-deployment', get_tested_yamls(name))
horizontal = test.SloTest('Horizontal', 'reference-pause-deployment', get_reference_yamls(name))
test_runner(decision_l, horizontal, result_name)

# Threshold DL & Horizontal Comparison
name = 'threshold'
result_name = 'threshold_horizontal'
decision_l = test.SloTest('Threshold DL H&V', 'test-pause-deployment', get_tested_yamls(name))
horizontal = test.SloTest('Horizontal', 'reference-pause-deployment', get_reference_yamls(name))
test_runner(decision_l, horizontal, result_name)
