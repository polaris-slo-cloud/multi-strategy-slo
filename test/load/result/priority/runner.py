import os
import sys
import load_tester as test

data = [499, 499, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700, 600, 501]

def test_runner(slo_test):
	try:
		test.run_test(slo_test, data)
	except KeyboardInterrupt:
		exit(1)
	except Exception as e:
		print(f'Exception on test: {e}')

# Simple Horizontal Scaling
test_runner(test.SloTest('Horizontal Scaling', 'resource-consumer', ['resource-consumer.yaml', 'horizontal.yaml'], 'horizontal'))
test_runner(test.SloTest('Priority Decision', 'resource-consumer', ['resource-consumer.yaml', 'priority.yaml'], 'priority'))
