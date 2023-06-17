import os
import sys

parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(parent_dir)

import suite as test

subdir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'manifests'))
decision_yamls = [f'{subdir}/workload_test.yaml', f'{subdir}/slo-mapping_test.yaml']
horizontal_yamls = [f'{subdir}/workload_reference.yaml', f'{subdir}/slo-mapping_reference.yaml']

decision_l = test.SloTest('Threshold', 'test-pause-deployment', decision_yamls)
horizontal = test.SloTest('Horizontal', 'reference-pause-deployment', horizontal_yamls)

data = [39, 29, 82, 76, 45, 20, 37, 62, 68, 47, 32, 37, 27, 43, 31, 68, 41, 68,
    79, 33, 58, 62, 60, 41, 76, 31, 41, 32, 30, 50, 59, 64, 98, 77, 54, 76, 79,
    60, 28, 40, 48, 48, 31, 59, 76, 38, 48, 79, 58, 78, 56, 49, 29, 42, 83, 71,
    54, 44, 36, 50, 49, 35]

test.run_test(decision_l, horizontal, data)
