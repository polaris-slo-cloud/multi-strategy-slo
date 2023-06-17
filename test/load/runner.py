import os
import sys
import load_tester as test

data = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1000, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0]

def test_runner(slo_test):
	try:
		test.run_test(slo_test, data)
	except Exception as e:
		print(f'Exception on test: {e}')



# Random Decision Logic Tests

test_runner(test.SloTest('Random Decision', 'resource-consumer', ['resource-consumer.yaml', 'random.yaml'], 'random'))
test_runner(test.SloTest('Random Decision', 'resource-consumer', ['resource-consumer-in-place.yaml', 'random.yaml'], 'random_in-place'))


# Round Robin Decision Logic Tests

test_runner(test.SloTest('Round Robin Decision', 'resource-consumer', ['resource-consumer.yaml', 'round.yaml'], 'round'))
test_runner(test.SloTest('Round Robin Decision', 'resource-consumer', ['resource-consumer-in-place.yaml', 'round.yaml'], 'round_in-place'))

# Priority Decision Logic Tests

test_runner(test.SloTest('Priority Decision', 'resource-consumer', ['resource-consumer.yaml', 'priority.yaml'], 'priority'))
test_runner(test.SloTest('Priority Decision', 'resource-consumer', ['resource-consumer-in-place.yaml', 'priority.yaml'], 'priority_in-place'))

# Threshold Decision Logic Tests

test_runner(test.SloTest('Threshold Decision', 'resource-consumer', ['resource-consumer.yaml', 'threshold.yaml'], 'threshold'))
test_runner(test.SloTest('Threshold Decision', 'resource-consumer', ['resource-consumer-in-place.yaml', 'threshold.yaml'], 'threshold_in-place'))