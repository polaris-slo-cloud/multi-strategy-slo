import os
import sys
import load_tester as test

data = [499, 499, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300, 1200, 1100, 1000, 900, 800, 700, 600, 501]
data = [499, 499, 550, 450, 400, 800, 880, 700, 660, 1500, 1520, 1510, 500, 480, 520, 450, 400, 360, 300, 600, 550, 500, 470, 519]

def test_runner(slo_test):
	try:
		test.run_test(slo_test, data)
	except KeyboardInterrupt:
		exit(1)
	except Exception as e:
		print(f'Exception on test: {e}')

# Simple Horizontal Scaling
test_runner(test.SloTest('Best Fit Decision', 'resource-consumer', ['resource-consumer.yaml', 'best-fit.yaml'], 'best-fit'))
test_runner(test.SloTest('Horizontal Scaling', 'resource-consumer', ['resource-consumer.yaml', 'horizontal.yaml'], 'horizontal'))
test_runner(test.SloTest('Vertical Scaling', 'resource-consumer', ['resource-consumer.yaml', 'vertical.yaml'], 'vertical'))
test_runner(test.SloTest('Random Decision', 'resource-consumer', ['resource-consumer.yaml', 'random.yaml'], 'random'))
test_runner(test.SloTest('Round Robin Decision', 'resource-consumer', ['resource-consumer.yaml', 'round.yaml'], 'round'))
test_runner(test.SloTest('Priority Decision', 'resource-consumer', ['resource-consumer.yaml', 'priority.yaml'], 'priority'))
test_runner(test.SloTest('Threshold Decision', 'resource-consumer', ['resource-consumer.yaml', 'threshold.yaml'], 'threshold'))
