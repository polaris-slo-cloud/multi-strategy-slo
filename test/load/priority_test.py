import os
import sys
import load_tester as test

decision_yamls = ['resource-consumer.yaml', 'priority.yaml']
decision_l = test.SloTest('Priority Decision', 'resource-consumer', decision_yamls)

data = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0]

test.run_test(decision_l, data)
