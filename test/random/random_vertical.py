import os
import sys

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(parent_dir)

import suite as test

subdir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'manifests'))
decision_yamls = [f'{subdir}/vertical/workload_test.yaml', f'{subdir}/vertical/slo-mapping_test.yaml']
vertical_yamls = [f'{subdir}/vertical/workload_reference.yaml', f'{subdir}/vertical/slo-mapping_reference.yaml']

decision_l = test.SloTest('Random DL', 'test-pause-deployment', decision_yamls)
vertical = test.SloTest('Vertical', 'reference-pause-deployment', vertical_yamls)

data = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]

test.run_test(decision_l, vertical, data)
